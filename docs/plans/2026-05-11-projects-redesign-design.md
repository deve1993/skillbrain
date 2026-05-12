# Projects Redesign — Synapse dashboard, Fase 1

**Data**: 2026-05-11
**Scope**: redesign frontend della sezione Projects del dashboard Synapse (vanilla JS).
**Backend**: invariato — solo endpoint già esistenti.

## Obiettivo

Sostituire la vista lista flat di Projects con quattro viste (Grid, List, Kanban, Table) + filtri/sort/group/bulk/pin, detail panel a 2 colonne, edit modal a tab. Risolve 14 problemi UX elencati nello spec utente.

## Stack & vincoli

- Vanilla ES modules (import/export), nessun framework
- CSS variables esistenti riutilizzate (`--bg`, `--card`, `--accent`, `--green`, `--yellow`, `--red`, `--blue`, `--pink`)
- `main { max-width: 1200px }` confermato — Grid usa `repeat(auto-fill, minmax(340px,1fr))`
- Hash routing già attivo, esteso con query params (`#/projects?view=kanban&status=active`)
- Auth: tutti gli endpoint già protetti da cookie `sb_session`

## State management

Single source of truth in memoria:

```js
window._projectsState = {
  merged: [],        // tutti i progetti, dato grezzo
  filtered: [],      // dopo filtri/search/sort
  view: 'grid',      // grid | list | kanban | table
  filters: { status: [], category: [], client: [], stack: [], showArchived: false, search: '' },
  sort: 'lastActivity-desc',
  group: 'none',     // none | client | status | category
  pinned: new Set(), // project names
  selection: new Set(),
  detailIndex: -1    // posizione corrente nel filtered per prev/next
}
```

Persistenza:
- `localStorage["synapse.projects.view"]` → string
- `localStorage["synapse.projects.pinned"]` → JSON array
- `localStorage["synapse.projects.filters"]` → JSON (escludendo `selection`)
- URL hash → override su pageload (priorità: hash > localStorage > default)

## Flusso render

```
renderProjects()
 ├── fetch /api/projects + /api/projects-meta (parallelo)
 ├── merge in _state.merged
 ├── load pinned/view/filters da localStorage
 ├── override da hash params
 ├── apply filters → _state.filtered
 └── render shell:
     ├── header (title + view switcher pills + "+ New")
     ├── toolbar (search + filters + sort + group)
     ├── stats bar (clickable status segments)
     ├── pinned section (se _state.pinned.size > 0)
     ├── body (#proj-body) → renderProjectsBody()
     └── bulk toolbar (#proj-bulk, hidden se selection vuota)
```

`renderProjectsBody()` dispatcha su `_state.view`:
- `grid` → `renderGridView()`
- `list` → `renderListView()`
- `kanban` → `renderKanbanView()`
- `table` → `renderTableView()`

Cambio di filtro/sort/group → `applyProjectFilters()` ricalcola `filtered` → re-render solo `#proj-body` (toolbar e stats restano intatti, niente flash).

## Componenti chiave

### Card v2 (Grid view)

```
┌────────────────────────────────────┐
│ ★ ● Display Name        [↗] [⋯]  │   ← header: pin, status dot, name, live link, menu
│ 🛒 ecommerce · Cliente              │   ← category icon + category + cliente
│ ─────────────────────────────────  │
│ 12 sess · 28 mem · 2gg fa          │   ← stats compatte
│ ▌ Next: integrare Stripe webhook   │   ← next steps (verde) se presente
│ [Next] [Tailwind] [Supabase]       │   ← max 3 stack chips + "+N"
└────────────────────────────────────┘
```

State borders:
- `stale` → no sessions >30gg → border-top yellow + badge
- `setup` → no `_meta.category` → border-top blue + CTA
- `blocked` → `last.blockers` presente → border-top red + warning

### Card menu [⋯]

Dropdown con 4 azioni client-side:
- **Archive** → `PUT /api/projects-meta/:name { status: 'archived' }`
- **Duplicate** → prompt nuovo nome → `PUT /api/projects-meta/:newname { ...metaSenzaSessions }`
- **Export** → blob `application/json` + download del meta corrente
- **Delete** → `DELETE /api/projects-meta/:name` con confirm

### Kanban DnD

HTML5 native:
- `draggable="true"` su card
- `dragstart` → `dataTransfer.setData('text/plain', projectName)`
- `dragover` su colonna → `preventDefault()` + visual highlight
- `drop` → optimistic move + `PUT { status: newStatus }`; rollback DOM + alert su errore

### Detail prev/next

Header del detail panel: `[← prev]` `[next →]`. Ciclano in `_state.filtered` (non `merged`). `_state.detailIndex` aggiornato da `openProjectDetail`. Bottoni disabilitati su bordi.

### Edit modal a tab

Riscritta `openEditProjectModal`:
- header sticky con tabs: `[Identity*] [Team] [Links] [Infra] [Notes]`
- una sola sezione visibile alla volta (`hidden` attribute)
- pulsanti Save/Cancel sempre visibili a footer
- **Stack** diventa tag-input: input chip removable, Enter aggiunge, Backspace su empty rimuove ultimo
- Salvataggio identico (PUT con body completo come ora) — la serializzazione `stack[]` rimane invariata

### Bulk toolbar

Position fixed bottom-center, slide-up animation:
```
[N selected] [Set status ▼] [Set client ▼] [Archive] [Delete] [Cancel]
```
Tutte le azioni iterano fetch in parallelo con `Promise.all`. Spinner durante esecuzione. Conferma per Delete.

## URL hash schema

```
#/projects                                     → default view
#/projects?view=kanban                         → vista esplicita
#/projects?view=grid&status=active,paused      → filtri multipli
#/projects?view=table&sort=sessions-desc       → sort esplicito
#/projects?view=grid&group=client              → grouping
#/projects/<name>                              → apre detail (esistente, mantieni retro-compat)
```

`hashchange` listener mantenuto in app.js. Parsing query da `location.hash.split('?')[1]`.

## Empty state

3 CTA:
- `[+ New Project]` → `openNewProjectModal()` (esistente)
- `[📂 Import from folder]` → disabled con tooltip "Coming in Phase 2"
- `[📋 Browse templates]` → disabled con tooltip "Coming in Phase 2"

## File modificati

| File | Stima |
|---|---|
| `packages/codegraph/public/js/render.js` | +700 -120 |
| `packages/codegraph/public/js/modal.js` | +180 -70 |
| `packages/codegraph/public/app.js` | +120 |
| `packages/codegraph/public/style.css` | +400 |

## Fuori scope (Fase 2)

- Endpoint batch (bulk delete/update server-side)
- Persistenza server-side di pinned/view/filtri
- Vista "Insights" con charts
- Import from folder / Browse templates funzionanti
- Test automatici (il dashboard attuale non ne ha)

## Rollback

Se necessario:
- `git revert <commit-fase-1>` ripristina il vecchio render
- Nessun cambio schema DB → nessuna migrazione
- localStorage chiavi nuove (prefix `synapse.projects.`) → si possono pulire senza side-effects
