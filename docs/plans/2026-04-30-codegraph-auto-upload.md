# CodeGraph Auto-Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Quando Claude Code apre su un progetto, il proxy analizza automaticamente il workspace locale e uploada il graph.db al server remoto SkillBrain, rendendo i tool `codegraph_*` funzionali online senza intervento manuale.

**Architecture:** Il proxy (`proxy.ts`) gira già localmente e ha accesso al filesystem. Al session start, confronta il lastCommit locale con quello nel registry remoto: se diverso (o mancante), esegue `analyzeCommand()` in-process, legge il graph.db risultante, e lo invia via `POST /api/codegraph/upload` al server. Il server salva il db in `/data/repos/{name}/.codegraph/graph.db` e aggiorna il suo registry. Viene anche registrato un tool `codegraph_analyze` che il proxy intercetta localmente per ri-analisi manuale.

**Tech Stack:** TypeScript, Node.js, Express (server), better-sqlite3, `@modelcontextprotocol/sdk`, fetch API (native Node 18+)

---

### Task 1: Server — endpoint `POST /api/codegraph/upload`

**Files:**
- Modify: `packages/codegraph/src/mcp/http-server.ts`

**Cosa fa:** Riceve `{ repoName, lastCommit, stats, graphDb: base64 }`, scrive il graph.db in `/data/repos/{repoName}/.codegraph/graph.db`, chiama `upsertRegistry`.

**Step 1: Trovare il punto giusto in http-server.ts**

Cercare la sezione con le route API (es. `app.get('/api/health'`). Il nuovo endpoint va aggiunto lì, con auth Bearer identica alle altre route protette.

**Step 2: Aggiungere l'endpoint**

Aggiungere dopo le route `/api/health` esistenti in `http-server.ts`:

```typescript
// ── CodeGraph upload ──
app.post('/api/codegraph/upload', authMiddleware, async (req, res) => {
  try {
    const { repoName, lastCommit, stats, graphDb } = req.body as {
      repoName: string
      lastCommit: string | null
      stats: Record<string, number>
      graphDb: string // base64
    }

    if (!repoName || !graphDb) {
      res.status(400).json({ error: 'Missing repoName or graphDb' })
      return
    }

    // Store under /data/repos/{repoName}/.codegraph/graph.db
    const repoStorePath = path.join(process.cwd(), 'repos', repoName)
    const codegraphDir = path.join(repoStorePath, '.codegraph')
    fs.mkdirSync(codegraphDir, { recursive: true })

    const dbPath = path.join(codegraphDir, 'graph.db')
    fs.writeFileSync(dbPath, Buffer.from(graphDb, 'base64'))

    upsertRegistry({
      name: repoName,
      path: repoStorePath,
      lastCommit: lastCommit ?? null,
      indexedAt: new Date().toISOString(),
      stats: {
        nodes: stats.nodes ?? 0,
        edges: stats.edges ?? 0,
        files: stats.files ?? 0,
        communities: stats.communities ?? 0,
        processes: stats.processes ?? 0,
      },
    })

    res.json({ success: true, repoName, path: repoStorePath })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
```

**Step 3: Verificare che `upsertRegistry` sia già importato**

In cima al file è già presente:
```typescript
import { loadRegistry } from '../storage/registry.js'
```
Aggiungere `upsertRegistry` all'import:
```typescript
import { loadRegistry, upsertRegistry } from '../storage/registry.js'
```

**Step 4: Build e verifica compilazione**

```bash
cd "packages/codegraph" && pnpm run build 2>&1 | tail -20
```
Expected: nessun errore TypeScript.

**Step 5: Commit**

```bash
git add packages/codegraph/src/mcp/http-server.ts
git commit -m "feat(codegraph): add POST /api/codegraph/upload endpoint"
```

---

### Task 2: Proxy — helper `localAnalyzeAndUpload()`

**Files:**
- Modify: `packages/codegraph/src/mcp/proxy.ts`

**Cosa fa:** Funzione standalone che: (1) esegue `analyzeCommand()` localmente, (2) legge il graph.db, (3) lo invia al server.

**Step 1: Aggiungere gli import necessari in proxy.ts**

In cima, dopo gli import esistenti:

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { analyzeCommand } from '../cli/commands/analyze.js'
import { getDbPath } from '../storage/db.js'
import { loadMeta } from '../storage/meta.js'
```

**Step 2: Aggiungere la funzione helper**

Dopo le costanti `REMOTE_URL` e `AUTH_TOKEN`, aggiungere:

```typescript
/**
 * Run codegraph analyze on a local workspace path,
 * then upload the resulting graph.db to the remote SkillBrain server.
 */
async function localAnalyzeAndUpload(repoPath: string, remoteUrl: string, authToken: string): Promise<void> {
  // 1. Run local analysis (in-process, no stdout noise)
  await analyzeCommand(repoPath, { noProgress: true, skipGit: false })

  // 2. Read graph.db
  const dbPath = getDbPath(repoPath)
  if (!fs.existsSync(dbPath)) return

  const graphDb = fs.readFileSync(dbPath).toString('base64')

  // 3. Load local meta for stats + commit
  const meta = loadMeta(repoPath)
  if (!meta) return

  // 4. POST to server
  const uploadUrl = remoteUrl.replace('/mcp', '/api/codegraph/upload')
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      repoName: meta.name,
      lastCommit: meta.lastCommit,
      stats: meta.stats,
      graphDb,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`CodeGraph upload failed (${response.status}): ${text}`)
  }
}
```

**Step 3: Build check**

```bash
cd "packages/codegraph" && pnpm run build 2>&1 | tail -20
```

**Step 4: Commit**

```bash
git add packages/codegraph/src/mcp/proxy.ts
git commit -m "feat(codegraph): add localAnalyzeAndUpload helper in proxy"
```

---

### Task 3: Proxy — auto-check al session start

**Files:**
- Modify: `packages/codegraph/src/mcp/proxy.ts` (funzione `startProxy`)

**Cosa fa:** Dopo che la sessione è avviata, controlla se il workspace corrente è nel registry remoto con il commit aggiornato. Se non lo è, triggera l'upload automaticamente.

**Step 1: Aggiungere il check dopo il blocco session_start**

Nel corpo di `startProxy()`, dopo il blocco `try { ... } catch { // Session start is best-effort }`, aggiungere:

```typescript
// Auto-index current workspace if not yet in remote registry (or stale)
try {
  const listResult = await client.callTool({ name: 'codegraph_list_repos', arguments: {} })
  const remoteRepos: Array<{ name: string; lastCommit: string | null }> =
    JSON.parse((listResult as any)?.content?.[0]?.text || '[]')

  const localMeta = loadMeta(project.workspace ?? process.cwd())
  const remoteEntry = remoteRepos.find((r) => r.name === project.name)

  const needsUpload =
    localMeta !== null &&
    (!remoteEntry || remoteEntry.lastCommit !== localMeta.lastCommit)

  if (needsUpload) {
    // Fire-and-forget — don't block proxy startup
    localAnalyzeAndUpload(project.workspace ?? process.cwd(), REMOTE_URL, AUTH_TOKEN).catch(() => {})
  }
} catch {
  // best-effort — never block proxy
}
```

**Step 2: Aggiungere `loadMeta` agli import** (se non già presente dal Task 2)

Verificare che in cima ci sia:
```typescript
import { loadMeta } from '../storage/meta.js'
```

**Step 3: Build check**

```bash
cd "packages/codegraph" && pnpm run build 2>&1 | tail -20
```

**Step 4: Commit**

```bash
git add packages/codegraph/src/mcp/proxy.ts
git commit -m "feat(codegraph): auto-upload workspace graph on session start"
```

---

### Task 4: Proxy — tool `codegraph_analyze` intercettato localmente

**Files:**
- Modify: `packages/codegraph/src/mcp/proxy.ts`

**Cosa fa:** Registra un tool `codegraph_analyze` che viene gestito localmente dal proxy (non forwardato al server) per re-analisi manuale.

**Step 1: Iniettare il tool nella lista tools**

Modificare il handler `ListToolsRequestSchema`:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const remote = await client.listTools()
  return {
    tools: [
      ...remote.tools,
      {
        name: 'codegraph_analyze',
        description: 'Analyze current workspace and upload graph to SkillBrain server',
        inputSchema: { type: 'object' as const, properties: {}, required: [] },
      },
    ],
  }
})
```

**Step 2: Intercettare la chiamata nel handler `CallToolRequestSchema`**

Modificare il handler esistente:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Intercept codegraph_analyze — runs locally in the proxy, not on remote server
  if (request.params.name === 'codegraph_analyze') {
    try {
      await localAnalyzeAndUpload(project.workspace ?? process.cwd(), REMOTE_URL, AUTH_TOKEN)
      return {
        content: [{ type: 'text' as const, text: `✅ Workspace "${project.name}" analyzed and uploaded to SkillBrain.` }],
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text' as const, text: `❌ Analysis failed: ${err.message}` }],
      }
    }
  }

  // All other tools → remote server
  const result = await client.callTool({
    name: request.params.name,
    arguments: request.params.arguments,
  })
  return result as any
})
```

**Step 3: Build check**

```bash
cd "packages/codegraph" && pnpm run build 2>&1 | tail -20
```

**Step 4: Test manuale**

Riavviare Claude Code (per ricaricare il proxy) e chiamare:
```
codegraph_analyze
```
Expected: risposta con `✅ Workspace "..." analyzed and uploaded`.
Poi: `codegraph_list_repos` → deve mostrare il progetto corrente.

**Step 5: Commit**

```bash
git add packages/codegraph/src/mcp/proxy.ts
git commit -m "feat(codegraph): add codegraph_analyze tool intercepted locally by proxy"
```

---

### Task 5: Deploy e verifica end-to-end

**Step 1: Push a GitHub**

```bash
git push origin main
```

Coolify si triggera automaticamente → redeploy del server con il nuovo endpoint `/api/codegraph/upload`.

**Step 2: Attendere deploy Coolify**

Verificare su Coolify che il deploy sia completato.

**Step 3: Riavviare Claude Code**

Alla riapertura, il proxy si connette → session_start → auto-check → se workspace non è nel registry → triggera `localAnalyzeAndUpload` in background.

**Step 4: Verificare**

```
codegraph_list_repos
```
Expected: lista con il progetto corrente e stats aggiornate.

**Step 5: Test su progetto cliente**

Aprire Claude Code in `/Users/dan/Desktop/progetti-web/Web_Pixarts/` → attendi qualche secondo → chiamare `codegraph_list_repos` → deve apparire "Web_Pixarts".
