# Projects Phase 2 — Endpoints + Insights Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task.

**Goal:** Aggiungere 5 endpoint server-side (PATCH pin, PATCH status, POST bulk, GET ?summary=true, GET /insights), una migration DB per il campo `pinned`, e una tab "Insights" frontend con 3 chart SVG inline. Migrare client da localStorage→DB per i pin e da iterazione PUT→singolo POST per i bulk.

**Architecture:** SQLite migration aggiunge `pinned INTEGER DEFAULT 0` alla tabella `projects`. `ProjectsStore` esteso con `togglePin`, `bulkAction`, `listSummary`, `getInsights`. Route handlers in `mcp/routes/projects.ts`. Frontend: nuova tab Insights con 3 SVG chart helpers (`svgBarChart`, `svgDonutChart`, `svgHBarChart`), `toggleProjectPin` diventa async-PATCH, bulk diventa single-POST, `renderProjects` switcha a fetch unico `?summary=true`.

**Tech Stack:** TypeScript + Express 5 + better-sqlite3 + vanilla ES modules frontend. No nuove dipendenze.

**Working directory:** `/Users/dan/Desktop/progetti-web/MASTER_Fullstack session`

**Prerequisites:** Fase 1 merged at HEAD = `97ae181` (verifica con `git log -1 --format=%h`).

**No automated tests:** dashboard frontend è senza test suite. Backend ha vitest ma il pattern attuale per i routes è "manual via curl/browser". Ogni task termina con verifica curl per il backend e browser per il frontend.

**Riferimenti spec:** `docs/plans/2026-05-12-projects-phase2-design.md`.

---

## Convenzioni del plan

- Path relativi a repo root salvo dove indicato `packages/codegraph/public/` o `packages/storage/`
- TypeScript: dopo edit di `.ts`, eseguire `cd packages/codegraph && npm run build` (o `cd packages/storage && npm run build`)
- Server dashboard: già documentato in Fase 1 verification — `cd packages/codegraph && node dist/cli.js mcp --http --port 8090`
- Una migration SQL = un commit. Una route + store method = un commit. Frontend changes = un commit per area.
- Ogni task termina con commit. NO push.

---

## Task 1: Migration + ProjectsStore pinned field

**Files:**
- Create: `packages/storage/src/migrations/032_projects_pinned.sql`
- Modify: `packages/storage/src/projects-store.ts` (Project interface + rowToProject + upsert preserve pinned)

**Step 1: Create migration**

`packages/storage/src/migrations/032_projects_pinned.sql`:
```sql
-- Add pinned flag to projects table for server-side pin persistence.
ALTER TABLE projects ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_projects_pinned ON projects(pinned) WHERE pinned = 1;
```

The partial index is small (only pinned rows) and speeds up `WHERE pinned=1` queries used by `listSummary`.

**Step 2: Extend `Project` interface in `packages/storage/src/projects-store.ts`**

Find the `Project` interface (currently ends around line 60 with `updatedAt: string`). Add:
```typescript
  pinned: boolean
```
right before `createdAt`.

**Step 3: Update `upsert` to preserve/set pinned**

In the `merged` object literal inside `upsert` (around lines 85-122), add right after `aliases`:
```typescript
      pinned: project.pinned ?? existing?.pinned ?? false,
```

In the INSERT OR REPLACE columns list (line 126-138), add `pinned` as a column at the end (before `created_at`):
```typescript
        aliases, notes, pinned, created_at, updated_at
```
…and add one more `?` placeholder. In the values list (line 140-152), add `merged.pinned ? 1 : 0` before `merged.createdAt`.

**Step 4: Update `rowToProject` to read pinned**

Find `rowToProject` (private method, lower in the file — grep for `rowToProject`). Add to the returned object:
```typescript
      pinned: row.pinned === 1 || row.pinned === true,
```

**Step 5: Build and smoke test**

```bash
cd packages/storage && npm run build
cd ../codegraph && npm run build
```
Both must succeed with no TS errors.

Restart the dashboard server (kill old, start new). The migration runs automatically on `openDb`. Verify:
```bash
sqlite3 ~/.codegraph/graph.db "PRAGMA table_info(projects)" | grep pinned
```
Should print one line containing `pinned|INTEGER|1|0|0`.

**Step 6: Commit**

```bash
git add packages/storage/src/migrations/032_projects_pinned.sql packages/storage/src/projects-store.ts
git commit -m "feat(db): add pinned flag to projects table + index"
```

---

## Task 2: ProjectsStore.togglePin

**Files:**
- Modify: `packages/storage/src/projects-store.ts`

**Step 1: Add the `togglePin` method**

Add right after the `delete(name: string): void` method (around line 170):

```typescript
  /**
   * Atomically toggle the pinned flag for a project.
   * Returns the new value. Throws if the project doesn't exist.
   */
  togglePin(name: string): boolean {
    const row = this.db.prepare('SELECT pinned FROM projects WHERE name = ?').get(name) as { pinned: number } | undefined
    if (!row) throw new Error(`Project not found: ${name}`)
    const newVal = row.pinned ? 0 : 1
    this.db.prepare('UPDATE projects SET pinned = ?, updated_at = ? WHERE name = ?')
      .run(newVal, new Date().toISOString(), name)
    return newVal === 1
  }

  /**
   * Explicit set pinned (used by bulk actions where toggle semantics aren't appropriate).
   */
  setPin(name: string, pinned: boolean): void {
    const result = this.db.prepare('UPDATE projects SET pinned = ?, updated_at = ? WHERE name = ?')
      .run(pinned ? 1 : 0, new Date().toISOString(), name)
    if (result.changes === 0) throw new Error(`Project not found: ${name}`)
  }
```

**Step 2: Build**

```bash
cd packages/storage && npm run build
```

**Step 3: Commit**

```bash
git add packages/storage/src/projects-store.ts
git commit -m "feat(store): add togglePin/setPin methods to ProjectsStore"
```

---

## Task 3: PATCH /api/projects-meta/:name/pin route

**Files:**
- Modify: `packages/codegraph/src/mcp/routes/projects.ts`

**Step 1: Add the route handler**

Right after the existing `router.delete('/api/projects-meta/:name', ...)` (around line 100), add:

```typescript
  // Toggle pinned flag
  router.patch('/api/projects-meta/:name/pin', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      const pinned = store.togglePin(req.params.name)
      closeDb(db)
      res.json({ pinned })
    } catch (err: any) {
      const msg = err.message || String(err)
      if (msg.startsWith('Project not found')) {
        res.status(404).json({ error: msg })
      } else {
        res.status(500).json({ error: msg })
      }
    }
  })
```

**Step 2: Build & restart**

```bash
cd packages/codegraph && npm run build
# Restart server (kill old PID, then start new on :8090)
```

**Step 3: Curl smoke test**

```bash
# Assuming a project named 'terrae-mare' exists
curl -sS -X PATCH http://localhost:8090/api/projects-meta/terrae-mare/pin | python3 -m json.tool
# expected: { "pinned": true }
curl -sS -X PATCH http://localhost:8090/api/projects-meta/terrae-mare/pin | python3 -m json.tool
# expected: { "pinned": false }
curl -sS -X PATCH http://localhost:8090/api/projects-meta/does-not-exist/pin
# expected: { "error": "Project not found: does-not-exist" } with HTTP 404
```

**Step 4: Commit**

```bash
git add packages/codegraph/src/mcp/routes/projects.ts
git commit -m "feat(api): PATCH /api/projects-meta/:name/pin toggle endpoint"
```

---

## Task 4: PATCH /api/projects-meta/:name/status route

**Files:**
- Modify: `packages/codegraph/src/mcp/routes/projects.ts`

**Step 1: Add the route handler**

Right after the PATCH /pin route, add:

```typescript
  // Quick status change (enum-validated)
  router.patch('/api/projects-meta/:name/status', (req, res) => {
    const ALLOWED = new Set(['active', 'paused', 'completed', 'archived'])
    const { status } = req.body || {}
    if (!status || !ALLOWED.has(status)) {
      res.status(400).json({ error: 'status must be one of: active, paused, completed, archived' })
      return
    }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      // Check existence first — upsert would silently create a new row
      if (!store.get(req.params.name)) {
        closeDb(db)
        res.status(404).json({ error: `Project not found: ${req.params.name}` })
        return
      }
      const project = store.upsert({ name: req.params.name, status })
      const sanitized = store.getSanitized(req.params.name)
      closeDb(db)
      res.json({ status, project: sanitized })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })
```

**Step 2: Build, restart, smoke test**

```bash
cd packages/codegraph && npm run build
# restart server
curl -sS -X PATCH http://localhost:8090/api/projects-meta/terrae-mare/status \
  -H "Content-Type: application/json" -d '{"status":"paused"}' | python3 -m json.tool
# expected: { "status": "paused", "project": { ... } }
curl -sS -X PATCH http://localhost:8090/api/projects-meta/terrae-mare/status \
  -H "Content-Type: application/json" -d '{"status":"invalid"}'
# expected: 400 { "error": "..." }
```

**Step 3: Commit**

```bash
git add packages/codegraph/src/mcp/routes/projects.ts
git commit -m "feat(api): PATCH /api/projects-meta/:name/status with enum validation"
```

---

## Task 5: ProjectsStore.bulkAction

**Files:**
- Modify: `packages/storage/src/projects-store.ts`

**Step 1: Add the bulk method**

Add after `setPin` (from Task 2):

```typescript
  /**
   * Execute the same action on multiple projects. Best-effort: failures on
   * individual rows don't abort the others. Returns counts plus per-name errors.
   */
  bulkAction(
    action: 'archive' | 'setStatus' | 'setClient' | 'delete' | 'pin' | 'unpin',
    names: string[],
    value?: string,
  ): { ok: number; failed: { name: string; error: string }[] } {
    const ALLOWED_STATUS = new Set(['active', 'paused', 'completed', 'archived'])
    if (action === 'setStatus' && (!value || !ALLOWED_STATUS.has(value))) {
      throw new Error('bulkAction setStatus requires valid status value')
    }
    if (action === 'setClient' && typeof value !== 'string') {
      throw new Error('bulkAction setClient requires a string value')
    }

    let ok = 0
    const failed: { name: string; error: string }[] = []

    const tx = this.db.transaction(() => {
      for (const name of names) {
        try {
          if (action === 'archive') {
            const r = this.db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE name = ?')
              .run('archived', new Date().toISOString(), name)
            if (r.changes === 0) throw new Error('Project not found')
          } else if (action === 'setStatus') {
            const r = this.db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE name = ?')
              .run(value!, new Date().toISOString(), name)
            if (r.changes === 0) throw new Error('Project not found')
          } else if (action === 'setClient') {
            const r = this.db.prepare('UPDATE projects SET client_name = ?, updated_at = ? WHERE name = ?')
              .run(value!, new Date().toISOString(), name)
            if (r.changes === 0) throw new Error('Project not found')
          } else if (action === 'delete') {
            // Match DELETE /api/projects-meta/:name: insert archived row to hide from session-based list,
            // then delete the main row.
            this.upsertArchived(name)
            this.delete(name)
          } else if (action === 'pin') {
            this.setPin(name, true)
          } else if (action === 'unpin') {
            this.setPin(name, false)
          } else {
            throw new Error(`Unknown action: ${action}`)
          }
          ok++
        } catch (err: any) {
          failed.push({ name, error: err.message || String(err) })
        }
      }
    })

    tx()
    return { ok, failed }
  }
```

Note: the SQLite transaction commits all `UPDATE`s as a single unit. If you'd want a stricter "all-or-nothing on any failure" semantic, replace the per-row try/catch with a single try outside the tx — but the spec asks for best-effort with a `failed[]` summary.

**Step 2: Build**

```bash
cd packages/storage && npm run build
```

**Step 3: Commit**

```bash
git add packages/storage/src/projects-store.ts
git commit -m "feat(store): add bulkAction method (archive/setStatus/setClient/delete/pin/unpin)"
```

---

## Task 6: POST /api/projects-meta/bulk route

**Files:**
- Modify: `packages/codegraph/src/mcp/routes/projects.ts`

**Step 1: Add the route handler**

After the PATCH /status route, add:

```typescript
  // Bulk action on multiple projects
  router.post('/api/projects-meta/bulk', (req, res) => {
    const ALLOWED_ACTIONS = new Set(['archive', 'setStatus', 'setClient', 'delete', 'pin', 'unpin'])
    const { names, action, value } = req.body || {}
    if (!Array.isArray(names) || names.length === 0) {
      res.status(400).json({ error: 'names[] required and non-empty' })
      return
    }
    if (!action || !ALLOWED_ACTIONS.has(action)) {
      res.status(400).json({ error: `action must be one of: ${[...ALLOWED_ACTIONS].join(', ')}` })
      return
    }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      const result = store.bulkAction(action, names, value)
      closeDb(db)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })
```

**Step 2: Build, restart, smoke test**

```bash
cd packages/codegraph && npm run build
# restart server
# Test bulk setStatus:
curl -sS -X POST http://localhost:8090/api/projects-meta/bulk \
  -H "Content-Type: application/json" \
  -d '{"names":["terrae-mare","new-saas"],"action":"setStatus","value":"paused"}' | python3 -m json.tool
# expected: { "ok": 2, "failed": [] }

# Test bulk pin:
curl -sS -X POST http://localhost:8090/api/projects-meta/bulk \
  -H "Content-Type: application/json" \
  -d '{"names":["terrae-mare"],"action":"pin"}' | python3 -m json.tool
# expected: { "ok": 1, "failed": [] }

# Test with a non-existent name (best-effort):
curl -sS -X POST http://localhost:8090/api/projects-meta/bulk \
  -H "Content-Type: application/json" \
  -d '{"names":["terrae-mare","does-not-exist"],"action":"archive"}' | python3 -m json.tool
# expected: { "ok": 1, "failed": [{"name":"does-not-exist","error":"Project not found"}] }
```

**Step 3: Commit**

```bash
git add packages/codegraph/src/mcp/routes/projects.ts
git commit -m "feat(api): POST /api/projects-meta/bulk for atomic bulk operations"
```

---

## Task 7: ProjectsStore.listSummary

**Files:**
- Modify: `packages/storage/src/projects-store.ts`

**Step 1: Add the SummaryProject interface**

At the top of the file near the other interfaces:

```typescript
export interface SummaryProject {
  name: string
  displayName?: string
  status: string
  category?: string
  clientName?: string
  totalSessions: number
  totalMemories: number
  lastActivity?: string
  stack: string[]
  pinned: boolean
  hasBlockers: boolean
  isStale: boolean
}
```

**Step 2: Add the listSummary method**

Add to `ProjectsStore` after `list()`:

```typescript
  /**
   * Light payload for project listing pages (4 views).
   * Joins projects + session_log + memories; computes isStale server-side.
   */
  listSummary(): SummaryProject[] {
    // Single SQL query with subqueries — better than 3 round-trips.
    const rows = this.db.prepare(`
      SELECT
        p.name, p.display_name, p.status, p.category, p.client_name,
        p.stack, p.pinned,
        (SELECT COUNT(*) FROM session_log WHERE project = p.name) AS total_sessions,
        (SELECT COUNT(*) FROM memories WHERE project = p.name) AS total_memories,
        (SELECT MAX(started_at) FROM session_log WHERE project = p.name) AS last_activity,
        (SELECT EXISTS(SELECT 1 FROM session_log WHERE project = p.name AND blockers IS NOT NULL AND blockers != '')) AS has_blockers
      FROM projects p
      ORDER BY p.pinned DESC, COALESCE(
        (SELECT MAX(started_at) FROM session_log WHERE project = p.name),
        p.updated_at
      ) DESC
    `).all() as any[]

    const now = Date.now()
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

    return rows.map((r) => {
      const lastActivity = r.last_activity || null
      const isStale = !lastActivity || (now - new Date(lastActivity).getTime() > THIRTY_DAYS_MS)
      let stack: string[] = []
      try { stack = JSON.parse(r.stack || '[]') } catch {}
      return {
        name: r.name,
        displayName: r.display_name || undefined,
        status: r.status,
        category: r.category || undefined,
        clientName: r.client_name || undefined,
        totalSessions: r.total_sessions || 0,
        totalMemories: r.total_memories || 0,
        lastActivity: lastActivity || undefined,
        stack,
        pinned: r.pinned === 1 || r.pinned === true,
        hasBlockers: r.has_blockers === 1,
        isStale,
      }
    })
  }
```

**Step 3: Build**

```bash
cd packages/storage && npm run build
```

**Step 4: Commit**

```bash
git add packages/storage/src/projects-store.ts
git commit -m "feat(store): add listSummary with aggregates and isStale computation"
```

---

## Task 8: Wire GET /api/projects?summary=true

**Files:**
- Modify: `packages/codegraph/src/mcp/routes/projects.ts`

**Step 1: Update existing GET /api/projects to honor `?summary=true`**

Replace the existing route at lines 24-34:

```typescript
  router.get('/api/projects', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      if (req.query.summary === 'true') {
        const store = new ProjectsStore(db)
        const projects = store.listSummary()
        closeDb(db)
        res.json({ projects })
        return
      }
      const store = new MemoryStore(db)
      const projects = store.listProjects()
      closeDb(db)
      res.json({ projects })
    } catch {
      res.json({ projects: [] })
    }
  })
```

**Step 2: Build, restart, smoke test**

```bash
cd packages/codegraph && npm run build
# restart server
curl -sS 'http://localhost:8090/api/projects?summary=true' | python3 -m json.tool | head -40
# expected: { "projects": [ { "name": ..., "pinned": ..., "isStale": ..., ... } ] }
curl -sS 'http://localhost:8090/api/projects' | python3 -m json.tool | head -10
# expected: legacy shape (no isStale/pinned) — backward compat
```

**Step 3: Commit**

```bash
git add packages/codegraph/src/mcp/routes/projects.ts
git commit -m "feat(api): GET /api/projects?summary=true returns light payload"
```

---

## Task 9: ProjectsStore.getInsights

**Files:**
- Modify: `packages/storage/src/projects-store.ts`

**Step 1: Add the Insights interface**

Near the other interfaces at the top:

```typescript
export interface ProjectInsights {
  sessionsPerWeek: { week: string; count: number }[]
  memoriesByType: Record<string, number>
  topSkills: { name: string; usage: number }[]
  avgConfidence: number | null
  daysSinceLastActivity: number | null
  totalSessions: number
  totalMemories: number
}
```

**Step 2: Add the getInsights method**

Add to `ProjectsStore`:

```typescript
  /**
   * Aggregate insights for a project's Insights detail tab.
   * Returns null if the project doesn't exist.
   */
  getInsights(name: string): ProjectInsights | null {
    if (!this.get(name)) return null

    // Sessions per ISO week, last 12 weeks
    const weekRows = this.db.prepare(`
      SELECT strftime('%Y-W%W', started_at) AS week, COUNT(*) AS count
      FROM session_log
      WHERE project = ? AND started_at IS NOT NULL
        AND started_at >= datetime('now', '-12 weeks')
      GROUP BY week
      ORDER BY week ASC
    `).all(name) as { week: string; count: number }[]

    // Memories by type
    const typeRows = this.db.prepare(`
      SELECT type, COUNT(*) AS count
      FROM memories
      WHERE project = ? AND type IS NOT NULL
      GROUP BY type
    `).all(name) as { type: string; count: number }[]
    const memoriesByType: Record<string, number> = {}
    for (const r of typeRows) memoriesByType[r.type] = r.count

    // Top skills (defensive — skill_usage table may not exist in all DBs)
    let topSkills: { name: string; usage: number }[] = []
    try {
      topSkills = this.db.prepare(`
        SELECT skill_name AS name, COUNT(*) AS usage
        FROM skill_usage
        WHERE project = ?
        GROUP BY skill_name
        ORDER BY usage DESC
        LIMIT 10
      `).all(name) as { name: string; usage: number }[]
    } catch { topSkills = [] }

    // Average confidence
    const conf = this.db.prepare(`
      SELECT AVG(confidence) AS avg
      FROM memories
      WHERE project = ? AND confidence IS NOT NULL
    `).get(name) as { avg: number | null }
    const avgConfidence = conf?.avg ?? null

    // Days since last activity
    const last = this.db.prepare(`
      SELECT MAX(started_at) AS last
      FROM session_log
      WHERE project = ?
    `).get(name) as { last: string | null }
    let daysSinceLastActivity: number | null = null
    if (last?.last) {
      const diff = Date.now() - new Date(last.last).getTime()
      daysSinceLastActivity = Math.floor(diff / (24 * 60 * 60 * 1000))
    }

    const totals = this.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM session_log WHERE project = ?) AS s,
        (SELECT COUNT(*) FROM memories WHERE project = ?) AS m
    `).get(name, name) as { s: number; m: number }

    return {
      sessionsPerWeek: weekRows,
      memoriesByType,
      topSkills,
      avgConfidence,
      daysSinceLastActivity,
      totalSessions: totals.s,
      totalMemories: totals.m,
    }
  }
```

**Step 3: Build**

```bash
cd packages/storage && npm run build
```

**Step 4: Commit**

```bash
git add packages/storage/src/projects-store.ts
git commit -m "feat(store): add getInsights aggregator (sessions/week, memories/type, top skills)"
```

---

## Task 10: GET /api/projects/:name/insights route

**Files:**
- Modify: `packages/codegraph/src/mcp/routes/projects.ts`

**Step 1: Add the route**

Right after the existing `GET /api/projects/:name` route (around line 36-46), add:

```typescript
  router.get('/api/projects/:name/insights', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new ProjectsStore(db)
      const insights = store.getInsights(req.params.name)
      closeDb(db)
      if (!insights) {
        res.status(404).json({ error: `Project not found: ${req.params.name}` })
        return
      }
      res.json(insights)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })
```

**Step 2: Build, restart, smoke test**

```bash
cd packages/codegraph && npm run build
# restart server
curl -sS http://localhost:8090/api/projects/terrae-mare/insights | python3 -m json.tool
# expected: { "sessionsPerWeek": [], "memoriesByType": {}, "topSkills": [], "avgConfidence": null, "daysSinceLastActivity": null, "totalSessions": 0, "totalMemories": 0 }
# (Empty arrays/null because the seed projects have no sessions/memories yet)
curl -sS http://localhost:8090/api/projects/does-not-exist/insights
# expected: HTTP 404
```

**Step 3: Commit**

```bash
git add packages/codegraph/src/mcp/routes/projects.ts
git commit -m "feat(api): GET /api/projects/:name/insights aggregate endpoint"
```

---

## Task 11: Frontend — migrate renderProjects to summary endpoint

**Files:**
- Modify: `packages/codegraph/public/js/render.js`

**Step 1: Update `renderProjects`**

Find the `renderProjects` function (around line 1079). The current body does:
```js
const [actData, metaData] = await Promise.all([
  api.get('/api/projects').catch(() => ({ projects: [] })),
  api.get('/api/projects-meta').catch(() => ({ projects: [] })),
])
// ... merge logic into `merged` with `_meta` field ...
```

Replace the parallel fetch + merge block (lines ~1085-1106) with:

```js
  const data = await api.get('/api/projects?summary=true').catch(() => ({ projects: [] }))
  const summary = data.projects || []

  // Reshape summary rows to the same shape consumers expect (_meta wrapper, lastSession info).
  // Keep backward compat with the rest of render.js which reads p._meta.{status, displayName, ...}
  // and p.lastSession.{date, status, blockers, nextSteps}.
  const merged = summary.map((s) => ({
    name: s.name,
    totalSessions: s.totalSessions,
    totalMemories: s.totalMemories,
    lastSession: s.lastActivity ? { date: s.lastActivity, status: s.status } : undefined,
    _meta: {
      name: s.name,
      displayName: s.displayName,
      clientName: s.clientName,
      category: s.category,
      status: s.status,
      stack: s.stack || [],
    },
    // New fields from summary — used by card v2 state borders
    _summary: {
      pinned: s.pinned,
      hasBlockers: s.hasBlockers,
      isStale: s.isStale,
    },
  }))
```

**Step 2: Hydrate state.pinned from summary**

In the same function, after the line `state.merged = merged`, add:

```js
  // Sync pinned set from server-authoritative summary
  state.pinned = new Set(merged.filter(p => p._summary?.pinned).map(p => p.name))
```

This replaces the localStorage source of truth.

**Step 3: Update `projectState` helper to prefer server `isStale`/`hasBlockers`**

Find `projectState(p)` (currently computes stale/setup/blocked client-side around line 626). Update the body to:

```js
function projectState(p) {
  const last = p.lastSession
  if (p._summary?.hasBlockers || last?.blockers) return 'blocked'
  if (!p._meta?.category) return 'setup'
  if (p._summary?.isStale ?? (last?.date && (Date.now() - new Date(last.date).getTime()) / 86400000 > 30) ?? p.totalSessions === 0) {
    return 'stale'
  }
  return ''
}
```

(Server-side `isStale` is now authoritative; client-side rule is the fallback for legacy callers.)

**Step 4: One-time localStorage→backend pin migration**

In `getProjectsState()` (around line 1005), at the end of the hydration block (right before `return getProjectsState`-returns / right before assignment to `window._projectsState`), add:

```js
    // Phase 2 migration: push legacy localStorage pins to backend then clear.
    // Fire-and-forget — UI doesn't block on this.
    const legacy = localStorage.getItem('synapse.projects.pinned')
    if (legacy) {
      try {
        const names = JSON.parse(legacy)
        if (Array.isArray(names) && names.length > 0) {
          fetch('/api/projects-meta/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names, action: 'pin' }),
            credentials: 'include',
          }).then(r => { if (r.ok) localStorage.removeItem('synapse.projects.pinned') })
        } else {
          localStorage.removeItem('synapse.projects.pinned')
        }
      } catch {
        localStorage.removeItem('synapse.projects.pinned')
      }
    }
```

**Step 5: Verify in browser**

```bash
# restart dashboard server
curl -sS 'http://localhost:8090/api/projects?summary=true' | python3 -m json.tool | head -30
# Should return the new summary shape with pinned/isStale.
```

Open `http://localhost:8090/#/projects`. Verify:
- Cards render the same as before (displayName, status dot, category icon, etc.)
- STALE badges appear on projects with no recent sessions
- Pin star reflects server state on load

`node --check packages/codegraph/public/js/render.js` must pass.

**Step 6: Commit**

```bash
git add packages/codegraph/public/js/render.js
git commit -m "feat(projects): migrate render to /api/projects?summary=true + server-side stale/pinned"
```

---

## Task 12: Frontend — toggleProjectPin via PATCH

**Files:**
- Modify: `packages/codegraph/public/app.js`

**Step 1: Replace localStorage pin with PATCH call**

Find `toggleProjectPin` (around line 472). Replace the existing body:

```js
async function toggleProjectPin(name) {
  const s = window._projectsState
  if (!s) return
  // Optimistic UI
  const wasPinned = s.pinned.has(name)
  if (wasPinned) s.pinned.delete(name); else s.pinned.add(name)
  applyProjectFiltersAndRender()
  // Persist via backend
  try {
    const r = await fetch(`/api/projects-meta/${encodeURIComponent(name)}/pin`, {
      method: 'PATCH',
      credentials: 'include',
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const { pinned } = await r.json()
    // Server is authoritative — reconcile state if optimistic guess was wrong
    if (pinned && !s.pinned.has(name)) s.pinned.add(name)
    else if (!pinned && s.pinned.has(name)) s.pinned.delete(name)
    applyProjectFiltersAndRender()
  } catch (err) {
    // Rollback
    if (wasPinned) s.pinned.add(name); else s.pinned.delete(name)
    applyProjectFiltersAndRender()
    alert('Pin failed: ' + (err.message || err))
  }
}
window.toggleProjectPin = toggleProjectPin
```

The function no longer writes to localStorage. The one-time migration (Task 11) clears any old key.

**Step 2: Verify in browser**

Click the star on any card → it should immediately turn yellow (optimistic) and persist after the fetch resolves. Refresh the page → the star state should survive.

Test via curl:
```bash
curl -sS -X PATCH http://localhost:8090/api/projects-meta/terrae-mare/pin
# expected: { "pinned": true/false }
```

**Step 3: Commit**

```bash
git add packages/codegraph/public/app.js
git commit -m "feat(projects): pin via PATCH endpoint with optimistic UI + rollback"
```

---

## Task 13: Frontend — bulk handlers via POST /bulk

**Files:**
- Modify: `packages/codegraph/public/app.js`

**Step 1: Rewrite bulkSetStatus + bulkArchive + bulkDelete**

Find the existing `bulkSetStatus` (around line 606). Replace the bulk block with:

```js
async function bulkSetStatus(status) {
  if (!status) return
  const s = window._projectsState
  if (!s) return
  const names = [...s.selection]
  if (names.length === 0) return
  if (!confirm(`Set status "${status}" on ${names.length} project${names.length>1?'s':''}?`)) return
  try {
    const r = await fetch('/api/projects-meta/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names, action: 'setStatus', value: status }),
      credentials: 'include',
    })
    const { ok, failed } = await r.json()
    s.selection.clear()
    if (failed?.length > 0) alert(`${failed.length} of ${names.length} updates failed; refreshing list.`)
    renderProjects()
  } catch (err) {
    alert('Bulk update failed: ' + (err.message || err))
  }
}

async function bulkArchive() {
  const s = window._projectsState
  if (!s) return
  const names = [...s.selection]
  if (names.length === 0) return
  if (!confirm(`Archive ${names.length} project${names.length>1?'s':''}?`)) return
  try {
    const r = await fetch('/api/projects-meta/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names, action: 'archive' }),
      credentials: 'include',
    })
    const { ok, failed } = await r.json()
    s.selection.clear()
    if (failed?.length > 0) alert(`${failed.length} of ${names.length} archives failed; refreshing list.`)
    renderProjects()
  } catch (err) {
    alert('Bulk archive failed: ' + (err.message || err))
  }
}

async function bulkDelete() {
  const s = window._projectsState
  if (!s) return
  const names = [...s.selection]
  if (names.length === 0) return
  if (!confirm(`Delete ${names.length} project${names.length>1?'s':''}? This removes their metadata records.`)) return
  try {
    const r = await fetch('/api/projects-meta/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names, action: 'delete' }),
      credentials: 'include',
    })
    const { ok, failed } = await r.json()
    s.selection.clear()
    if (failed?.length > 0) alert(`${failed.length} of ${names.length} deletes failed; refreshing list.`)
    renderProjects()
  } catch (err) {
    alert('Bulk delete failed: ' + (err.message || err))
  }
}
```

The `Promise.allSettled` iteration is gone — single network round-trip.

**Step 2: Verify in browser**

Select 2 cards → bulk toolbar appears → click Archive → confirm → after fetch, both move to archived status.

```bash
# Smoke from CLI:
curl -sS -X POST http://localhost:8090/api/projects-meta/bulk \
  -H "Content-Type: application/json" \
  -d '{"names":["terrae-mare","new-saas"],"action":"setStatus","value":"active"}'
# expected: { "ok": 2, "failed": [] }
```

**Step 3: Commit**

```bash
git add packages/codegraph/public/app.js
git commit -m "feat(projects): bulk handlers use single POST /bulk endpoint"
```

---

## Task 14: SVG chart helpers

**Files:**
- Modify: `packages/codegraph/public/js/render.js`
- Modify: `packages/codegraph/public/style.css`

**Step 1: Append CSS to `style.css`**

```css
/* Insights charts */
.proj-insights-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
.proj-insights-stat {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
}
.proj-insights-stat .label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.proj-insights-stat .value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.proj-chart {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 12px;
}
.proj-chart-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
  margin-bottom: 10px;
  font-weight: 600;
}
.proj-chart svg { display: block; width: 100%; height: auto; }
.proj-chart .bar { fill: var(--accent); transition: fill .15s; }
.proj-chart .bar:hover { fill: var(--accent2); }
.proj-chart .bar-label { fill: var(--text-dim); font-size: 10px; }
.proj-chart .bar-value { fill: var(--text); font-size: 10px; font-weight: 600; }
.proj-chart .axis { stroke: var(--border); stroke-width: 1; }
.proj-chart-empty {
  color: var(--text-muted);
  font-size: 12px;
  font-style: italic;
  padding: 12px 0;
  text-align: center;
}
```

**Step 2: Add chart helpers in `js/render.js`**

Add at the bottom of the Projects v2 block (just above the Insights branch — Task 15 places it):

```js
// ── Insights SVG chart helpers ──

const CHART_COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#f59e0b', '#f87171', '#ec4899', '#14b8a6', '#facc15']

function svgBarChart(data, opts = {}) {
  // data: [{ label, value }]
  if (!data || data.length === 0) return `<div class="proj-chart-empty">No data yet</div>`
  const W = 480, H = 160, PADX = 36, PADY = 24
  const max = Math.max(...data.map(d => d.value), 1)
  const barW = (W - PADX * 2) / data.length - 4
  const bars = data.map((d, i) => {
    const x = PADX + i * (barW + 4)
    const h = ((d.value / max) * (H - PADY * 2))
    const y = H - PADY - h
    return `
      <rect class="bar" x="${x}" y="${y}" width="${barW}" height="${h}" rx="2">
        <title>${escAttr(d.label)}: ${d.value}</title>
      </rect>
      <text class="bar-label" x="${x + barW / 2}" y="${H - 6}" text-anchor="middle">${escHtml(d.label.slice(-5))}</text>
      ${d.value > 0 ? `<text class="bar-value" x="${x + barW / 2}" y="${y - 4}" text-anchor="middle">${d.value}</text>` : ''}
    `
  }).join('')
  return `<svg viewBox="0 0 ${W} ${H}" aria-label="Bar chart">
    <line class="axis" x1="${PADX}" y1="${H - PADY}" x2="${W - PADX}" y2="${H - PADY}" />
    ${bars}
  </svg>`
}

function svgDonutChart(data, opts = {}) {
  // data: [{ label, value }]
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return `<div class="proj-chart-empty">No data yet</div>`
  const SIZE = 160, R = 60, IR = 38, CX = SIZE / 2, CY = SIZE / 2
  let angle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const sliceAngle = (d.value / total) * Math.PI * 2
    const x1 = CX + R * Math.cos(angle), y1 = CY + R * Math.sin(angle)
    const x2 = CX + R * Math.cos(angle + sliceAngle), y2 = CY + R * Math.sin(angle + sliceAngle)
    const ix1 = CX + IR * Math.cos(angle + sliceAngle), iy1 = CY + IR * Math.sin(angle + sliceAngle)
    const ix2 = CX + IR * Math.cos(angle), iy2 = CY + IR * Math.sin(angle)
    const largeArc = sliceAngle > Math.PI ? 1 : 0
    const color = CHART_COLORS[i % CHART_COLORS.length]
    const path = `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${IR} ${IR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`
    angle += sliceAngle
    return `<path d="${path}" fill="${color}"><title>${escAttr(d.label)}: ${d.value} (${Math.round(d.value / total * 100)}%)</title></path>`
  }).join('')
  const legend = data.map((d, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length]
    return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-dim)">
      <span style="display:inline-block;width:10px;height:10px;background:${color};border-radius:2px"></span>
      <span>${escHtml(d.label)}</span>
      <span style="color:var(--text-muted)">${d.value}</span>
    </div>`
  }).join('')
  return `<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
    <svg viewBox="0 0 ${SIZE} ${SIZE}" style="width:160px;height:160px" aria-label="Donut chart">${slices}</svg>
    <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:120px">${legend}</div>
  </div>`
}

function svgHBarChart(data, opts = {}) {
  // data: [{ label, value }] — sorted desc by caller
  if (!data || data.length === 0) return `<div class="proj-chart-empty">No data yet</div>`
  const W = 480, ROW_H = 22, PAD = 8
  const H = data.length * ROW_H + PAD * 2
  const max = Math.max(...data.map(d => d.value), 1)
  const LABEL_W = 110
  const BAR_AREA = W - LABEL_W - 40
  const rows = data.map((d, i) => {
    const y = PAD + i * ROW_H
    const w = (d.value / max) * BAR_AREA
    return `
      <text class="bar-label" x="${LABEL_W - 4}" y="${y + ROW_H / 2 + 3}" text-anchor="end">${escHtml(d.label)}</text>
      <rect class="bar" x="${LABEL_W}" y="${y + 3}" width="${w}" height="${ROW_H - 6}" rx="2">
        <title>${escAttr(d.label)}: ${d.value}</title>
      </rect>
      <text class="bar-value" x="${LABEL_W + w + 4}" y="${y + ROW_H / 2 + 3}">${d.value}</text>
    `
  }).join('')
  return `<svg viewBox="0 0 ${W} ${H}" aria-label="Horizontal bar chart">${rows}</svg>`
}
```

**Step 3: Build (no TS) + verify**

```bash
node --check packages/codegraph/public/js/render.js
# Should pass.
```

**Step 4: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/style.css
git commit -m "feat(projects): SVG bar/donut/hbar chart helpers for Insights tab"
```

---

## Task 15: Insights tab in detail panel

**Files:**
- Modify: `packages/codegraph/public/js/render.js`
- Modify: `packages/codegraph/public/app.js`

**Step 1: Add the Insights tab button**

Find `renderProjectDetail` (around line 1410). The current tabs row has 3 tabs (Overview/Env/Activity). Add a fourth right after Activity:

```js
        <button class="proj-tab" data-tab="insights" onclick="switchProjectTab('insights','${escAttr(name)}')" style="padding:8px 14px;background:none;border:none;color:var(--text-muted);border-bottom:2px solid transparent;font-size:13px;cursor:pointer">Insights</button>
```

**Step 2: Add the insights branch to `renderProjectTab`**

Find `renderProjectTab` (the env block is right after the overview block). Add a new branch after the activity branch:

```js
  if (tab === 'insights') {
    container.innerHTML = `<p style="color:var(--text-muted);font-size:13px">Loading insights…</p>`
    loadProjectInsights(name).catch(err => {
      container.innerHTML = `<p style="color:var(--red);font-size:13px">Failed to load insights: ${escHtml(err.message || err)}</p>`
    })
  }
```

**Step 3: Add `loadProjectInsights`**

Place this just below `renderActivityItem` (or wherever module-scope helpers live):

```js
async function loadProjectInsights(name) {
  const r = await api.get(`/api/projects/${encodeURIComponent(name)}/insights`)
  const container = document.getElementById('proj-tab-content')
  if (!container) return

  const summary = `
    <div class="proj-insights-summary">
      <div class="proj-insights-stat">
        <div class="label">Sessions</div>
        <div class="value">${r.totalSessions}</div>
      </div>
      <div class="proj-insights-stat">
        <div class="label">Memories</div>
        <div class="value">${r.totalMemories}</div>
      </div>
      <div class="proj-insights-stat">
        <div class="label">Avg confidence</div>
        <div class="value">${r.avgConfidence == null ? '—' : (r.avgConfidence * 100).toFixed(0) + '%'}</div>
      </div>
      <div class="proj-insights-stat">
        <div class="label">Last activity</div>
        <div class="value">${r.daysSinceLastActivity == null ? 'never' : r.daysSinceLastActivity + 'gg fa'}</div>
      </div>
    </div>
  `

  // Sessions per week — show last 12 weeks. If empty, render empty state.
  const sessionsChart = svgBarChart(r.sessionsPerWeek, {})

  // Memories by type — donut
  const memData = Object.entries(r.memoriesByType).map(([label, value]) => ({ label, value }))
  const memChart = svgDonutChart(memData, {})

  // Top skills — horizontal bar (already sorted desc by server)
  const skillsChart = svgHBarChart(r.topSkills, {})

  container.innerHTML = `
    ${summary}
    <div class="proj-chart">
      <div class="proj-chart-title">Sessions per week (last 12)</div>
      ${sessionsChart}
    </div>
    <div class="proj-chart">
      <div class="proj-chart-title">Memories by type</div>
      ${memChart}
    </div>
    <div class="proj-chart">
      <div class="proj-chart-title">Top skills (max 10)</div>
      ${skillsChart}
    </div>
  `
}
```

**Step 4: Verify in browser**

Open a project detail → click the Insights tab → 4 stat cards + 3 charts (probably mostly "No data yet" with the seeded test projects). Console no errors.

**Step 5: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js
git commit -m "feat(projects): Insights tab with sessions/week + memories/type + top skills"
```

---

## Task 16: Final polish + verify end-to-end

**Files:**
- Modify: `packages/codegraph/public/js/render.js` (cleanup)
- Modify: `packages/codegraph/public/app.js` (cleanup)

**Step 1: Remove now-dead code**

The localStorage `synapse.projects.pinned` write path is gone (Task 12 made the toggle async-PATCH). The hydration block in `getProjectsState` still tries to populate `def.pinned` from localStorage — leave it for one release as a fallback, but add a comment:

```js
    // Pinned now sourced from /api/projects?summary=true; localStorage read here is
    // a one-load fallback before the one-time migration in renderProjects fires.
    try {
      const raw = localStorage.getItem('synapse.projects.pinned')
      if (raw) def.pinned = new Set(JSON.parse(raw))
    } catch {
      localStorage.removeItem('synapse.projects.pinned')
    }
```

**Step 2: End-to-end verification (browser checklist)**

Start clean:
1. Restart server, navigate to `#/projects`.
2. **Card render**: ≥1 card has STALE badge (server-side `isStale`).
3. **Pin**: click ★ on a card. Network tab shows `PATCH /api/projects-meta/.../pin`. Star turns yellow. Reload page → still pinned.
4. **Bulk**: select 2 cards → bulk toolbar appears → "Set status… → Paused". Network tab shows ONE `POST /api/projects-meta/bulk`. After fetch, both cards move to paused.
5. **Kanban DnD**: drag a card to a new column. Currently still uses `PUT /api/projects-meta/:name` — that's fine, the new `PATCH /status` is a quick alternative that we'd switch to in a follow-up (NOT in scope here).
6. **Insights tab**: open any project detail → click Insights → 4 stat cards + 3 charts render. Empty-state messages on empty data.
7. **No console errors**.

**Step 3: Final commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js
git commit -m "chore(projects): phase 2 cleanup + transitional localStorage fallback comment"
```

---

## Riepilogo Phase 2

| # | Task | Output |
|---|---|---|
| 1 | DB migration + pinned column | `032_projects_pinned.sql`, Project interface updated |
| 2 | togglePin/setPin methods | ProjectsStore.togglePin + setPin |
| 3 | PATCH /pin route | API endpoint |
| 4 | PATCH /status route | API endpoint (enum validated) |
| 5 | bulkAction method | ProjectsStore.bulkAction (best-effort transactional) |
| 6 | POST /bulk route | API endpoint |
| 7 | listSummary method | Light join query + isStale server-side |
| 8 | GET ?summary=true | API endpoint (backward compat) |
| 9 | getInsights method | 5-query aggregator |
| 10 | GET /:name/insights route | API endpoint |
| 11 | renderProjects → summary fetch | Single fetch, state.pinned from server |
| 12 | toggleProjectPin → PATCH | Async + optimistic UI + rollback |
| 13 | bulk handlers → POST /bulk | Single fetch instead of Promise.allSettled |
| 14 | SVG chart helpers | svgBarChart/Donut/HBar |
| 15 | Insights tab UI | New tab with 4 stats + 3 charts |
| 16 | Polish + verify | Cleanup + end-to-end browser test |

## Note per l'esecutore

1. **Backend tasks (1-10)**: ogni commit richiede rebuild + restart server. Smoke test via curl prima del commit.
2. **Frontend tasks (11-16)**: refresh manuale browser dopo ogni save (`node --check` per syntax, browser per behavior).
3. **Errore comune**: dimenticare `npm run build` su `packages/storage` dopo aver toccato lo store → il binario in `packages/codegraph/dist` continua a usare la vecchia versione di `@skillbrain/storage`.
4. **Backward compat**: il vecchio `GET /api/projects-meta` resta intatto (usato dal'edit modal). Solo `GET /api/projects` aggiunge il caso `?summary=true`.
5. **No git push** senza esplicita richiesta dell'utente.
6. **`localStorage["synapse.projects.pinned"]`** viene migrato in fire-and-forget al primo load Phase 2; non rimuovere la hydration in `getProjectsState` per backward compat su client che non hanno ancora caricato la pagina.

## Execution Handoff

Plan completo e salvato in `docs/plans/2026-05-12-projects-phase2.md`. Due opzioni di esecuzione:

**1. Subagent-Driven (questa sessione)** — dispatch fresh subagent per ogni task, review tra i task, fast iteration. Stesso pattern di Fase 1.

**2. Parallel Session (separata)** — apri una nuova sessione con `superpowers:executing-plans`, esecuzione batch con checkpoint.

Quale approccio preferisci?
