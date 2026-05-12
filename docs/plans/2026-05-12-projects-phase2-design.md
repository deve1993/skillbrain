# Projects Redesign — Phase 2 (Endpoints + Insights)

**Data**: 2026-05-12
**Scope**: aggiungere 5 endpoint server-side + tab Insights con chart SVG inline + migrazione pin da localStorage a DB + migrazione bulk ops a singolo POST server-side.
**Stack**: TypeScript + Express + better-sqlite3 + vanilla JS frontend con SVG inline.
**Premessa**: Fase 1 fully merged on `main` HEAD = `97ae181`.

## Obiettivi

1. Pin persistito server-side (multi-device, condiviso col team)
2. Bulk operations atomiche (single POST, no race condition client-side)
3. Endpoint `summary=true` light per scalabilità (preparato per >100 progetti)
4. Tab Insights nel detail panel con 3 chart SVG inline
5. Quick PATCH per status change (semantica più chiara di full PUT)

## Stack & vincoli

- Migrations: nuovi file SQL numerati in `packages/storage/src/migrations/` (next = `032_*`)
- Routes pattern: `mcp/routes/projects.ts` con `openDb`/`closeDb` per ogni handler
- Store pattern: estendere `ProjectsStore` in `packages/storage/src/projects-store.ts`
- Aggregati Insights: query SQLite su `session_log` + `memories` + opzionalmente `skill_usage`
- Charts: SVG inline custom, no librerie esterne (decisione confermata)
- Pin migration: one-time POST da localStorage al primo load Fase 2 (decisione confermata)
- Filter server-side: skip per Fase 2 (decisione confermata)

## Endpoint nuovi

### 1. `PATCH /api/projects-meta/:name/pin`
Toggle del flag pinned in DB.
- Body: `{}` (vuoto — toggle)
- Response: `{ pinned: boolean }`
- Lato store: nuovo metodo `togglePin(name): boolean` su `ProjectsStore`
- Migration: `ALTER TABLE projects ADD COLUMN pinned INTEGER DEFAULT 0 NOT NULL`

### 2. `PATCH /api/projects-meta/:name/status`
Quick status change con validazione enum.
- Body: `{ status: 'active'|'paused'|'completed'|'archived' }`
- Response: `{ status: <new>, project: <full sanitized> }`
- Lato store: riusa `upsert` ma valida `status` enum prima del PUT
- 400 se status non valido o body mancante

### 3. `POST /api/projects-meta/bulk`
Bulk operations atomiche.
- Body: `{ names: string[], action: 'archive'|'setStatus'|'setClient'|'delete'|'pin'|'unpin', value?: string }`
- Response: `{ ok: number, failed: { name: string, error: string }[] }`
- Lato store: nuovo metodo `bulkAction(action, names, value?): { ok, failed }` su `ProjectsStore`
- 400 se action non valido o names vuoto
- Best-effort: errori singoli non bloccano gli altri; ritorna sommario per UI

### 4. `GET /api/projects?summary=true`
Payload light per liste con >100 progetti.
- Query param: `?summary=true`
- Response: `{ projects: [{ name, displayName, status, category, clientName, totalSessions, totalMemories, lastActivity, stack, pinned, hasBlockers, isStale }] }`
- Lato store: nuovo metodo `listSummary(): SummaryProject[]` che join `projects` + `session_log` (count sessions, last lastSession) + `memories` (count) + computa `isStale` server-side (lastActivity > 30gg O 0 sessions)
- Senza query param resta comportamento attuale (full session-based list)
- `hasBlockers` = `EXISTS (SELECT 1 FROM session_log WHERE project=? AND blockers IS NOT NULL)`

### 5. `GET /api/projects/:name/insights`
Aggregati per la tab Insights.
- Path param: `:name`
- Response:
```json
{
  "sessionsPerWeek": [{ "week": "2026-W18", "count": 3 }, ...],
  "memoriesByType": { "BugFix": 4, "Decision": 7, "Pattern": 12, ... },
  "topSkills": [{ "name": "nextjs", "usage": 18 }, ... up to 10],
  "avgConfidence": 0.78,
  "daysSinceLastActivity": 5,
  "totalSessions": 24,
  "totalMemories": 31
}
```
- Lato store: nuovo metodo `getInsights(name): Insights` con 5-6 query aggregate
- `sessionsPerWeek` — `strftime('%Y-W%W', started_at)` su `session_log`, ultime 12 settimane
- `memoriesByType` — `GROUP BY type` su `memories WHERE project=?`
- `topSkills` — `GROUP BY skill_name ORDER BY count DESC LIMIT 10` su `skill_usage WHERE project=?` (fallback array vuoto se tabella inesistente)
- `avgConfidence` — `AVG(confidence)` su `memories WHERE project=? AND confidence IS NOT NULL`
- `daysSinceLastActivity` — `MAX(started_at)` su session_log diff oggi
- 404 se progetto non esiste

## Frontend changes

### Insights tab (detail panel)

Aggiunta nuova tab `[Insights]` in `renderProjectDetail` accanto a Overview/Env/Activity:

```js
<button class="proj-tab" data-tab="insights" onclick="switchProjectTab('insights','...')">Insights</button>
```

In `renderProjectTab`:
```js
if (tab === 'insights') {
  loadProjectInsights(name) // async fetch + render
  container.innerHTML = '<p>Loading insights…</p>'
}
```

`loadProjectInsights(name)`:
1. `GET /api/projects/:name/insights` → JSON
2. Render 3 chart in 3 `<div class="card">`:
   - **Sessions per week** (bar chart SVG)
   - **Memories by type** (donut chart SVG)
   - **Top skills** (horizontal bar chart SVG)
3. Plus summary row: `daysSinceLastActivity · avgConfidence · totalSessions · totalMemories`

Chart helpers (nuova section in render.js):
```js
function svgBarChart(data, opts) { /* {label, value}[] → <svg> */ }
function svgDonutChart(data, opts) { /* {label, value, color}[] → <svg> */ }
function svgHBarChart(data, opts) { /* {label, value}[] → <svg> horizontal */ }
```

Tutti ~30-40 righe ciascuno, SVG inline coerente col dark theme. Tooltip via `<title>` element nativo SVG.

### Pin migration (one-time)

In `getProjectsState()` (render.js), dopo l'hydration localStorage:
```js
// One-time migration: if there are localStorage pins, push them to backend then clear.
const pinsToMigrate = localStorage.getItem('synapse.projects.pinned')
if (pinsToMigrate) {
  try {
    const names = JSON.parse(pinsToMigrate)
    if (Array.isArray(names) && names.length > 0) {
      // Fire-and-forget POST; on success clear localStorage
      fetch('/api/projects-meta/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names, action: 'pin' }),
      }).then(r => { if (r.ok) localStorage.removeItem('synapse.projects.pinned') })
    } else {
      localStorage.removeItem('synapse.projects.pinned') // empty array — just clean
    }
  } catch {
    localStorage.removeItem('synapse.projects.pinned') // malformed — clean
  }
}
```

The state still tracks `state.pinned` (now driven by server data via the summary endpoint).

### Bulk migration

`bulkSetStatus`, `bulkArchive`, `bulkDelete` in `app.js` switch from iterating PUT/DELETE to single POST:

```js
async function bulkSetStatus(status) {
  // ...validation...
  const r = await fetch('/api/projects-meta/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names: [...s.selection], action: 'setStatus', value: status }),
  })
  const { ok, failed } = await r.json()
  // ...alert and refresh...
}
```

`toggleProjectPin` switches from localStorage write to single PATCH:
```js
async function toggleProjectPin(name) {
  const r = await fetch(`/api/projects-meta/${encodeURIComponent(name)}/pin`, { method: 'PATCH' })
  const { pinned } = await r.json()
  if (pinned) s.pinned.add(name); else s.pinned.delete(name)
  applyProjectFiltersAndRender()
}
```

### Summary endpoint adoption

`renderProjects` switches from `GET /api/projects` + `GET /api/projects-meta` (2 fetches + merge) to `GET /api/projects?summary=true` (1 fetch). The summary already includes the joined data we need for cards.

The full `/api/projects-meta/:name` is still used by the edit modal (needs all fields).

The `state.pinned` Set is now populated from `p.pinned` on each summary row instead of localStorage.

## Migrations

`packages/storage/src/migrations/032_projects_pinned.sql`:
```sql
ALTER TABLE projects ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_projects_pinned ON projects(pinned);
```

## File modificati (Fase 2)

| File | Modifica |
|---|---|
| `packages/storage/src/migrations/032_projects_pinned.sql` | NEW |
| `packages/storage/src/projects-store.ts` | +pinned field, +togglePin, +setPin (bulk), +listSummary, +getInsights, +bulkAction |
| `packages/codegraph/src/mcp/routes/projects.ts` | +5 route handlers |
| `packages/codegraph/public/js/render.js` | +Insights tab branch, +3 SVG chart helpers, +switch fetch summary |
| `packages/codegraph/public/app.js` | bulk → single POST, pin → PATCH, +loadProjectInsights, +one-time migration |
| `packages/codegraph/public/style.css` | +chart CSS rules |

## Fuori scope (Phase 3)

- Server-side filter via query params (`?status=active`)
- Caching Insights (memo per project, invalidato su session_end/memory_add)
- Real-time updates (WebSocket) per multi-device pin sync
- Login-based personalized pin (oggi è global pin, anche se in DB)

## Rollback plan

Se necessario:
- Migration `032` aggiunge solo una colonna con default 0 → safe revert
- Endpoint nuovi sono additive (no cambio API contract sui vecchi)
- Frontend si può tornare a usare `/api/projects-meta` + localStorage commitando un revert di `app.js`

## Stato di sicurezza

Tutti i nuovi endpoint richiedono auth via cookie `sb_session` (stesso middleware esistente). Validazione enum su `status`, sanitization su nomi progetti.
