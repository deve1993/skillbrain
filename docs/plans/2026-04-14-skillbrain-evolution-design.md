# SkillBrain Evolution — Design Document

> Ispirato da Spacebot.sh: adottare Memory Graph tipizzato, Hybrid Recall, Auto-Capture,
> Working Memory multi-livello, e deploy centralizzato su Coolify.

## Stato Attuale (Post Fasi 1-3)

### Cosa funziona ORA

| Componente | Stato | Dove |
|---|---|---|
| Memory Graph SQLite (8 tipi, 5 edge types) | ✅ Funzionante | `.codegraph/graph.db` tabelle `memories` + `memory_edges` |
| 13 learnings migrati da markdown | ✅ Migrato | `memories` table con FTS5 |
| 7 MCP tools (memory_add, search, query, load, add_edge, stats, decay) | ✅ Compilato | `packages/codegraph/dist/mcp/server.js` |
| MCP registrato in Claude Code | ✅ Configurato | `~/.claude.json` → `mcpServers.codegraph` |
| Dashboard con Memory Graph stats | ✅ Funzionante | `localhost:3737` — mostra 13 memorie, tipi, edges |
| Dockerfile monolite | ✅ Pronto | `packages/codegraph/Dockerfile` |
| Registry paths fixati | ✅ Corretto | `~/.codegraph/registry.json` |
| Post-commit auto-indexing | ✅ Attivo | `~/.config/skillbrain/hooks/post-commit` |
| SKILL.md aggiornati (v2.0) | ✅ Aggiornati | capture-learning, load-learnings, post-session-review |

### Cosa manca per Fasi 4-6

| Gap | Blocca | Soluzione |
|---|---|---|
| Dashboard path hardcoded → ora env var | ✅ Risolto | `SKILLBRAIN_ROOT` env var |
| Dashboard non daemonizzato | Fase 5 | Coolify gestisce il processo |
| MCP server non testato end-to-end da Claude Code | Fase 4 | Riavviare Claude Code per caricare MCP |
| Nessun health endpoint REST | Fase 5 | Aggiungere `/api/health` al dashboard |
| Nessun volume mount per SQLite in Docker | Fase 5 | Volume `/data` nel Dockerfile |
| Working Memory non implementato | Fase 4 | Script di context assembly |
| Cortex cross-session awareness | Fase 4 | Session log in SQLite |

---

## Fase 4: Cortex / Working Memory

### Obiettivo

All'avvio di ogni sessione, generare un **briefing contestuale** a 5 livelli
(ispirato al Cortex di Spacebot) che sostituisce il caricamento statico di CLAUDE.md.

### I 5 Livelli

#### Livello 1: Identity (GIA' ESISTE)
- `CLAUDE.md` + `AGENTS.md`
- Non cambia — resta il fondamento

#### Livello 2: Event Log (PARZIALE → COMPLETARE)
- **Cosa esiste**: `load_project_context.sh` carica versioni e branch
- **Cosa aggiungere**: ultimi 5 commit con messaggi, file modificati oggi
- **Implementazione**: estendere `load_project_context.sh`

```bash
# Aggiungere a load_project_context.sh:
echo "## Recent Activity"
git log --oneline -5
echo ""
echo "## Modified today"
git diff --name-only HEAD~5
```

#### Livello 3: Cross-session Activity (NUOVO)
- **Cosa fa**: mostra cosa e' successo nelle altre sessioni Claude Code
- **Implementazione**: nuova tabella SQLite `session_log`

```sql
CREATE TABLE IF NOT EXISTS session_log (
  id TEXT PRIMARY KEY,
  session_name TEXT NOT NULL,     -- "MASTER_Fullstack", "Mobile", etc.
  started_at TEXT NOT NULL,
  ended_at TEXT,
  summary TEXT,                    -- auto-generated
  memories_created INTEGER DEFAULT 0,
  memories_validated INTEGER DEFAULT 0,
  files_changed TEXT,              -- JSON array
  project TEXT
);
```

- All'avvio sessione: `SELECT * FROM session_log ORDER BY started_at DESC LIMIT 5`
- Produce: "Ieri nella sessione Mobile hai fixato 3 bug di navigazione"

#### Livello 4: Project Awareness (NUOVO)
- **Cosa fa**: stato live dei progetti in `Progetti/`
- **Implementazione**: script che controlla:
  - Ultimo deploy (data commit su main)
  - Build status (ultimo `npm run build` ok/fail)
  - Open issues (da CodeGraph `detect_changes`)
  - Dependencies outdated

#### Livello 5: Knowledge Synthesis (NUOVO)
- **Cosa fa**: briefing generato dai learnings piu' rilevanti per il task corrente
- **Implementazione**: gia' fatto! `memory_load` MCP tool fa esattamente questo
- **Integrazione**: `codegraph-context` SKILL.md chiama `memory_load` a inizio sessione

### File da modificare

| File | Modifica |
|---|---|
| `packages/codegraph/src/storage/memory-schema.ts` | Aggiungere tabella `session_log` |
| `packages/codegraph/src/storage/memory-store.ts` | Aggiungere metodi session log CRUD |
| `.opencode/scripts/load_project_context.sh` | Aggiungere livelli 2-4 |
| `.agents/skills/codegraph-context/SKILL.md` | Integrare 5-layer context assembly |

---

## Fase 5: Deploy su Coolify (Monolite)

### Architettura Container

```
┌─────────────────────────────────────┐
│  codegraph-service (Alpine)         │
│                                     │
│  ┌─────────────┐  ┌──────────────┐ │
│  │ Dashboard UI │  │ REST API     │ │
│  │ (HTML+JS)    │  │ /api/data    │ │
│  │              │  │ /api/health  │ │
│  └──────┬───────┘  └──────┬───────┘ │
│         │                  │         │
│  ┌──────┴──────────────────┴───────┐ │
│  │      SQLite (graph.db)          │ │
│  │  nodes + edges + memories +     │ │
│  │  memory_edges + session_log     │ │
│  └─────────────────────────────────┘ │
│                                     │
│  Volume: /data/.codegraph/          │
└─────────────────────────────────────┘
         │
    porta 3737 → codegraph.pixarts.eu
```

### Prerequisiti da implementare

1. **Health endpoint** `/api/health`:
```json
{"status": "ok", "memories": 13, "repos": 5, "uptime": 3600}
```

2. **Sync meccanismo**: come portare il `.codegraph/graph.db` locale nel container?
   - **Opzione A**: GitHub Action post-commit → upload DB → Coolify redeploy
   - **Opzione B**: rsync periodico da locale a server
   - **Opzione C (Recommended)**: Volume mount su Coolify + webhook che triggera `codegraph analyze` nel container

3. **Coolify config**:
   - Dominio: `codegraph.pixarts.eu`
   - SSL: Let's Encrypt auto
   - Porta: 3737
   - Volume: `/data` persistente
   - Health check: `/api/health`
   - Deploy trigger: GitHub webhook su push a main

### File da creare/modificare

| File | Azione |
|---|---|
| `packages/codegraph/Dockerfile` | ✅ GIA' CREATO |
| `packages/codegraph/.dockerignore` | ✅ GIA' CREATO |
| `packages/codegraph/src/dashboard/server.ts` | Aggiungere `/api/health` endpoint |
| `.github/workflows/deploy-codegraph.yml` | CI/CD → Coolify webhook |

### Health Endpoint (da aggiungere)

```typescript
// In server.ts, aggiungere prima del fallback HTML:
if (req.url === '/api/health') {
  const mg = getMemoryGraph()
  const repos = loadRegistry()
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    status: 'ok',
    memories: mg.total,
    repos: repos.length,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }))
  return
}
```

---

## Fase 6: Multi-platform Notify

### Architettura

```
Evento (deploy, learning, contradiction)
    │
    ├─→ n8n webhook (gia' esiste)
    │       ├─→ Telegram (gia' funziona)
    │       └─→ Email (gia' funziona)
    │
    └─→ NUOVO: Discord/Slack webhook diretto
            ├─→ Discord channel #skillbrain
            └─→ Slack channel #dev-notifications
```

### Eventi da notificare

| Evento | Canale | Priorita' |
|---|---|---|
| Deploy completato su Coolify | Telegram + Discord | Alta |
| Memory con confidence 8+ catturata | Telegram | Media |
| Contradizione rilevata nel Memory Graph | Telegram + Discord | Alta |
| Decay: N memorie passate a pending-review | Telegram (digest giornaliero) | Bassa |
| CodeGraph ha trovato breaking change | Discord | Alta |
| Cron fallito 3 volte (circuit breaker) | Telegram + Slack | Critica |

### Implementazione

1. **Discord webhook**: URL semplice, POST JSON con embed colorato
2. **Slack webhook**: Incoming webhook, Block Kit per formatting
3. **Circuit breaker**: contatore in SQLite, disable dopo 3 fail consecutivi

### File da modificare

| File | Modifica |
|---|---|
| `~/.config/skillbrain/notify.sh` | Aggiungere Discord/Slack webhook calls |
| `~/.config/skillbrain/.env` | Aggiungere `DISCORD_WEBHOOK_URL`, `SLACK_WEBHOOK_URL` |
| `packages/codegraph/src/storage/memory-schema.ts` | Aggiungere tabella `notifications` per circuit breaker |

---

## Ordine di Esecuzione Consigliato

```
1. [5 min] Aggiungere /api/health al dashboard           → pronto per Coolify
2. [15 min] Fase 4 livello 2-3: session_log + event log  → cross-session awareness
3. [20 min] Fase 5: deploy su Coolify                     → dashboard online
4. [10 min] Fase 4 livello 4: project awareness           → context arricchito
5. [10 min] Fase 6: Discord/Slack webhook                 → notifiche multi-platform
6. [5 min] Test end-to-end                                → tutto collegato
```

**Totale stimato: ~65 minuti di lavoro**

---

## Verifica Finale

- [ ] `codegraph.pixarts.eu` mostra il dashboard con Memory Graph
- [ ] `codegraph.pixarts.eu/api/health` risponde con status ok
- [ ] Da Claude Code: `memory_add` crea una memoria visibile nel dashboard
- [ ] Da Claude Code: `memory_search("auth")` trova memorie rilevanti
- [ ] Post-session review: `memory_decay` aggiorna confidence
- [ ] Deploy su Coolify → notifica Discord in <30s
- [ ] Cross-session: sessione B vede l'activity di sessione A
