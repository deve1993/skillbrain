# Projects Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sostituire la sezione Projects del dashboard Synapse con 4 viste (Grid/List/Kanban/Table) + filtri/sort/group/pin/bulk, detail panel a 2 colonne con prev/next, edit modal a tab e stack tag-input. Solo frontend — backend invariato.

**Architecture:** State centralizzato in `window._projectsState`, persistenza via localStorage + URL hash. Render dispatchato su `_state.view`. Modifica filtro → re-render solo del `#proj-body`, toolbar persiste. Tutte le mutazioni passano per gli endpoint esistenti `/api/projects-meta/:name` (PUT/DELETE) + iterazione client-side per bulk.

**Tech Stack:** Vanilla ES modules, HTML5 native drag-and-drop, CSS variables, hash routing. Nessuna nuova dipendenza.

**Working directory:** `/Users/dan/Desktop/progetti-web/MASTER_Fullstack session`

**No automated tests:** il dashboard non ha test infra. Ogni task termina con verifica manuale browser su `http://localhost:8090` (porta dashboard).

**Riferimenti spec:** vedi `docs/plans/2026-05-11-projects-redesign-design.md` per architettura completa.

---

## Convenzioni del plan

- Tutti i path sono relativi a `packages/codegraph/public/`
- Editor: usare tool `Edit` per modifiche puntuali, `Write` solo per file nuovi o rewrite massivi
- Ogni task termina con `git add` + commit con messaggio convenzionale
- **Verifica browser**: avviare `npm run dev` da `packages/codegraph/` (o `pnpm dev`) → apre dashboard su 8090. Hot reload non c'è — refresh manuale (Cmd-R)
- Login al dashboard: usare credenziali esistenti dell'utente
- Se la dev di codegraph non gira, da repo root: `cd packages/codegraph && npm run dev`

---

## Task 1: Foundation — state object + helpers

**Files:**
- Modify: `packages/codegraph/public/js/render.js` (sostituire `renderProjects` riga 593-688)
- Modify: `packages/codegraph/public/style.css` (append in fondo)
- Modify: `packages/codegraph/public/app.js` (export filterProjects → rimuovi, aggiungi handler nuovi)

**Step 1: Aggiungere blocco CSS variables/classes base** in fondo a `style.css`:

```css
/* ── Projects v2 — Foundation ────────────────────────────────── */

.proj-page-wrap { display: flex; flex-direction: column; gap: 12px; }

.proj-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.proj-view-switcher {
  display: inline-flex;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}
.proj-view-pill {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 5px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all .15s;
}
.proj-view-pill:hover { color: var(--text); }
.proj-view-pill.active {
  background: rgba(167,139,250,.12);
  color: var(--accent);
}

.proj-new-btn {
  padding: 7px 14px;
  border-radius: 6px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.proj-new-btn:hover { filter: brightness(1.1); }

#proj-body { min-height: 200px; }
```

**Step 2: Riscrivere `renderProjects` in `js/render.js`** (sostituire interamente riga 593-688):

```js
// ── Projects v2 ──

function getProjectsState() {
  if (!window._projectsState) {
    const def = {
      merged: [],
      filtered: [],
      view: 'grid',
      filters: { status: [], category: [], client: [], stack: [], showArchived: false, search: '' },
      sort: 'lastActivity-desc',
      group: 'none',
      pinned: new Set(),
      selection: new Set(),
      detailIndex: -1,
    }
    // Hydrate from localStorage
    try {
      const v = localStorage.getItem('synapse.projects.view')
      if (v) def.view = v
      const p = JSON.parse(localStorage.getItem('synapse.projects.pinned') || '[]')
      def.pinned = new Set(p)
      const f = JSON.parse(localStorage.getItem('synapse.projects.filters') || 'null')
      if (f) Object.assign(def.filters, f)
      const s = localStorage.getItem('synapse.projects.sort')
      if (s) def.sort = s
      const g = localStorage.getItem('synapse.projects.group')
      if (g) def.group = g
    } catch {}
    window._projectsState = def
  }
  return window._projectsState
}

function parseProjectsHashParams() {
  const hash = location.hash.slice(1)
  const qIdx = hash.indexOf('?')
  if (qIdx < 0) return {}
  const out = {}
  for (const part of hash.slice(qIdx + 1).split('&')) {
    const [k, v] = part.split('=')
    if (k && v !== undefined) out[decodeURIComponent(k)] = decodeURIComponent(v)
  }
  return out
}

function applyHashOverrides(state) {
  const p = parseProjectsHashParams()
  if (p.view) state.view = p.view
  if (p.status) state.filters.status = p.status.split(',').filter(Boolean)
  if (p.category) state.filters.category = p.category.split(',').filter(Boolean)
  if (p.client) state.filters.client = p.client.split(',').filter(Boolean)
  if (p.stack) state.filters.stack = p.stack.split(',').filter(Boolean)
  if (p.sort) state.sort = p.sort
  if (p.group) state.group = p.group
  if (p.showArchived) state.filters.showArchived = p.showArchived === '1'
}

export async function renderProjects() {
  const [actData, metaData] = await Promise.all([
    api.get('/api/projects').catch(() => ({ projects: [] })),
    api.get('/api/projects-meta').catch(() => ({ projects: [] })),
  ])
  const actList = actData.projects || []
  const metaList = metaData.projects || []

  const metaMap = {}
  for (const m of metaList) metaMap[m.name.toLowerCase()] = m

  const merged = []
  const seen = new Set()
  for (const p of actList) {
    const key = p.name.toLowerCase()
    seen.add(key)
    const m = metaMap[key] || {}
    merged.push({ ...p, _meta: m })
  }
  for (const m of metaList) {
    const key = m.name.toLowerCase()
    if (!seen.has(key)) merged.push({ name: m.name, totalSessions: 0, totalMemories: 0, _meta: m })
  }

  const state = getProjectsState()
  state.merged = merged
  applyHashOverrides(state)
  applyProjectFilters() // computes state.filtered

  document.getElementById('page').innerHTML = `
    <div class="proj-page-wrap">
      <div class="proj-header">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="section-title" style="margin:0">Projects <span class="count" style="font-size:12px;font-weight:400;color:var(--text-muted)">${merged.length}</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="proj-view-switcher" role="tablist" aria-label="View switcher">
            ${renderViewPill('grid', '▦', 'Grid', state.view)}
            ${renderViewPill('list', '⊟', 'List', state.view)}
            ${renderViewPill('kanban', '☰', 'Kanban', state.view)}
            ${renderViewPill('table', '▭', 'Table', state.view)}
          </div>
          <button class="proj-new-btn" onclick="openNewProjectModal()">+ New Project</button>
        </div>
      </div>

      <div id="proj-toolbar"></div>
      <div id="proj-stats"></div>
      <div id="proj-pinned"></div>
      <div id="proj-body"></div>
      <div id="proj-bulk"></div>
    </div>
  `

  // Toolbar/stats/pinned/body all rendered in subsequent tasks.
  // For now, show a placeholder body so we can verify the shell renders.
  document.getElementById('proj-body').innerHTML = `
    <p style="color:var(--text-muted);font-size:13px;padding:20px;text-align:center">
      ${merged.length === 0 ? 'No projects yet.' : `${merged.length} projects loaded — view "${state.view}" coming in next tasks`}
    </p>
  `
  // Expose merged for legacy callers
  window._projectsList = merged
}

function renderViewPill(view, icon, label, current) {
  const active = view === current
  return `<button class="proj-view-pill ${active ? 'active' : ''}" role="tab" aria-selected="${active}"
    onclick="changeProjectView('${view}')">${icon} <span>${label}</span></button>`
}

// Compute filtered list from state.merged. Placeholder for now — full impl in Task 2.
export function applyProjectFilters() {
  const s = getProjectsState()
  s.filtered = s.merged.slice()
}
```

**Step 3: Aggiungere handlers globali in `app.js`** (sotto la sezione "Project list helpers", riga ~345):

```js
// ── Projects v2 — handlers ──
import { applyProjectFilters as _applyProjectFilters } from './js/render.js'

function changeProjectView(view) {
  const s = window._projectsState
  if (!s) return
  s.view = view
  localStorage.setItem('synapse.projects.view', view)
  renderProjects()
}
window.changeProjectView = changeProjectView
window.applyProjectFilters = _applyProjectFilters
```

Nota: l'`import` va aggiunto al blocco import esistente in cima al file (riga 12-23), aggiungendo `applyProjectFilters` alla lista importata da `./js/render.js`.

**Step 4: Rimuovere la vecchia `filterProjects` da `app.js`** (riga 345-352):
La sostituiremo nel Task 2. Per ora commenta o lasciala (verrà sostituita dalla nuova). Lasciare.

**Step 5: Verifica browser**

```bash
cd packages/codegraph
npm run dev
```

Apri `http://localhost:8090/#/projects`. Verifica:
- Header mostra titolo + count + switcher 4 pills + "+ New Project"
- Switcher: click sulle pills cambia `view` in state (`window._projectsState.view`) e persiste in localStorage
- Body mostra "N projects loaded — view 'X' coming in next tasks"
- Hash con `#/projects?view=table` apre con tab Table attiva

Console DevTools:
```js
window._projectsState  // deve esistere, con view/filters/pinned popolati
```

**Step 6: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): foundation state + view switcher pills"
```

---

## Task 2: Toolbar — filters, sort, group, search

**Files:**
- Modify: `js/render.js` (aggiungere `renderProjectsToolbar`, completare `applyProjectFilters`)
- Modify: `style.css` (append)
- Modify: `app.js` (handlers per dropdown e search)

**Step 1: CSS toolbar in `style.css`** (append):

```css
.proj-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.proj-toolbar input[type="search"] {
  flex: 1 1 220px;
  min-width: 180px;
  padding: 7px 10px;
  background: #111118;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
  outline: none;
}
.proj-toolbar input[type="search"]:focus { border-color: var(--accent2); }

.proj-filter-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: #111118;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-dim);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}
.proj-filter-pill:hover { border-color: var(--border-hover); color: var(--text); }
.proj-filter-pill.has-value { border-color: var(--accent2); color: var(--accent); background: rgba(99,102,241,.06); }
.proj-filter-pill .chev { opacity: .5; font-size: 10px; margin-left: 2px; }
.proj-filter-pill .badge-n {
  background: var(--accent);
  color: #0e0e16;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 8px;
  margin-left: 4px;
}

.proj-filter-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 30;
  background: #111118;
  border: 1px solid var(--border-hover);
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0,0,0,.5);
  min-width: 200px;
  max-height: 260px;
  overflow-y: auto;
  padding: 4px;
  display: none;
}
.proj-filter-pill.open .proj-filter-menu { display: block; }
.proj-filter-menu label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
  border-radius: 4px;
}
.proj-filter-menu label:hover { background: rgba(255,255,255,.04); }
.proj-filter-menu label input { accent-color: var(--accent); }
.proj-filter-menu .menu-header {
  padding: 4px 8px;
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.proj-filter-menu .menu-footer {
  border-top: 1px solid var(--border);
  margin-top: 4px;
  padding-top: 4px;
}
.proj-filter-menu .menu-footer button {
  width: 100%;
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  text-align: left;
}
.proj-filter-menu .menu-footer button:hover { background: rgba(255,255,255,.04); color: var(--text); }

.proj-toolbar select {
  background: #111118;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 12px;
  padding: 6px 8px;
  cursor: pointer;
  outline: none;
}
.proj-toolbar select:focus { border-color: var(--accent2); }

.proj-toolbar-clear {
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.proj-toolbar-clear:hover { color: var(--red); border-color: rgba(248,113,113,.3); }
```

**Step 2: Aggiungere a `js/render.js`** dopo `renderViewPill`:

```js
function uniqueFromMerged(field) {
  const s = window._projectsState
  if (!s) return []
  const set = new Set()
  for (const p of s.merged) {
    const v = field === 'stack'
      ? (p._meta?.stack || [])
      : [p._meta?.[field] || p[field]]
    for (const x of v) if (x) set.add(x)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

function statusOptions() { return ['active', 'paused', 'completed', 'archived'] }
function categoryOptions() { return uniqueFromMerged('category') }
function clientOptions() { return uniqueFromMerged('clientName') }
function stackOptions() { return uniqueFromMerged('stack') }

function renderFilterPill(key, label, options, selected) {
  const n = selected.length
  return `
    <div class="proj-filter-pill ${n > 0 ? 'has-value' : ''}" data-filter="${key}">
      <span onclick="toggleProjectFilter('${key}')">${label}${n > 0 ? `<span class="badge-n">${n}</span>` : ''} <span class="chev">▾</span></span>
      <div class="proj-filter-menu" onclick="event.stopPropagation()">
        <div class="menu-header">${label}</div>
        ${options.length === 0
          ? `<div class="menu-header" style="color:var(--text-muted)">No options</div>`
          : options.map(o => `
              <label>
                <input type="checkbox" value="${escHtml(o)}" ${selected.includes(o) ? 'checked' : ''}
                  onchange="updateProjectFilter('${key}', this.value, this.checked)">
                <span>${escHtml(o)}</span>
              </label>`).join('')}
        ${n > 0 ? `<div class="menu-footer"><button onclick="clearProjectFilter('${key}')">Clear ${label}</button></div>` : ''}
      </div>
    </div>`
}

function renderProjectsToolbar() {
  const s = getProjectsState()
  const el = document.getElementById('proj-toolbar')
  if (!el) return
  const hasAny = s.filters.status.length || s.filters.category.length ||
                 s.filters.client.length || s.filters.stack.length ||
                 s.filters.search || s.filters.showArchived

  el.className = 'proj-toolbar'
  el.innerHTML = `
    <input type="search" placeholder="Search projects..." value="${escHtml(s.filters.search)}"
      oninput="updateProjectSearch(this.value)" autocomplete="off">
    ${renderFilterPill('status', 'Status', statusOptions(), s.filters.status)}
    ${renderFilterPill('category', 'Category', categoryOptions(), s.filters.category)}
    ${renderFilterPill('client', 'Client', clientOptions(), s.filters.client)}
    ${renderFilterPill('stack', 'Stack', stackOptions(), s.filters.stack)}
    <select onchange="changeProjectSort(this.value)" title="Sort by">
      <option value="lastActivity-desc" ${s.sort === 'lastActivity-desc' ? 'selected' : ''}>Last activity ↓</option>
      <option value="name-asc" ${s.sort === 'name-asc' ? 'selected' : ''}>Name A→Z</option>
      <option value="status-asc" ${s.sort === 'status-asc' ? 'selected' : ''}>Status</option>
      <option value="sessions-desc" ${s.sort === 'sessions-desc' ? 'selected' : ''}>Sessions ↓</option>
      <option value="created-desc" ${s.sort === 'created-desc' ? 'selected' : ''}>Created ↓</option>
    </select>
    <select onchange="changeProjectGroup(this.value)" title="Group by">
      <option value="none" ${s.group === 'none' ? 'selected' : ''}>No group</option>
      <option value="client" ${s.group === 'client' ? 'selected' : ''}>Group: Client</option>
      <option value="status" ${s.group === 'status' ? 'selected' : ''}>Group: Status</option>
      <option value="category" ${s.group === 'category' ? 'selected' : ''}>Group: Category</option>
    </select>
    <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-dim);cursor:pointer">
      <input type="checkbox" ${s.filters.showArchived ? 'checked' : ''} onchange="toggleShowArchived(this.checked)">
      Show archived
    </label>
    ${hasAny ? `<button class="proj-toolbar-clear" onclick="clearAllProjectFilters()">✕ Clear filters</button>` : ''}
  `
}
```

**Step 3: Sostituire `applyProjectFilters` con la versione completa**:

```js
export function applyProjectFilters() {
  const s = getProjectsState()
  const f = s.filters
  const q = (f.search || '').toLowerCase().trim()

  let out = s.merged.slice()

  // Show archived toggle
  if (!f.showArchived) {
    out = out.filter(p => (p._meta?.status || p.lastSession?.status) !== 'archived')
  }

  // Filter: status
  if (f.status.length) {
    out = out.filter(p => f.status.includes(p._meta?.status || p.lastSession?.status || ''))
  }
  // Filter: category
  if (f.category.length) {
    out = out.filter(p => f.category.includes(p._meta?.category || ''))
  }
  // Filter: client
  if (f.client.length) {
    out = out.filter(p => f.client.includes(p._meta?.clientName || ''))
  }
  // Filter: stack (any-match)
  if (f.stack.length) {
    out = out.filter(p => {
      const stk = p._meta?.stack || []
      return f.stack.some(s => stk.includes(s))
    })
  }
  // Search
  if (q) {
    out = out.filter(p => {
      const hay = `${p._meta?.displayName || ''} ${p.name} ${p._meta?.clientName || ''} ${p._meta?.category || ''} ${(p._meta?.stack || []).join(' ')}`
      return hay.toLowerCase().includes(q)
    })
  }

  // Sort
  const [field, dir] = s.sort.split('-')
  const mul = dir === 'desc' ? -1 : 1
  out.sort((a, b) => {
    let av, bv
    if (field === 'name') { av = (a._meta?.displayName || a.name).toLowerCase(); bv = (b._meta?.displayName || b.name).toLowerCase() }
    else if (field === 'status') {
      const order = { active:0, paused:1, completed:2, archived:3 }
      av = order[a._meta?.status || a.lastSession?.status] ?? 9
      bv = order[b._meta?.status || b.lastSession?.status] ?? 9
    }
    else if (field === 'sessions') { av = a.totalSessions || 0; bv = b.totalSessions || 0 }
    else if (field === 'created') { av = a._meta?.createdAt || ''; bv = b._meta?.createdAt || '' }
    else /* lastActivity */ { av = a.lastSession?.date || ''; bv = b.lastSession?.date || '' }
    return av < bv ? -1*mul : av > bv ? 1*mul : 0
  })

  s.filtered = out
  syncProjectHash()
}

function syncProjectHash() {
  const s = window._projectsState
  if (!s) return
  // Build query string from non-default state
  const parts = []
  if (s.view !== 'grid') parts.push(`view=${s.view}`)
  if (s.filters.status.length) parts.push(`status=${s.filters.status.join(',')}`)
  if (s.filters.category.length) parts.push(`category=${s.filters.category.join(',')}`)
  if (s.filters.client.length) parts.push(`client=${s.filters.client.join(',')}`)
  if (s.filters.stack.length) parts.push(`stack=${s.filters.stack.join(',')}`)
  if (s.sort !== 'lastActivity-desc') parts.push(`sort=${s.sort}`)
  if (s.group !== 'none') parts.push(`group=${s.group}`)
  if (s.filters.showArchived) parts.push('showArchived=1')
  const q = parts.length ? '?' + parts.join('&') : ''
  const newHash = '#/projects' + q
  if (location.hash !== newHash && location.hash.startsWith('#/projects')) {
    history.replaceState(null, '', newHash)
  }
  // Persist filters
  localStorage.setItem('synapse.projects.filters', JSON.stringify(s.filters))
  localStorage.setItem('synapse.projects.sort', s.sort)
  localStorage.setItem('synapse.projects.group', s.group)
}
```

**Step 4: In `renderProjects`** (Task 1), dopo `applyProjectFilters()` aggiungere:

```js
  renderProjectsToolbar()
```

**Step 5: Handlers in `app.js`** (dopo i blocchi del Task 1):

```js
function toggleProjectFilter(key) {
  // Close all other menus first
  document.querySelectorAll('.proj-filter-pill.open').forEach(p => {
    if (p.dataset.filter !== key) p.classList.remove('open')
  })
  const el = document.querySelector(`.proj-filter-pill[data-filter="${key}"]`)
  if (el) el.classList.toggle('open')
}

function updateProjectFilter(key, value, checked) {
  const s = window._projectsState
  if (!s) return
  const arr = s.filters[key]
  if (checked) { if (!arr.includes(value)) arr.push(value) }
  else { s.filters[key] = arr.filter(v => v !== value) }
  applyProjectFiltersAndRender()
}

function clearProjectFilter(key) {
  const s = window._projectsState
  if (!s) return
  s.filters[key] = []
  applyProjectFiltersAndRender()
  document.querySelector(`.proj-filter-pill[data-filter="${key}"]`)?.classList.remove('open')
}

function clearAllProjectFilters() {
  const s = window._projectsState
  if (!s) return
  s.filters = { status: [], category: [], client: [], stack: [], showArchived: false, search: '' }
  applyProjectFiltersAndRender()
}

function updateProjectSearch(q) {
  const s = window._projectsState
  if (!s) return
  s.filters.search = q
  applyProjectFiltersAndRender()
}

function changeProjectSort(v) {
  const s = window._projectsState
  if (!s) return
  s.sort = v
  applyProjectFiltersAndRender()
}

function changeProjectGroup(v) {
  const s = window._projectsState
  if (!s) return
  s.group = v
  applyProjectFiltersAndRender()
}

function toggleShowArchived(v) {
  const s = window._projectsState
  if (!s) return
  s.filters.showArchived = v
  applyProjectFiltersAndRender()
}

// Apply filters then re-render only toolbar + body
function applyProjectFiltersAndRender() {
  window.applyProjectFilters()
  // Re-render toolbar (counts) and body (data); leave stats/pinned to their tasks
  const r = window._renderProjectsToolbar
  if (typeof r === 'function') r()
  renderProjectsBodyPlaceholder()
}

function renderProjectsBodyPlaceholder() {
  const s = window._projectsState
  const el = document.getElementById('proj-body')
  if (!el || !s) return
  el.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:20px;text-align:center">
    ${s.filtered.length} of ${s.merged.length} shown — view "${s.view}"</p>`
}

// Close menus on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.proj-filter-pill')) {
    document.querySelectorAll('.proj-filter-pill.open').forEach(p => p.classList.remove('open'))
  }
})

window.toggleProjectFilter = toggleProjectFilter
window.updateProjectFilter = updateProjectFilter
window.clearProjectFilter = clearProjectFilter
window.clearAllProjectFilters = clearAllProjectFilters
window.updateProjectSearch = updateProjectSearch
window.changeProjectSort = changeProjectSort
window.changeProjectGroup = changeProjectGroup
window.toggleShowArchived = toggleShowArchived
```

**Step 6: Export `renderProjectsToolbar`** da render.js per renderlo accessibile in app.js. In fondo a `renderProjects` body aggiungi:

```js
  window._renderProjectsToolbar = renderProjectsToolbar
```

**Step 7: Verifica browser**
- Toolbar visibile sotto header con search, 4 pills (Status/Category/Client/Stack), 2 select (Sort/Group), checkbox archive
- Click su una pill apre dropdown con opzioni (chiudere click outside)
- Selezionare un filtro → badge numerico sulla pill + URL hash si aggiorna
- Refresh pagina → filtri persistono (localStorage)
- Search nel campo → body placeholder mostra `N of M shown`
- `Clear filters` appare se almeno un filtro attivo, e resetta tutto

**Step 8: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): toolbar with multi-select filters, sort, group, search, hash sync"
```

---

## Task 3: Stats bar

**Files:**
- Modify: `js/render.js`
- Modify: `style.css`
- Modify: `app.js`

**Step 1: CSS** (append):

```css
.proj-stats-bar {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 4px 0;
  font-size: 12px;
}
.proj-stats-segment {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-dim);
  cursor: pointer;
  transition: all .15s;
}
.proj-stats-segment:hover { color: var(--text); border-color: var(--border-hover); }
.proj-stats-segment.active { background: rgba(167,139,250,.10); border-color: var(--accent2); color: var(--accent); }
.proj-stats-segment .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.proj-stats-segment .n { font-weight: 600; }
.proj-stats-segment.stat-active .dot { background: var(--green); }
.proj-stats-segment.stat-paused .dot { background: var(--yellow); }
.proj-stats-segment.stat-completed .dot { background: var(--blue); }
.proj-stats-segment.stat-archived .dot { background: var(--text-muted); }
```

**Step 2: render.js** — funzione `renderProjectsStats`:

```js
function renderProjectsStats() {
  const s = getProjectsState()
  const el = document.getElementById('proj-stats')
  if (!el) return
  const counts = { active: 0, paused: 0, completed: 0, archived: 0 }
  for (const p of s.merged) {
    const st = p._meta?.status || p.lastSession?.status
    if (counts[st] !== undefined) counts[st]++
  }
  const segs = [
    { key: 'active', label: 'active', icon: '●' },
    { key: 'paused', label: 'paused', icon: '◐' },
    { key: 'completed', label: 'completed', icon: '✓' },
    { key: 'archived', label: 'archived', icon: '⊘' },
  ]
  el.className = 'proj-stats-bar'
  el.innerHTML = segs.map(seg => {
    const isActive = s.filters.status.includes(seg.key)
    return `<button class="proj-stats-segment stat-${seg.key} ${isActive ? 'active' : ''}"
      onclick="toggleStatusFromStats('${seg.key}')" title="Filter by ${seg.label}">
      <span class="dot"></span>
      <span class="n">${counts[seg.key]}</span>
      <span>${seg.label}</span>
    </button>`
  }).join('')
}
```

**Step 3: In `renderProjects`** aggiungere chiamata dopo `renderProjectsToolbar()`:

```js
  renderProjectsStats()
  window._renderProjectsStats = renderProjectsStats
```

**Step 4: app.js** handler:

```js
function toggleStatusFromStats(status) {
  const s = window._projectsState
  if (!s) return
  const idx = s.filters.status.indexOf(status)
  if (idx >= 0) s.filters.status.splice(idx, 1)
  else s.filters.status.push(status)
  applyProjectFiltersAndRender()
}
window.toggleStatusFromStats = toggleStatusFromStats
```

**Step 5: Aggiornare `applyProjectFiltersAndRender`** per re-renderizzare anche stats:

```js
function applyProjectFiltersAndRender() {
  window.applyProjectFilters()
  if (typeof window._renderProjectsToolbar === 'function') window._renderProjectsToolbar()
  if (typeof window._renderProjectsStats === 'function') window._renderProjectsStats()
  renderProjectsBodyPlaceholder()
}
```

**Step 6: Verifica browser**
- Stats bar visibile sotto toolbar con 4 segmenti colorati
- Conteggi corretti (incrociare con `window._projectsState.merged.filter(p => p._meta?.status === 'active').length`)
- Click su segmento → toggle filtro status, badge appare su pill Status
- Segmento attivo evidenziato

**Step 7: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): stats bar with clickable status segments"
```

---

## Task 4: Pin + Pinned section

**Files:**
- Modify: `js/render.js`
- Modify: `style.css`
- Modify: `app.js`

**Step 1: CSS**:

```css
.proj-pinned-section {
  background: linear-gradient(180deg, rgba(167,139,250,.04), transparent);
  border: 1px solid rgba(167,139,250,.18);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 4px;
}
.proj-pinned-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: var(--accent);
  margin-bottom: 10px;
  font-weight: 600;
}
.proj-pinned-section-title .star { color: var(--yellow); }

.proj-card-pin {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 2px;
  line-height: 1;
  transition: color .15s;
}
.proj-card-pin:hover { color: var(--yellow); }
.proj-card-pin.pinned { color: var(--yellow); }
```

**Step 2: render.js** — funzione `renderProjectsPinned`:

```js
function renderProjectsPinned() {
  const s = getProjectsState()
  const el = document.getElementById('proj-pinned')
  if (!el) return
  const pinnedList = s.filtered.filter(p => s.pinned.has(p.name))
  if (pinnedList.length === 0) { el.innerHTML = ''; return }
  el.innerHTML = `
    <div class="proj-pinned-section">
      <div class="proj-pinned-section-title"><span class="star">★</span> Pinned (${pinnedList.length})</div>
      <div id="proj-pinned-cards"></div>
    </div>
  `
  // Render the pinned cards using current view's renderer (Task 5+)
  // For now placeholder:
  const cards = document.getElementById('proj-pinned-cards')
  if (cards) cards.innerHTML = pinnedList.map(p => `<div style="padding:4px 0;font-size:13px">★ ${escHtml(p._meta?.displayName || p.name)}</div>`).join('')
}
```

**Step 3: In `renderProjects`** chiamare:

```js
  renderProjectsPinned()
  window._renderProjectsPinned = renderProjectsPinned
```

**Step 4: app.js** handler:

```js
function toggleProjectPin(name) {
  const s = window._projectsState
  if (!s) return
  if (s.pinned.has(name)) s.pinned.delete(name)
  else s.pinned.add(name)
  localStorage.setItem('synapse.projects.pinned', JSON.stringify([...s.pinned]))
  applyProjectFiltersAndRender()
}
window.toggleProjectPin = toggleProjectPin
```

**Step 5: Aggiornare `applyProjectFiltersAndRender`**:

```js
function applyProjectFiltersAndRender() {
  window.applyProjectFilters()
  if (typeof window._renderProjectsToolbar === 'function') window._renderProjectsToolbar()
  if (typeof window._renderProjectsStats === 'function') window._renderProjectsStats()
  if (typeof window._renderProjectsPinned === 'function') window._renderProjectsPinned()
  renderProjectsBodyPlaceholder()
}
```

**Step 6: Test rapido via console**:
```js
toggleProjectPin('terrae-e-mare') // o nome di un progetto esistente
```
La pinned section appare con il progetto. Stessa chiamata lo rimuove.

**Step 7: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): pinned section + localStorage persistence"
```

---

## Task 5: Card v2 + Grid view

**Files:**
- Modify: `js/render.js`
- Modify: `style.css`

**Step 1: CSS card v2**:

```css
/* Grid view */
.proj-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
}

.proj-card-v2 {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  cursor: pointer;
  transition: border-color .15s, transform .15s;
  border-top-width: 3px;
}
.proj-card-v2:hover {
  border-color: var(--border-hover);
  transform: translateY(-1px);
}
.proj-card-v2.selected {
  border-color: var(--accent);
  background: rgba(167,139,250,.04);
}

.proj-card-v2.state-stale { border-top-color: var(--yellow); }
.proj-card-v2.state-setup { border-top-color: var(--blue); }
.proj-card-v2.state-blocked { border-top-color: var(--red); }

.proj-card-row1 {
  display: flex;
  align-items: center;
  gap: 6px;
}
.proj-card-row1 .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.proj-card-row1 .name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.proj-card-row1 a.live, .proj-card-row1 .menu-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
  border-radius: 4px;
  text-decoration: none;
  line-height: 1;
}
.proj-card-row1 a.live:hover, .proj-card-row1 .menu-btn:hover {
  color: var(--accent);
  background: rgba(167,139,250,.08);
}

.proj-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.proj-card-meta .cat-icon { font-size: 13px; }
.proj-card-meta .sep { opacity: .4; }

.proj-card-stats {
  font-size: 11px;
  color: var(--text-muted);
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.proj-card-next {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  background: rgba(52,211,153,.05);
  border-left: 2px solid var(--green);
  padding: 6px 8px;
  border-radius: 0 4px 4px 0;
  font-size: 11px;
  color: var(--green);
}

.proj-card-blocker {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  background: rgba(248,113,113,.05);
  border-left: 2px solid var(--red);
  padding: 6px 8px;
  border-radius: 0 4px 4px 0;
  font-size: 11px;
  color: var(--red);
}

.proj-card-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.proj-card-chip {
  font-size: 10px;
  padding: 2px 7px;
  background: rgba(255,255,255,.04);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-dim);
}
.proj-card-chip.more { color: var(--accent); border-color: rgba(167,139,250,.3); }

.proj-card-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: .4px;
}
.badge-stale { background: rgba(245,158,11,.15); color: var(--yellow); }
.badge-setup { background: rgba(96,165,250,.15); color: var(--blue); }

.proj-card-select {
  position: absolute;
  top: 12px;
  left: 12px;
  opacity: 0;
  transition: opacity .15s;
  accent-color: var(--accent);
  width: 14px;
  height: 14px;
}
.proj-card-v2:hover .proj-card-select,
.proj-card-v2.selected .proj-card-select { opacity: 1; }
```

**Step 2: render.js** — costanti e card renderer:

```js
const CATEGORY_ICONS = {
  landing: '🚀', ecommerce: '🛒', app: '📱', dashboard: '📊',
  'corporate-site': '💼', blog: '📝', portfolio: '🎨', other: '📦',
}
const STATUS_COLORS_V2 = {
  active: 'var(--green)', paused: 'var(--yellow)', completed: 'var(--blue)',
  archived: 'var(--text-muted)', 'in-progress': 'var(--blue)', blocked: 'var(--red)',
  unknown: 'var(--text-muted)',
}

function projectState(p) {
  const last = p.lastSession
  if (last?.blockers) return 'blocked'
  if (!p._meta?.category) return 'setup'
  if (last?.date) {
    const days = (Date.now() - new Date(last.date).getTime()) / 86400000
    if (days > 30) return 'stale'
  } else if (p.totalSessions === 0) {
    return 'stale'
  }
  return ''
}

function timeAgo(iso) {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (isNaN(d)) return 'never'
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec/60)}min ago`
  if (sec < 86400) return `${Math.floor(sec/3600)}h ago`
  if (sec < 604800) return `${Math.floor(sec/86400)}gg fa`
  if (sec < 2592000) return `${Math.floor(sec/604800)}w fa`
  return `${Math.floor(sec/2592000)}mo fa`
}

function renderCardGrid(p) {
  const s = getProjectsState()
  const m = p._meta || {}
  const status = m.status || p.lastSession?.status || 'unknown'
  const statusColor = STATUS_COLORS_V2[status] || 'var(--text-muted)'
  const displayName = m.displayName || p.name
  const stateClass = projectState(p)
  const stateBadge = stateClass === 'stale' ? '<span class="proj-card-badge badge-stale">Stale</span>'
    : stateClass === 'setup' ? '<span class="proj-card-badge badge-setup">Setup</span>' : ''
  const catIcon = m.category ? CATEGORY_ICONS[m.category] || '📦' : ''
  const stack = m.stack || []
  const visibleStack = stack.slice(0, 3)
  const moreStack = stack.length > 3 ? stack.length - 3 : 0
  const isPinned = s.pinned.has(p.name)
  const isSelected = s.selection.has(p.name)
  const onCardClick = `if(event.target.closest('.proj-card-actions,.proj-card-pin,.proj-card-select,.proj-menu-pop'))return;openProjectDetail('${escHtml(p.name)}')`

  return `<div class="proj-card-v2 ${stateClass ? 'state-'+stateClass : ''} ${isSelected ? 'selected' : ''}"
    data-name="${escHtml(p.name)}" onclick="${onCardClick}">
    <input type="checkbox" class="proj-card-select" ${isSelected ? 'checked' : ''}
      onclick="event.stopPropagation();toggleProjectSelection('${escHtml(p.name)}',this.checked)">
    <div class="proj-card-row1">
      <button class="proj-card-pin ${isPinned ? 'pinned' : ''}" title="${isPinned ? 'Unpin' : 'Pin'}"
        onclick="event.stopPropagation();toggleProjectPin('${escHtml(p.name)}')">${isPinned ? '★' : '☆'}</button>
      <span class="status-dot" style="background:${statusColor}" title="${status}"></span>
      <span class="name" title="${escHtml(displayName)}">${escHtml(displayName)}</span>
      ${stateBadge}
      ${m.liveUrl ? `<a class="live" href="${escHtml(m.liveUrl)}" target="_blank" rel="noopener" title="Open live site" onclick="event.stopPropagation()">↗</a>` : ''}
      <div class="proj-card-actions" style="position:relative">
        <button class="menu-btn" title="More actions" onclick="event.stopPropagation();toggleCardMenu('${escHtml(p.name)}',this)">⋯</button>
      </div>
    </div>
    <div class="proj-card-meta">
      ${catIcon ? `<span class="cat-icon">${catIcon}</span>` : ''}
      ${m.category ? `<span>${escHtml(m.category)}</span>` : ''}
      ${m.category && m.clientName ? '<span class="sep">·</span>' : ''}
      ${m.clientName ? `<span>${escHtml(m.clientName)}</span>` : ''}
    </div>
    <div class="proj-card-stats">
      ${p.totalSessions || 0} sess · ${p.totalMemories || 0} mem · ${timeAgo(p.lastSession?.date)}
    </div>
    ${p.lastSession?.blockers ? `<div class="proj-card-blocker">⚠ ${escHtml(p.lastSession.blockers)}</div>` : ''}
    ${p.lastSession?.nextSteps && !p.lastSession?.blockers ? `<div class="proj-card-next">▌ ${escHtml(p.lastSession.nextSteps)}</div>` : ''}
    ${visibleStack.length ? `<div class="proj-card-chips">
      ${visibleStack.map(s => `<span class="proj-card-chip">${escHtml(s)}</span>`).join('')}
      ${moreStack ? `<span class="proj-card-chip more">+${moreStack}</span>` : ''}
    </div>` : ''}
  </div>`
}

function renderGridView() {
  const s = getProjectsState()
  const el = document.getElementById('proj-body')
  if (!el) return
  if (s.filtered.length === 0) { renderEmptyState(el); return }
  // Exclude pinned from main grid (already shown above)
  const main = s.filtered.filter(p => !s.pinned.has(p.name))
  if (s.group === 'none') {
    el.innerHTML = `<div class="proj-grid">${main.map(renderCardGrid).join('')}</div>`
  } else {
    el.innerHTML = renderGroupedView(main, renderCardGrid, 'proj-grid')
  }
}

function renderGroupedView(items, renderItem, wrapperClass) {
  const s = getProjectsState()
  const groups = {}
  for (const p of items) {
    let key
    if (s.group === 'client') key = p._meta?.clientName || '(No client)'
    else if (s.group === 'status') key = p._meta?.status || p.lastSession?.status || '(unknown)'
    else if (s.group === 'category') key = p._meta?.category || '(No category)'
    else key = ''
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }
  const keys = Object.keys(groups).sort()
  return keys.map(k => `
    <div style="margin-bottom:16px">
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding:0 4px">
        ${escHtml(k)} <span style="color:var(--text-muted)">(${groups[k].length})</span>
      </div>
      <div class="${wrapperClass}">${groups[k].map(renderItem).join('')}</div>
    </div>
  `).join('')
}

function renderEmptyState(el) {
  el.innerHTML = `
    <div style="text-align:center;padding:60px 20px;background:var(--card);border:1px dashed var(--border);border-radius:10px">
      <div style="font-size:32px;margin-bottom:12px">📂</div>
      <div style="font-size:16px;font-weight:600;margin-bottom:6px">No projects match</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Try clearing filters or create a new project.</div>
      <button class="proj-new-btn" onclick="openNewProjectModal()">+ New Project</button>
    </div>
  `
}

// Main body dispatcher
function renderProjectsBody() {
  const s = getProjectsState()
  const el = document.getElementById('proj-body')
  if (!el) return
  if (s.merged.length === 0) {
    renderProjectsEmptyZero(el); return
  }
  if (s.view === 'grid') return renderGridView()
  if (s.view === 'list') return renderListView()
  if (s.view === 'kanban') return renderKanbanView()
  if (s.view === 'table') return renderTableView()
  renderGridView()
}

function renderProjectsEmptyZero(el) {
  el.innerHTML = `
    <div style="text-align:center;padding:80px 20px;background:var(--card);border:1px dashed var(--border);border-radius:10px">
      <div style="font-size:40px;margin-bottom:14px">🌱</div>
      <div style="font-size:18px;font-weight:600;margin-bottom:6px">No projects yet</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:24px">Get started in seconds.</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="proj-new-btn" onclick="openNewProjectModal()">+ New Project</button>
        <button disabled title="Coming in Phase 2" style="padding:7px 14px;border-radius:6px;background:none;border:1px solid var(--border);color:var(--text-muted);font-size:12px;cursor:not-allowed">📂 Import from folder</button>
        <button disabled title="Coming in Phase 2" style="padding:7px 14px;border-radius:6px;background:none;border:1px solid var(--border);color:var(--text-muted);font-size:12px;cursor:not-allowed">📋 Browse templates</button>
      </div>
    </div>
  `
}

// Placeholder views for tasks 7-9
function renderListView() { document.getElementById('proj-body').innerHTML = `<p style="padding:20px;color:var(--text-muted)">List view — Task 8</p>` }
function renderKanbanView() { document.getElementById('proj-body').innerHTML = `<p style="padding:20px;color:var(--text-muted)">Kanban view — Task 9</p>` }
function renderTableView() { document.getElementById('proj-body').innerHTML = `<p style="padding:20px;color:var(--text-muted)">Table view — Task 10</p>` }
```

**Step 3: Aggiornare `renderProjects`** alla fine — sostituire il placeholder body con:

```js
  renderProjectsBody()
  window._renderProjectsBody = renderProjectsBody
```

**Step 4: Aggiornare `renderProjectsPinned`** per renderizzare pinned cards con la card v2:

```js
function renderProjectsPinned() {
  const s = getProjectsState()
  const el = document.getElementById('proj-pinned')
  if (!el) return
  const pinnedList = s.filtered.filter(p => s.pinned.has(p.name))
  if (pinnedList.length === 0) { el.innerHTML = ''; return }
  el.innerHTML = `
    <div class="proj-pinned-section">
      <div class="proj-pinned-section-title"><span class="star">★</span> Pinned (${pinnedList.length})</div>
      <div class="proj-grid">${pinnedList.map(renderCardGrid).join('')}</div>
    </div>
  `
}
```

**Step 5: Aggiornare `applyProjectFiltersAndRender`** in app.js per usare il body real:

```js
function applyProjectFiltersAndRender() {
  window.applyProjectFilters()
  if (typeof window._renderProjectsToolbar === 'function') window._renderProjectsToolbar()
  if (typeof window._renderProjectsStats === 'function') window._renderProjectsStats()
  if (typeof window._renderProjectsPinned === 'function') window._renderProjectsPinned()
  if (typeof window._renderProjectsBody === 'function') window._renderProjectsBody()
}
```

Rimuovere `renderProjectsBodyPlaceholder`.

**Step 6: Stub handlers** (i full handler arrivano in task successivi):

```js
function toggleCardMenu(name, btn) { alert(`Menu for ${name} — Task 6`) }
function toggleProjectSelection(name, checked) {
  const s = window._projectsState
  if (!s) return
  if (checked) s.selection.add(name); else s.selection.delete(name)
  // For now just re-render to update selected styling
  if (typeof window._renderProjectsBody === 'function') window._renderProjectsBody()
}
window.toggleCardMenu = toggleCardMenu
window.toggleProjectSelection = toggleProjectSelection
```

**Step 7: Verifica browser**
- Vista Grid: card compatte 3 colonne su desktop, gradiscono a 2 sotto 1080px, 1 sotto 720px
- Border-top yellow su progetti senza sessions >30gg, blue su progetti senza category
- Click su card → apre detail panel (esistente)
- Pin star toggle funziona e popola sezione Pinned
- Stack chips: max 3 + "+N"
- Time-ago: "2gg fa", "3w fa", etc.

**Step 8: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): card v2 + grid view + state borders + grouped view"
```

---

## Task 6: Card menu — Archive / Duplicate / Export / Delete

**Files:**
- Modify: `js/render.js` (popup menu UI)
- Modify: `style.css`
- Modify: `app.js` (handlers)

**Step 1: CSS popup menu**:

```css
.proj-menu-pop {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 25;
  background: #111118;
  border: 1px solid var(--border-hover);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,.6);
  min-width: 160px;
  padding: 4px;
}
.proj-menu-pop button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: none;
  border: none;
  color: var(--text);
  font-size: 12px;
  padding: 7px 10px;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
}
.proj-menu-pop button:hover { background: rgba(255,255,255,.05); }
.proj-menu-pop button.danger:hover { background: rgba(248,113,113,.1); color: var(--red); }
.proj-menu-pop .sep { height: 1px; background: var(--border); margin: 4px 0; }
```

**Step 2: app.js** handlers — sostituire lo stub `toggleCardMenu`:

```js
function toggleCardMenu(name, btn) {
  // Close all other menus
  document.querySelectorAll('.proj-menu-pop').forEach(m => m.remove())
  const wrap = btn.parentElement
  const menu = document.createElement('div')
  menu.className = 'proj-menu-pop'
  menu.innerHTML = `
    <button onclick="cardAction('archive','${name}')">📦 Archive</button>
    <button onclick="cardAction('duplicate','${name}')">📑 Duplicate</button>
    <button onclick="cardAction('export','${name}')">⬇ Export JSON</button>
    <div class="sep"></div>
    <button class="danger" onclick="cardAction('delete','${name}')">✕ Delete</button>
  `
  wrap.appendChild(menu)
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', closeMenuOnClick, { once: true })
  }, 0)
}
function closeMenuOnClick(e) {
  if (!e.target.closest('.proj-menu-pop') && !e.target.closest('.menu-btn')) {
    document.querySelectorAll('.proj-menu-pop').forEach(m => m.remove())
  } else {
    // Re-attach if clicked inside without selecting an action
    setTimeout(() => document.addEventListener('click', closeMenuOnClick, { once: true }), 0)
  }
}

async function cardAction(action, name) {
  document.querySelectorAll('.proj-menu-pop').forEach(m => m.remove())
  if (action === 'archive') return archiveProject(name)
  if (action === 'duplicate') return duplicateProject(name)
  if (action === 'export') return exportProject(name)
  if (action === 'delete') return deleteProject(name)
}

async function archiveProject(name) {
  if (!confirm(`Archive "${name}"?`)) return
  try {
    await fetch(`/api/projects-meta/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    renderProjects()
  } catch (err) { alert('Archive failed: ' + err.message) }
}

async function duplicateProject(name) {
  const newName = prompt(`Duplicate "${name}"\n\nNew project name (kebab-case):`, name + '-copy')
  if (!newName || !newName.trim()) return
  try {
    const r = await fetch(`/api/projects-meta/${encodeURIComponent(name)}`)
    if (!r.ok) throw new Error('Source project not found')
    const meta = await r.json()
    // Strip identifying / time-bound fields
    const body = { ...meta }
    delete body.name; delete body.id; delete body.createdAt; delete body.updatedAt
    body.status = 'active' // reset to active
    if (body.displayName) body.displayName = body.displayName + ' (copy)'
    await fetch(`/api/projects-meta/${encodeURIComponent(newName.trim())}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    renderProjects()
  } catch (err) { alert('Duplicate failed: ' + err.message) }
}

async function exportProject(name) {
  try {
    const r = await fetch(`/api/projects-meta/${encodeURIComponent(name)}`)
    if (!r.ok) throw new Error('Project not found')
    const meta = await r.json()
    const blob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.meta.json`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  } catch (err) { alert('Export failed: ' + err.message) }
}

window.cardAction = cardAction
window.archiveProject = archiveProject
window.duplicateProject = duplicateProject
window.exportProject = exportProject
```

Nota: `deleteProject` esiste già a riga 354 di app.js — ma fa solo `renderProjects()`, mentre noi vogliamo passare per `renderProjects()`. È già a posto.

**Step 3: Verifica browser**
- Click su [⋯] apre dropdown con 4 voci + separatore
- Click su Archive → conferma → progetto sparisce dalla vista (filtrato out) o cambia status
- Click su Duplicate → prompt nome → nuovo progetto compare nella lista
- Click su Export → download file `<name>.meta.json` contenente il JSON
- Click su Delete → conferma → progetto rimosso
- Click outside chiude il menu

**Step 4: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): card menu with archive/duplicate/export/delete actions"
```

---

## Task 7: List view (compact table-like)

**Files:**
- Modify: `js/render.js`
- Modify: `style.css`

**Step 1: CSS**:

```css
.proj-list { display: flex; flex-direction: column; gap: 4px; }
.proj-list-row {
  display: grid;
  grid-template-columns: 24px 8px 1fr 140px 100px 80px 80px 140px auto;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: border-color .15s;
}
.proj-list-row:hover { border-color: var(--border-hover); }
.proj-list-row.selected { border-color: var(--accent); background: rgba(167,139,250,.04); }
.proj-list-row .dot { width: 8px; height: 8px; border-radius: 50%; }
.proj-list-row .name { font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.proj-list-row .col { color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.proj-list-row .chips { display: flex; gap: 4px; overflow: hidden; }
.proj-list-row .actions { display: flex; gap: 4px; position: relative; }
.proj-list-row input[type="checkbox"] { accent-color: var(--accent); }
@media (max-width: 900px) {
  .proj-list-row { grid-template-columns: 24px 8px 1fr 80px 80px auto; }
  .proj-list-row .col.client, .proj-list-row .col.last, .proj-list-row .chips { display: none; }
}
```

**Step 2: render.js**:

```js
function renderListView() {
  const s = getProjectsState()
  const el = document.getElementById('proj-body')
  if (!el) return
  if (s.filtered.length === 0) { renderEmptyState(el); return }
  const main = s.filtered.filter(p => !s.pinned.has(p.name))
  if (s.group !== 'none') {
    el.innerHTML = renderGroupedView(main, renderListRow, 'proj-list')
  } else {
    el.innerHTML = `<div class="proj-list">${main.map(renderListRow).join('')}</div>`
  }
}

function renderListRow(p) {
  const s = getProjectsState()
  const m = p._meta || {}
  const status = m.status || p.lastSession?.status || 'unknown'
  const statusColor = STATUS_COLORS_V2[status] || 'var(--text-muted)'
  const displayName = m.displayName || p.name
  const isPinned = s.pinned.has(p.name)
  const isSelected = s.selection.has(p.name)
  const stack = (m.stack || []).slice(0, 2)
  const onClick = `if(event.target.closest('input,button,a,.proj-menu-pop'))return;openProjectDetail('${escHtml(p.name)}')`
  return `<div class="proj-list-row ${isSelected ? 'selected' : ''}" data-name="${escHtml(p.name)}" onclick="${onClick}">
    <input type="checkbox" ${isSelected ? 'checked' : ''}
      onclick="event.stopPropagation();toggleProjectSelection('${escHtml(p.name)}',this.checked)">
    <span class="dot" style="background:${statusColor}"></span>
    <span class="name">
      <button class="proj-card-pin ${isPinned ? 'pinned' : ''}" style="margin-right:4px"
        onclick="event.stopPropagation();toggleProjectPin('${escHtml(p.name)}')">${isPinned ? '★' : '☆'}</button>
      ${escHtml(displayName)}
    </span>
    <span class="col client">${escHtml(m.clientName || '')}</span>
    <span class="col cat">${m.category ? `${CATEGORY_ICONS[m.category] || ''} ${escHtml(m.category)}` : ''}</span>
    <span class="col status" style="color:${statusColor}">${escHtml(status)}</span>
    <span class="col">${p.totalSessions || 0} sess</span>
    <span class="col last">${timeAgo(p.lastSession?.date)}</span>
    <span class="chips">${stack.map(s => `<span class="proj-card-chip">${escHtml(s)}</span>`).join('')}</span>
    <span class="actions">
      ${m.liveUrl ? `<a href="${escHtml(m.liveUrl)}" target="_blank" rel="noopener" class="proj-card-row1 a" style="color:var(--text-muted);text-decoration:none;padding:2px 4px" onclick="event.stopPropagation()">↗</a>` : ''}
      <button class="menu-btn" onclick="event.stopPropagation();toggleCardMenu('${escHtml(p.name)}',this)">⋯</button>
    </span>
  </div>`
}
```

**Step 3: Verifica browser**
- View Pill `⊟ List` → tutto in una riga compatta per progetto
- Stesse interazioni: pin, checkbox, menu, click apre detail
- Responsive: a <900px nasconde client/last/chips

**Step 4: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/style.css
git commit -m "feat(projects): list view (compact rows)"
```

---

## Task 8: Kanban view + drag-and-drop

**Files:**
- Modify: `js/render.js`
- Modify: `style.css`
- Modify: `app.js`

**Step 1: CSS**:

```css
.proj-kanban {
  display: grid;
  grid-template-columns: repeat(4, minmax(220px, 1fr));
  gap: 12px;
  overflow-x: auto;
}
@media (max-width: 980px) { .proj-kanban { grid-template-columns: repeat(2, minmax(220px, 1fr)); } }
@media (max-width: 540px) { .proj-kanban { grid-template-columns: 1fr; } }

.proj-kanban-col {
  background: rgba(255,255,255,.015);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 120px;
}
.proj-kanban-col.drop-target { border-color: var(--accent); background: rgba(167,139,250,.04); }

.proj-kanban-col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 4px 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}
.proj-kanban-col-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
}
.proj-kanban-col-count {
  background: rgba(255,255,255,.06);
  color: var(--text-dim);
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
}
.proj-kanban-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
  cursor: grab;
  font-size: 12px;
  transition: border-color .15s, opacity .15s;
}
.proj-kanban-card:hover { border-color: var(--border-hover); }
.proj-kanban-card.dragging { opacity: 0.4; cursor: grabbing; }
.proj-kanban-card .k-name { font-weight: 600; color: var(--text); margin-bottom: 4px; display: flex; align-items: center; gap: 4px; }
.proj-kanban-card .k-meta { color: var(--text-muted); font-size: 11px; }

.proj-kanban-col.collapsed { padding: 6px 10px; }
.proj-kanban-col.collapsed .proj-kanban-card { display: none; }
.proj-kanban-col-toggle {
  background: none; border: none; color: var(--text-muted);
  font-size: 11px; cursor: pointer;
}
```

**Step 2: render.js**:

```js
function renderKanbanView() {
  const s = getProjectsState()
  const el = document.getElementById('proj-body')
  if (!el) return
  if (s.filtered.length === 0) { renderEmptyState(el); return }
  const cols = ['active', 'paused', 'completed', 'archived']
  const grouped = { active: [], paused: [], completed: [], archived: [] }
  for (const p of s.filtered) {
    if (s.pinned.has(p.name)) continue
    const st = p._meta?.status || p.lastSession?.status
    if (grouped[st]) grouped[st].push(p)
    else grouped.active.push(p)
  }
  const archivedCollapsed = !s.filters.showArchived
  el.innerHTML = `<div class="proj-kanban">
    ${cols.map(c => `
      <div class="proj-kanban-col ${c === 'archived' && archivedCollapsed ? 'collapsed' : ''}"
        data-status="${c}" ondragover="kanbanDragOver(event,this)" ondragleave="kanbanDragLeave(this)" ondrop="kanbanDrop(event,this)">
        <div class="proj-kanban-col-header">
          <span class="proj-kanban-col-title">
            <span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${STATUS_COLORS_V2[c]}"></span>
            ${c} <span class="proj-kanban-col-count">${grouped[c].length}</span>
          </span>
          ${c === 'archived' ? `<button class="proj-kanban-col-toggle" onclick="this.closest('.proj-kanban-col').classList.toggle('collapsed')">${archivedCollapsed ? '▸' : '▾'}</button>` : ''}
        </div>
        ${grouped[c].map(renderKanbanCard).join('')}
      </div>`).join('')}
  </div>`
}

function renderKanbanCard(p) {
  const m = p._meta || {}
  const displayName = m.displayName || p.name
  return `<div class="proj-kanban-card" draggable="true"
    data-name="${escHtml(p.name)}"
    ondragstart="kanbanDragStart(event,this)"
    ondragend="kanbanDragEnd(this)"
    onclick="if(event.target.closest('button,a'))return;openProjectDetail('${escHtml(p.name)}')">
    <div class="k-name">
      ${m.category ? CATEGORY_ICONS[m.category] || '📦' : ''} ${escHtml(displayName)}
    </div>
    <div class="k-meta">
      ${m.clientName ? escHtml(m.clientName) + ' · ' : ''}${p.totalSessions || 0} sess · ${timeAgo(p.lastSession?.date)}
    </div>
  </div>`
}
```

**Step 3: app.js DnD handlers**:

```js
function kanbanDragStart(e, el) {
  e.dataTransfer.setData('text/plain', el.dataset.name)
  e.dataTransfer.effectAllowed = 'move'
  el.classList.add('dragging')
}
function kanbanDragEnd(el) { el.classList.remove('dragging') }
function kanbanDragOver(e, col) { e.preventDefault(); col.classList.add('drop-target') }
function kanbanDragLeave(col) { col.classList.remove('drop-target') }

async function kanbanDrop(e, col) {
  e.preventDefault()
  col.classList.remove('drop-target')
  const name = e.dataTransfer.getData('text/plain')
  const newStatus = col.dataset.status
  if (!name) return
  // Update state optimistically
  const s = window._projectsState
  if (!s) return
  const proj = s.merged.find(p => p.name === name)
  if (!proj) return
  const prevStatus = proj._meta?.status
  if (prevStatus === newStatus) return
  proj._meta = proj._meta || {}
  proj._meta.status = newStatus
  applyProjectFiltersAndRender()
  // PUT to backend
  try {
    const r = await fetch(`/api/projects-meta/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!r.ok) throw new Error('Update failed')
  } catch (err) {
    // Rollback
    proj._meta.status = prevStatus
    applyProjectFiltersAndRender()
    alert('Failed to update status: ' + err.message)
  }
}

window.kanbanDragStart = kanbanDragStart
window.kanbanDragEnd = kanbanDragEnd
window.kanbanDragOver = kanbanDragOver
window.kanbanDragLeave = kanbanDragLeave
window.kanbanDrop = kanbanDrop
```

**Step 4: Verifica browser**
- View Pill `☰ Kanban` → 4 colonne (Active / Paused / Completed / Archived)
- Archived collapsed di default; click freccia espande
- Drag&drop card tra colonne → status cambia (verifica con refresh)
- Errore di network → toast e rollback visivo

**Step 5: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): kanban view with HTML5 native drag-and-drop"
```

---

## Task 9: Table view + column sort

**Files:**
- Modify: `js/render.js`
- Modify: `style.css`
- Modify: `app.js`

**Step 1: CSS**:

```css
.proj-table-wrap { overflow-x: auto; }
.proj-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.proj-table th {
  text-align: left;
  background: var(--card);
  color: var(--text-muted);
  font-weight: 500;
  padding: 9px 8px;
  border-bottom: 1px solid var(--border);
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: .5px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.proj-table th:hover { color: var(--text); }
.proj-table th.sorted { color: var(--accent); }
.proj-table th .arrow { opacity: .5; margin-left: 4px; }
.proj-table td {
  padding: 8px;
  border-bottom: 1px solid var(--border);
  color: var(--text-dim);
  vertical-align: middle;
}
.proj-table tr:hover td { background: rgba(255,255,255,.02); }
.proj-table tr.selected td { background: rgba(167,139,250,.05); }
.proj-table td.name { color: var(--text); font-weight: 500; }
.proj-table td .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.proj-table input[type="checkbox"] { accent-color: var(--accent); }
```

**Step 2: render.js**:

```js
const TABLE_COLS = [
  { key: '_check', label: '', sortable: false, width: '30px' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'client', label: 'Client', sortable: true },
  { key: 'category', label: 'Category', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'sessions', label: 'Sessions', sortable: true },
  { key: 'memories', label: 'Memories', sortable: true },
  { key: 'lastActivity', label: 'Last activity', sortable: true },
  { key: 'stack', label: 'Stack', sortable: false },
  { key: 'domain', label: 'Domain', sortable: false },
  { key: '_actions', label: '', sortable: false },
]

function renderTableView() {
  const s = getProjectsState()
  const el = document.getElementById('proj-body')
  if (!el) return
  if (s.filtered.length === 0) { renderEmptyState(el); return }
  // Resolve sort column
  const [sortField, sortDir] = s.sort.split('-')
  const main = s.filtered.filter(p => !s.pinned.has(p.name))
  el.innerHTML = `
    <div class="proj-table-wrap">
      <table class="proj-table">
        <thead><tr>
          ${TABLE_COLS.map(c => {
            const sortKey = c.key === 'lastActivity' ? 'lastActivity' : c.key === 'sessions' ? 'sessions' : c.key
            const isSorted = c.sortable && sortKey === sortField
            const arrow = isSorted ? (sortDir === 'desc' ? '↓' : '↑') : ''
            return `<th ${c.width ? `style="width:${c.width}"` : ''}
              ${c.sortable ? `class="${isSorted ? 'sorted' : ''}" onclick="sortTableByCol('${sortKey}')"` : ''}>
              ${escHtml(c.label)}<span class="arrow">${arrow}</span>
            </th>`
          }).join('')}
        </tr></thead>
        <tbody>
          ${main.map(renderTableRow).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderTableRow(p) {
  const s = getProjectsState()
  const m = p._meta || {}
  const status = m.status || p.lastSession?.status || 'unknown'
  const statusColor = STATUS_COLORS_V2[status] || 'var(--text-muted)'
  const isSelected = s.selection.has(p.name)
  const stack = (m.stack || []).slice(0, 3).map(s => `<span class="proj-card-chip">${escHtml(s)}</span>`).join('')
  const onClick = `if(event.target.closest('input,button,a'))return;openProjectDetail('${escHtml(p.name)}')`
  return `<tr class="${isSelected ? 'selected' : ''}" data-name="${escHtml(p.name)}" onclick="${onClick}">
    <td><input type="checkbox" ${isSelected ? 'checked' : ''}
      onclick="event.stopPropagation();toggleProjectSelection('${escHtml(p.name)}',this.checked)"></td>
    <td class="name">
      <button class="proj-card-pin ${s.pinned.has(p.name) ? 'pinned' : ''}" style="margin-right:4px"
        onclick="event.stopPropagation();toggleProjectPin('${escHtml(p.name)}')">${s.pinned.has(p.name) ? '★' : '☆'}</button>
      ${escHtml(m.displayName || p.name)}
    </td>
    <td>${escHtml(m.clientName || '')}</td>
    <td>${m.category ? CATEGORY_ICONS[m.category] + ' ' + escHtml(m.category) : ''}</td>
    <td><span class="dot" style="background:${statusColor}"></span>${escHtml(status)}</td>
    <td>${p.totalSessions || 0}</td>
    <td>${p.totalMemories || 0}</td>
    <td>${timeAgo(p.lastSession?.date)}</td>
    <td><span style="display:flex;gap:3px">${stack}</span></td>
    <td>${m.domainPrimary ? escHtml(m.domainPrimary) : ''}</td>
    <td style="text-align:right;white-space:nowrap;position:relative">
      ${m.liveUrl ? `<a href="${escHtml(m.liveUrl)}" target="_blank" rel="noopener" style="color:var(--text-muted);text-decoration:none;margin-right:4px" onclick="event.stopPropagation()">↗</a>` : ''}
      <button class="menu-btn" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px 4px"
        onclick="event.stopPropagation();toggleCardMenu('${escHtml(p.name)}',this)">⋯</button>
    </td>
  </tr>`
}
```

**Step 3: app.js** handler:

```js
function sortTableByCol(field) {
  const s = window._projectsState
  if (!s) return
  const [curField, curDir] = s.sort.split('-')
  // Toggle direction if same field, else default desc for numeric, asc for text
  let dir
  if (curField === field) dir = curDir === 'desc' ? 'asc' : 'desc'
  else dir = (field === 'name' || field === 'client' || field === 'category' || field === 'status') ? 'asc' : 'desc'
  s.sort = `${field}-${dir}`
  applyProjectFiltersAndRender()
}
window.sortTableByCol = sortTableByCol
```

**Step 4: Aggiungere "client" e "category" come field validi nel sort**. In `applyProjectFilters` (render.js) il sort attualmente gestisce name/status/sessions/created/lastActivity — aggiungere:

```js
  else if (field === 'client') { av = (a._meta?.clientName || '').toLowerCase(); bv = (b._meta?.clientName || '').toLowerCase() }
  else if (field === 'category') { av = a._meta?.category || ''; bv = b._meta?.category || '' }
  else if (field === 'memories') { av = a.totalMemories || 0; bv = b.totalMemories || 0 }
```

Inserire prima dello `else /* lastActivity */`.

**Step 5: Verifica browser**
- View Pill `▭ Table` → tabella completa
- Click su intestazione colonna → sort asc/desc toggle, freccia ↑/↓ visibile
- Stesse azioni: pin/check/menu funzionanti

**Step 6: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): table view with sortable columns"
```

---

## Task 10: Bulk operations toolbar

**Files:**
- Modify: `js/render.js`
- Modify: `style.css`
- Modify: `app.js`

**Step 1: CSS**:

```css
.proj-bulk-toolbar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  background: #15151f;
  border: 1px solid var(--border-hover);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0,0,0,.6);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  max-width: 90vw;
  animation: bulk-slide-up .15s ease-out;
}
@keyframes bulk-slide-up {
  from { transform: translate(-50%, 20px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}
.proj-bulk-counter {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}
.proj-bulk-toolbar button, .proj-bulk-toolbar select {
  background: #111118;
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.proj-bulk-toolbar button:hover { border-color: var(--border-hover); }
.proj-bulk-toolbar button.danger { color: var(--red); border-color: rgba(248,113,113,.3); }
.proj-bulk-toolbar button.danger:hover { background: rgba(248,113,113,.08); }
.proj-bulk-toolbar button.cancel { color: var(--text-muted); }
```

**Step 2: render.js**:

```js
function renderProjectsBulk() {
  const s = getProjectsState()
  const el = document.getElementById('proj-bulk')
  if (!el) return
  if (s.selection.size === 0) { el.innerHTML = ''; return }
  el.innerHTML = `
    <div class="proj-bulk-toolbar">
      <span class="proj-bulk-counter">${s.selection.size} selected</span>
      <select onchange="bulkSetStatus(this.value);this.value=''">
        <option value="">Set status…</option>
        <option value="active">→ Active</option>
        <option value="paused">→ Paused</option>
        <option value="completed">→ Completed</option>
        <option value="archived">→ Archived</option>
      </select>
      <button onclick="bulkArchive()">📦 Archive</button>
      <button class="danger" onclick="bulkDelete()">✕ Delete</button>
      <button class="cancel" onclick="bulkCancel()">Cancel</button>
    </div>
  `
}
```

**Step 3: render.js — `renderProjectsBody` chiama anche bulk**. Aggiornare:

```js
function renderProjectsBody() {
  const s = getProjectsState()
  const el = document.getElementById('proj-body')
  if (!el) return
  if (s.merged.length === 0) {
    renderProjectsEmptyZero(el); return
  }
  if (s.view === 'grid') renderGridView()
  else if (s.view === 'list') renderListView()
  else if (s.view === 'kanban') renderKanbanView()
  else if (s.view === 'table') renderTableView()
  else renderGridView()
  renderProjectsBulk()
}
```

**Step 4: app.js** handlers — sostituire `toggleProjectSelection` con quella reale che richiama bulk:

```js
function toggleProjectSelection(name, checked) {
  const s = window._projectsState
  if (!s) return
  if (checked) s.selection.add(name); else s.selection.delete(name)
  // Re-render body to update selected styling + bulk toolbar
  if (typeof window._renderProjectsBody === 'function') window._renderProjectsBody()
}

async function bulkSetStatus(status) {
  if (!status) return
  const s = window._projectsState
  if (!s) return
  const names = [...s.selection]
  if (!confirm(`Set status "${status}" on ${names.length} project${names.length>1?'s':''}?`)) return
  try {
    await Promise.all(names.map(n =>
      fetch(`/api/projects-meta/${encodeURIComponent(n)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    ))
    s.selection.clear()
    renderProjects()
  } catch (err) { alert('Bulk update failed: ' + err.message) }
}

async function bulkArchive() {
  await bulkSetStatus('archived')
}

async function bulkDelete() {
  const s = window._projectsState
  if (!s) return
  const names = [...s.selection]
  if (!confirm(`Delete ${names.length} project${names.length>1?'s':''}? This removes their metadata records.`)) return
  try {
    await Promise.all(names.map(n =>
      fetch(`/api/projects-meta/${encodeURIComponent(n)}`, { method: 'DELETE' })
    ))
    s.selection.clear()
    renderProjects()
  } catch (err) { alert('Bulk delete failed: ' + err.message) }
}

function bulkCancel() {
  const s = window._projectsState
  if (!s) return
  s.selection.clear()
  if (typeof window._renderProjectsBody === 'function') window._renderProjectsBody()
}

window.toggleProjectSelection = toggleProjectSelection
window.bulkSetStatus = bulkSetStatus
window.bulkArchive = bulkArchive
window.bulkDelete = bulkDelete
window.bulkCancel = bulkCancel
```

**Step 5: Verifica browser**
- Spuntare almeno 1 checkbox su una card → bulk toolbar appare in basso con counter
- "Set status… → Paused" → conferma → tutti i selezionati cambiano status
- Archive → status='archived'
- Delete → conferma → progetti rimossi
- Cancel → cancella selezione

**Step 6: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): bulk operations toolbar (status/archive/delete)"
```

---

## Task 11: Detail panel — prev/next nav + 2-column overview

**Files:**
- Modify: `js/render.js` (riscrivere `renderProjectDetail` e `renderProjectTab`)
- Modify: `style.css`
- Modify: `app.js`

**Step 1: CSS**:

```css
.proj-detail-nav {
  display: flex;
  gap: 4px;
  margin-right: 8px;
}
.proj-detail-nav button {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.proj-detail-nav button:hover:not(:disabled) { border-color: var(--accent2); color: var(--accent); }
.proj-detail-nav button:disabled { opacity: .3; cursor: not-allowed; }

.proj-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 900px) { .proj-detail-grid { grid-template-columns: 1fr; } }
```

**Step 2: render.js — aggiornare `renderProjectDetail`**:

```js
export async function renderProjectDetail(name, openDetailFn) {
  const [activity, meta] = await Promise.all([
    api.get(`/api/projects/${encodeURIComponent(name)}`).catch(() => ({})),
    api.get(`/api/projects-meta/${encodeURIComponent(name)}`).catch(() => null),
  ])

  const sessions = activity.sessions || []
  const memories = activity.memories || []
  const last = sessions[0]

  // Update detail index in state
  const s = getProjectsState()
  s.detailIndex = s.filtered.findIndex(p => p.name === name)
  const hasPrev = s.detailIndex > 0
  const hasNext = s.detailIndex >= 0 && s.detailIndex < s.filtered.length - 1

  const html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="proj-detail-nav">
        <button onclick="projectDetailNav(-1)" ${!hasPrev ? 'disabled' : ''} title="Previous">←</button>
        <button onclick="projectDetailNav(1)" ${!hasNext ? 'disabled' : ''} title="Next">→</button>
      </div>
      <div id="proj-tabs" style="display:flex;gap:4px;border-bottom:1px solid var(--border);flex:1">
        <button class="proj-tab active" data-tab="overview" onclick="switchProjectTab('overview','${escHtml(name)}')" style="padding:8px 14px;background:none;border:none;color:var(--accent);border-bottom:2px solid var(--accent);font-size:13px;cursor:pointer">Overview</button>
        <button class="proj-tab" data-tab="env" onclick="switchProjectTab('env','${escHtml(name)}')" style="padding:8px 14px;background:none;border:none;color:var(--text-muted);border-bottom:2px solid transparent;font-size:13px;cursor:pointer">Env Vars</button>
        <button class="proj-tab" data-tab="activity" onclick="switchProjectTab('activity','${escHtml(name)}')" style="padding:8px 14px;background:none;border:none;color:var(--text-muted);border-bottom:2px solid transparent;font-size:13px;cursor:pointer">Activity</button>
      </div>
      <div style="display:flex;gap:6px;margin-left:8px">
        <button onclick="openProjectBoard('${escHtml(name)}')" title="Open or create the project's home whiteboard" style="padding:6px 12px;border-radius:6px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.4);color:#a5b4fc;font-size:12px;font-weight:600;cursor:pointer">🗂 Project board</button>
        <button onclick="openEditProjectModal('${escHtml(name)}')" style="padding:6px 12px;border-radius:6px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;font-size:12px;font-weight:600;cursor:pointer">Edit</button>
        <button onclick="showMergeDialog('${escHtml(name)}')" style="padding:6px 12px;border-radius:6px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);color:#f59e0b;font-size:12px;font-weight:600;cursor:pointer">Merge</button>
      </div>
    </div>
    <div id="proj-tab-content"></div>
  `
  openDetailFn(name, html)

  const projData = { name, activity, meta, sessions, memories, last }
  window._projData = projData
  renderProjectTab('overview', name, projData)
  checkForDuplicates(name)
}
```

**Step 3: render.js — riscrivere overview tab a 2 colonne**. Sostituire l'intero blocco `if (tab === 'overview')` in `renderProjectTab` con:

```js
  if (tab === 'overview') {
    const displayName = M.displayName || name
    const sc = statusColors[M.status || (last?.status)] || 'var(--text-muted)'

    // Header card (full width)
    let html = `
      <div class="card">
        <div style="font-size:18px;font-weight:600;margin-bottom:4px">${escHtml(displayName)}</div>
        <div style="color:var(--text-muted);font-size:12px;margin-bottom:12px">
          ${M.clientName ? `Client: <strong>${escHtml(M.clientName)}</strong> &middot; ` : ''}
          ${M.category ? `${escHtml(M.category)} &middot; ` : ''}
          <span style="color:${sc}">${M.status || (last?.status || 'unknown')}</span>
        </div>
        ${M.description ? `<div style="color:var(--text-dim);font-size:13px;margin-bottom:12px">${escHtml(M.description)}</div>` : ''}
        ${M.stack?.length ? `<div class="tags">${M.stack.map((s) => `<span class="tag">${escHtml(s)}</span>`).join('')}</div>` : ''}
      </div>`

    // Two-column grid
    const leftCol = []
    const rightCol = []

    // Team (left)
    if (M.teamLead || M.teamMembers?.length) {
      leftCol.push(`<div class="card">
        <div class="card-title">Team</div>
        ${M.teamLead ? `<div class="row"><span class="row-label">Lead</span><span class="row-val"><strong>${escHtml(M.teamLead)}</strong></span></div>` : ''}
        ${(M.teamMembers || []).map((mb) => `
          <div class="row">
            <span class="row-label">${escHtml(mb.name)}</span>
            <span class="row-val" style="font-size:12px;color:var(--text-muted)">${escHtml(mb.role || '')}${mb.email ? ' · ' + escHtml(mb.email) : ''}</span>
          </div>`).join('')}
      </div>`)
    }

    // Notes (left, if present)
    if (M.notes) {
      leftCol.push(`<div class="card">
        <div class="card-title">Notes</div>
        <div style="font-size:13px;color:var(--text-dim);white-space:pre-wrap">${escHtml(M.notes)}</div>
      </div>`)
    }

    // Links (right)
    if (M.repoUrl || M.liveUrl) {
      rightCol.push(`<div class="card">
        <div class="card-title">Links</div>
        ${M.liveUrl ? `<div class="row"><span class="row-label">Live</span><a href="${escHtml(M.liveUrl)}" target="_blank" style="color:var(--accent)">${escHtml(M.liveUrl)}</a></div>` : ''}
        ${M.repoUrl ? `<div class="row"><span class="row-label">Repo</span><a href="${escHtml(M.repoUrl)}" target="_blank" style="color:var(--accent)">${escHtml(M.repoUrl)}</a></div>` : ''}
        ${M.mainBranch ? `<div class="row"><span class="row-label">Branch</span><span class="row-val"><code>${escHtml(M.mainBranch)}</code></span></div>` : ''}
      </div>`)
    }

    // Stack & Infra (right)
    const hasInfra = M.dbType || M.cmsType || M.deployPlatform || M.domainPrimary
    if (hasInfra) {
      let infraHtml = `<div class="card"><div class="card-title" style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted);margin-bottom:8px">Stack &amp; Infra</div>`
      if (M.dbType || M.dbReference || M.dbAdminUrl) {
        infraHtml += `<div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;margin-top:4px">Database</div>`
        if (M.dbType) infraHtml += `<div class="row"><span class="row-label">Type</span><span class="row-val">${escHtml(M.dbType)}</span></div>`
        if (M.dbReference) infraHtml += `<div class="row"><span class="row-label">Reference</span><span class="row-val">${escHtml(M.dbReference)}</span></div>`
        if (M.dbAdminUrl) infraHtml += `<div class="row"><span class="row-label">Admin</span><a href="${escHtml(M.dbAdminUrl)}" target="_blank" style="color:var(--accent)">${escHtml(M.dbAdminUrl)}</a></div>`
      }
      if (M.cmsType || M.cmsAdminUrl) {
        infraHtml += `<div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;margin-top:12px">CMS</div>`
        if (M.cmsType) infraHtml += `<div class="row"><span class="row-label">Type</span><span class="row-val">${escHtml(M.cmsType)}</span></div>`
        if (M.cmsAdminUrl) infraHtml += `<div class="row"><span class="row-label">Admin</span><a href="${escHtml(M.cmsAdminUrl)}" target="_blank" style="color:var(--accent)">${escHtml(M.cmsAdminUrl)}</a></div>`
      }
      if (M.deployPlatform) {
        infraHtml += `<div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;margin-top:12px">Deploy</div>`
        infraHtml += `<div class="row"><span class="row-label">Platform</span><span class="row-val">${escHtml(M.deployPlatform)}</span></div>`
        if (M.hasCi) infraHtml += `<div class="row"><span class="row-label">CI/CD</span><span class="row-val">✅ GitHub Actions</span></div>`
      }
      if (M.domainPrimary) {
        infraHtml += `<div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;margin-top:12px">Domains</div>`
        infraHtml += `<div class="row"><span class="row-label">Primary</span><span class="row-val">${escHtml(M.domainPrimary)}</span></div>`;
        (M.domainsExtra || []).forEach(d => { infraHtml += `<div class="row"><span class="row-label">Extra</span><span class="row-val">${escHtml(d)}</span></div>` })
      }
      infraHtml += `</div>`
      rightCol.push(infraHtml)
    }

    // Last activity (right)
    if (last) {
      rightCol.push(`<div class="card">
        <div class="card-title">Last Activity</div>
        <div class="row"><span class="row-label">Date</span><span class="row-val">${last.startedAt?.split('T')[0] || '?'}</span></div>
        ${last.taskDescription ? `<div class="row"><span class="row-label">Task</span><span class="row-val">${escHtml(last.taskDescription)}</span></div>` : ''}
        ${last.nextSteps ? `<div style="margin-top:8px;padding:8px;background:rgba(52,211,153,.05);border:1px solid rgba(52,211,153,.2);border-radius:6px;font-size:12px;color:var(--green)">Next: ${escHtml(last.nextSteps)}</div>` : ''}
        ${last.blockers ? `<div style="margin-top:6px;padding:8px;background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.2);border-radius:6px;font-size:12px;color:var(--red)">Blocker: ${escHtml(last.blockers)}</div>` : ''}
      </div>`)
    }

    if (leftCol.length || rightCol.length) {
      html += `<div class="proj-detail-grid">
        <div>${leftCol.join('')}</div>
        <div>${rightCol.join('')}</div>
      </div>`
    }

    if (!meta) {
      html += `
      <div class="card" style="border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.03)">
        <div style="color:var(--yellow);font-size:13px;font-weight:600;margin-bottom:6px">No metadata yet</div>
        <div style="color:var(--text-muted);font-size:12px;margin-bottom:12px">Run <code style="background:rgba(255,255,255,.06);padding:2px 6px;border-radius:4px">project_scan</code> in Claude Code, or fill manually.</div>
        <button onclick="openEditProjectModal('${escHtml(name)}')" style="padding:6px 14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;font-size:12px;font-weight:600;border-radius:6px;cursor:pointer">Edit metadata</button>
      </div>`
    }

    container.innerHTML = html
  }
```

**Step 4: app.js** — handler prev/next:

```js
function projectDetailNav(delta) {
  const s = window._projectsState
  if (!s) return
  const next = s.detailIndex + delta
  if (next < 0 || next >= s.filtered.length) return
  s.detailIndex = next
  const name = s.filtered[next].name
  if (typeof window.openProjectDetail === 'function') window.openProjectDetail(name)
}
window.projectDetailNav = projectDetailNav
```

**Step 5: Verifica browser**
- Apri detail di un progetto → freccie ← → in alto a sinistra
- Click → / ← cicla nei progetti filtrati. Disabled ai bordi.
- Overview a 2 colonne su desktop, 1 su mobile (resize finestra)

**Step 6: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): detail panel prev/next nav + 2-col overview"
```

---

## Task 12: Activity tab — filter chips + group by day

**Files:**
- Modify: `js/render.js` (sostituire blocco `if (tab === 'activity')`)
- Modify: `style.css`

**Step 1: CSS**:

```css
.proj-activity-filter {
  display: inline-flex;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
  margin-bottom: 12px;
}
.proj-activity-filter button {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
}
.proj-activity-filter button.active {
  background: rgba(167,139,250,.12);
  color: var(--accent);
}

.proj-activity-day {
  margin-bottom: 16px;
}
.proj-activity-day-header {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .5px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.proj-activity-item {
  display: flex;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,.02);
  font-size: 12px;
}
.proj-activity-item:last-child { border-bottom: none; }
.proj-activity-icon { width: 24px; flex-shrink: 0; font-size: 14px; text-align: center; }
.proj-activity-content { flex: 1; min-width: 0; }
.proj-activity-title { font-weight: 500; color: var(--text); }
.proj-activity-meta { color: var(--text-muted); font-size: 11px; margin-top: 2px; }
```

**Step 2: render.js** — sostituire interamente il blocco `if (tab === 'activity')`:

```js
  if (tab === 'activity') {
    const filter = window._activityFilter || 'all'
    const items = []
    if (filter === 'all' || filter === 'sessions') {
      for (const s of (sessions || [])) {
        items.push({ kind: 'session', date: s.startedAt, data: s })
      }
    }
    if (filter === 'all' || filter === 'memories') {
      for (const m of (memories || [])) {
        items.push({ kind: 'memory', date: m.createdAt || m.created_at, data: m })
      }
    }
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    // Group by day
    const days = {}
    for (const it of items) {
      const day = (it.date || '').slice(0, 10) || '—'
      if (!days[day]) days[day] = []
      days[day].push(it)
    }

    let html = `
      <div class="proj-activity-filter">
        <button class="${filter==='all'?'active':''}" onclick="setActivityFilter('all','${escHtml(name)}')">All (${items.length})</button>
        <button class="${filter==='sessions'?'active':''}" onclick="setActivityFilter('sessions','${escHtml(name)}')">Sessions (${sessions.length})</button>
        <button class="${filter==='memories'?'active':''}" onclick="setActivityFilter('memories','${escHtml(name)}')">Memories (${memories.length})</button>
      </div>
    `

    if (items.length === 0) {
      html += `<p style="color:var(--text-muted);font-size:13px">No activity yet.</p>`
    } else {
      for (const day of Object.keys(days)) {
        html += `<div class="proj-activity-day">
          <div class="proj-activity-day-header">${day}</div>
          ${days[day].map(it => renderActivityItem(it)).join('')}
        </div>`
      }
    }
    container.innerHTML = html
  }
}

function renderActivityItem(it) {
  if (it.kind === 'session') {
    const s = it.data
    return `<div class="proj-activity-item">
      <span class="proj-activity-icon">🗓</span>
      <div class="proj-activity-content">
        <div class="proj-activity-title">${escHtml(s.sessionName || 'Session')} <span style="font-size:10px;color:var(--text-muted)">[${escHtml(s.status || '')}]</span></div>
        <div class="proj-activity-meta">${(s.startedAt || '').replace('T', ' ').slice(0, 16)} · ${escHtml(s.summary || s.taskDescription || 'No summary')}</div>
      </div>
    </div>`
  }
  const m = it.data
  return `<div class="proj-activity-item" onclick="openMemoryDetail('${escHtml(m.id)}')" style="cursor:pointer">
    <span class="proj-activity-icon">💭</span>
    <div class="proj-activity-content">
      <div class="proj-activity-title">${badge(m.type)} ${escHtml((m.context || '').slice(0, 80))}</div>
      <div class="proj-activity-meta">${confBar(m.confidence)} · ${(m.createdAt || m.created_at || '').slice(0,10)}</div>
    </div>
  </div>`
}
```

**Step 3: app.js** handler:

```js
function setActivityFilter(filter, name) {
  window._activityFilter = filter
  if (typeof renderProjectTab === 'function') renderProjectTab('activity', name)
  else if (window._projData) {
    // re-render activity tab manually
    const ev = new Event('renderActivity')
    document.dispatchEvent(ev)
  }
  // simpler: just re-invoke via the existing helper
}
window.setActivityFilter = setActivityFilter
```

Aggiungere import `renderProjectTab` in cima a app.js se non già presente (è già nell'import esistente).

Per chiamare la funzione (non globale): esporre via `window._renderProjectTab`. In `renderProjectDetail`:

```js
  window._renderProjectTab = renderProjectTab
```

Aggiornare `setActivityFilter`:

```js
function setActivityFilter(filter, name) {
  window._activityFilter = filter
  if (typeof window._renderProjectTab === 'function') {
    window._renderProjectTab('activity', name)
  }
}
```

**Step 4: Verifica browser**
- Apri detail → tab Activity
- 3 chip All / Sessions / Memories con conteggi
- Click su uno → filtra
- Items raggruppati per data (header data, items sotto)
- Più recente in cima

**Step 5: Commit**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): activity tab with filter chips and group-by-day"
```

---

## Task 13: Edit modal — tab structure

**Files:**
- Modify: `js/modal.js` (riscrivere `openEditProjectModal`)
- Modify: `style.css`

**Step 1: CSS edit modal tabs**:

```css
.edit-modal-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 14px;
  padding-bottom: 0;
  overflow-x: auto;
}
.edit-modal-tab {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  padding: 8px 14px;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
}
.edit-modal-tab:hover { color: var(--text); }
.edit-modal-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 500;
}
.edit-modal-tab .req { color: var(--red); margin-left: 2px; }

.edit-tab-content { display: none; }
.edit-tab-content.active { display: flex; flex-direction: column; gap: 12px; }
```

**Step 2: Riscrivere `openEditProjectModal` in `js/modal.js`** (sostituire interamente riga 48-124):

```js
export async function openEditProjectModal(name) {
  const meta = await api.get(`/api/projects-meta/${encodeURIComponent(name)}`).catch(() => null) || { name }

  let overlay = document.getElementById('edit-modal')
  if (overlay) overlay.remove()
  overlay = document.createElement('div')
  overlay.id = 'edit-modal'
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:flex;justify-content:center;align-items:center;padding:20px'

  const members = meta.teamMembers || []

  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;width:min(680px,92vw);max-height:92vh;display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        <h2 style="font-size:16px;color:var(--accent);margin:0">Edit Project: ${escHtml(name)}</h2>
        <button onclick="closeEditModal()" style="background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer;padding:0 8px">&times;</button>
      </div>

      <div class="edit-modal-tabs">
        <button type="button" class="edit-modal-tab active" data-tab="identity" onclick="switchEditTab('identity')">Identity<span class="req">*</span></button>
        <button type="button" class="edit-modal-tab" data-tab="team" onclick="switchEditTab('team')">Team</button>
        <button type="button" class="edit-modal-tab" data-tab="links" onclick="switchEditTab('links')">Links</button>
        <button type="button" class="edit-modal-tab" data-tab="infra" onclick="switchEditTab('infra')">Infra</button>
        <button type="button" class="edit-modal-tab" data-tab="notes" onclick="switchEditTab('notes')">Notes</button>
      </div>

      <form id="edit-form" onsubmit="return saveProject(event,'${name}')" style="flex:1;overflow-y:auto;display:flex;flex-direction:column">

        <div class="edit-tab-content active" data-content="identity">
          ${editField('displayName', 'Display Name', meta.displayName, 'es. Terrae e Mare')}
          ${editField('clientName', 'Cliente', meta.clientName, 'es. Trattoria Mario')}
          ${editField('description', 'Descrizione', meta.description, 'Breve descrizione progetto', 'textarea')}
          ${editSelect('category', 'Categoria', meta.category, ['landing','ecommerce','app','dashboard','corporate-site','blog','portfolio','other'])}
          ${editSelect('status', 'Status', meta.status, ['active','paused','archived','completed'])}
          ${renderStackTagInput(meta.stack || [])}
        </div>

        <div class="edit-tab-content" data-content="team">
          ${editField('teamLead', 'Team Lead', meta.teamLead, 'es. Daniel')}
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Team Members</label>
            <div id="team-members-list" style="display:flex;flex-direction:column;gap:6px">
              ${members.map((m, i) => memberRow(m, i)).join('')}
            </div>
            <button type="button" onclick="addMemberRow()" style="margin-top:6px;padding:4px 10px;background:rgba(99,102,241,.1);border:1px solid var(--accent2);color:var(--accent);font-size:11px;border-radius:4px;cursor:pointer">+ Add member</button>
          </div>
        </div>

        <div class="edit-tab-content" data-content="links">
          ${editField('liveUrl', 'Live URL', meta.liveUrl, 'https://...')}
          ${editField('repoUrl', 'Repository', meta.repoUrl, 'https://github.com/...')}
          ${editField('mainBranch', 'Main branch', meta.mainBranch, 'main')}
          ${editField('domainPrimary', 'Domain primario', meta.domainPrimary, 'example.it')}
        </div>

        <div class="edit-tab-content" data-content="infra">
          ${editField('dbType', 'Database Type', meta.dbType, 'MongoDB / Postgres / Supabase')}
          ${editField('dbReference', 'Database Reference', meta.dbReference, 'es. Atlas cluster pixarts-prod')}
          ${editField('dbAdminUrl', 'Database Admin URL', meta.dbAdminUrl, 'https://...')}
          ${editField('cmsType', 'CMS', meta.cmsType, 'Payload / Sanity / Strapi')}
          ${editField('cmsAdminUrl', 'CMS Admin URL', meta.cmsAdminUrl, 'https://site.it/admin')}
          ${editField('deployPlatform', 'Deploy Platform', meta.deployPlatform, 'Coolify / Vercel / Netlify')}
        </div>

        <div class="edit-tab-content" data-content="notes">
          ${editField('notes', 'Notes', meta.notes, 'Note interne', 'textarea')}
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:14px;margin-top:14px;border-top:1px solid var(--border)">
          <button type="button" onclick="closeEditModal()" style="padding:8px 16px;background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:6px;cursor:pointer">Cancel</button>
          <button type="submit" style="padding:8px 20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;border-radius:6px;font-weight:600;cursor:pointer">Save</button>
        </div>
      </form>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeEditModal() })
  initStackTagInput()
}

export function switchEditTab(tab) {
  document.querySelectorAll('.edit-modal-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
  document.querySelectorAll('.edit-tab-content').forEach(c => c.classList.toggle('active', c.dataset.content === tab))
}

// Stub for Task 14
function renderStackTagInput(stack) {
  return `<div>
    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Stack</label>
    <input type="text" name="stackRaw" value="${escHtml((stack || []).join(', '))}" placeholder="Next.js, Tailwind, Supabase" style="width:100%;padding:8px 12px;background:#111118;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none;box-sizing:border-box">
    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Tag input arriva in Task 14</div>
  </div>`
}
function initStackTagInput() { /* Task 14 */ }
```

**Step 3: Esporre globalmente** in app.js (e mantenere import):

```js
import {
  openEditProjectModal, closeEditModal, saveProject, switchEditTab,
  editField, editSelect, memberRow,
  showMergeDialog, closeMergeModal, confirmMerge,
  showDsMergeDialog, closeDsMergeModal, confirmDsMerge,
} from './js/modal.js'
// ...
window.switchEditTab = switchEditTab
```

**Step 4: Verifica browser**
- Click su Edit di un progetto → modal con 5 tab visibili
- Click su una tab → mostra solo quel contenuto, le altre nascoste
- Identity ha `*` rosso
- Pulsanti Save/Cancel sempre visibili a fondo (footer)
- Tab `team` con member rows e `+ Add member` funzionante (legacy `addMemberRow` ancora attivo)
- Stack rimane input CSV (verrà sostituito in Task 14)

**Step 5: Commit**

```bash
git add packages/codegraph/public/js/modal.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): edit modal restructured with 5 tabs (Identity/Team/Links/Infra/Notes)"
```

---

## Task 14: Edit modal — Stack tag-input

**Files:**
- Modify: `js/modal.js` (`renderStackTagInput`, `initStackTagInput`, `saveProject`)
- Modify: `style.css`

**Step 1: CSS**:

```css
.tag-input-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: #111118;
  border: 1px solid var(--border);
  border-radius: 6px;
  min-height: 38px;
}
.tag-input-wrap:focus-within { border-color: var(--accent2); }

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: rgba(167,139,250,.10);
  border: 1px solid rgba(167,139,250,.3);
  color: var(--accent);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}
.tag-chip button {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  line-height: 1;
  opacity: .6;
}
.tag-chip button:hover { opacity: 1; color: var(--red); }

.tag-input {
  flex: 1;
  min-width: 100px;
  background: none;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 12px;
  padding: 2px 4px;
}
```

**Step 2: Sostituire `renderStackTagInput` e `initStackTagInput` in `js/modal.js`**:

```js
function renderStackTagInput(stack) {
  const tags = stack || []
  return `<div>
    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Stack</label>
    <div class="tag-input-wrap" id="stack-tag-wrap" data-tags='${JSON.stringify(tags)}' onclick="document.getElementById('stack-tag-input').focus()">
      ${tags.map(t => renderTagChip(t)).join('')}
      <input type="text" class="tag-input" id="stack-tag-input" placeholder="Add tech (press Enter)" autocomplete="off">
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Enter to add, Backspace to remove last</div>
  </div>`
}

function renderTagChip(tag) {
  return `<span class="tag-chip" data-tag="${escHtml(tag)}">${escHtml(tag)}<button type="button" onclick="removeStackTag('${escHtml(tag)}')">×</button></span>`
}

function initStackTagInput() {
  const inp = document.getElementById('stack-tag-input')
  if (!inp) return
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const v = inp.value.trim()
      if (!v) return
      addStackTag(v)
      inp.value = ''
    } else if (e.key === 'Backspace' && inp.value === '') {
      const wrap = document.getElementById('stack-tag-wrap')
      const chips = wrap.querySelectorAll('.tag-chip')
      if (chips.length === 0) return
      const last = chips[chips.length - 1]
      const tag = last.dataset.tag
      removeStackTag(tag)
    }
  })
}

function addStackTag(tag) {
  const wrap = document.getElementById('stack-tag-wrap')
  if (!wrap) return
  const tags = JSON.parse(wrap.dataset.tags || '[]')
  if (tags.includes(tag)) return // no duplicates
  tags.push(tag)
  wrap.dataset.tags = JSON.stringify(tags)
  // Insert chip before the input
  const inp = document.getElementById('stack-tag-input')
  const chipHtml = renderTagChip(tag)
  const tmp = document.createElement('div')
  tmp.innerHTML = chipHtml
  wrap.insertBefore(tmp.firstElementChild, inp)
}

export function removeStackTag(tag) {
  const wrap = document.getElementById('stack-tag-wrap')
  if (!wrap) return
  const tags = JSON.parse(wrap.dataset.tags || '[]')
  const idx = tags.indexOf(tag)
  if (idx < 0) return
  tags.splice(idx, 1)
  wrap.dataset.tags = JSON.stringify(tags)
  wrap.querySelector(`.tag-chip[data-tag="${tag.replace(/"/g, '&quot;')}"]`)?.remove()
}
```

**Step 3: Aggiornare `saveProject`** in `js/modal.js` per leggere stack dal wrap:

```js
export async function saveProject(event, name, onSaved) {
  event.preventDefault()
  const form = document.getElementById('edit-form')
  const fd = new FormData(form)
  const fields = {}
  for (const [k, v] of fd.entries()) {
    if (v !== '') fields[k] = v
  }
  // Stack from tag-input
  const wrap = document.getElementById('stack-tag-wrap')
  if (wrap) {
    fields.stack = JSON.parse(wrap.dataset.tags || '[]')
  }
  delete fields.stackRaw // backward compat if old form
  // Team members
  const rows = document.querySelectorAll('#team-members-list .member-row')
  const members = []
  rows.forEach((r) => {
    const m = {}
    r.querySelectorAll('input').forEach((i) => {
      const f = i.dataset.field
      if (i.value.trim()) m[f] = i.value.trim()
    })
    if (m.name) members.push(m)
  })
  fields.teamMembers = members

  try {
    await api.put(`/api/projects-meta/${encodeURIComponent(name)}`, fields)
    closeEditModal()
    if (typeof onSaved === 'function') onSaved(name)
    else if (typeof window.openProjectDetail === 'function') window.openProjectDetail(name)
  } catch {
    alert('Save failed')
  }
  return false
}
```

**Step 4: Esporre globalmente** in app.js:

```js
import {
  openEditProjectModal, closeEditModal, saveProject, switchEditTab,
  editField, editSelect, memberRow,
  removeStackTag,
  showMergeDialog, closeMergeModal, confirmMerge,
  showDsMergeDialog, closeDsMergeModal, confirmDsMerge,
} from './js/modal.js'
// ...
window.removeStackTag = removeStackTag
```

**Step 5: Verifica browser**
- Apri Edit → tab Identity → vedere "Stack" come tag-input
- Digitare "Next.js" + Enter → chip aggiunto, input vuoto
- Click × su chip → rimosso
- Backspace su input vuoto → rimuove ultimo chip
- Salva → ricarica detail → stack persiste

**Step 6: Commit**

```bash
git add packages/codegraph/public/js/modal.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): edit modal stack as removable tag-input"
```

---

## Task 15: Final polish + cleanup

**Files:**
- Modify: `js/render.js`
- Modify: `app.js`
- Modify: `style.css`

**Step 1: Rimuovere legacy `filterProjects`** in app.js (riga ~345 originale) — non serve più, c'è la nuova search. Eliminare la funzione e l'export `window.filterProjects`.

Verificare che nulla la chiami: `grep -n "filterProjects" packages/codegraph/public/`. Se references esistono, sostituirle.

**Step 2: Hash routing fix** — quando l'utente entra in `/projects` da nav-item, evitiamo che il query string venga preservato dalla sessione precedente (è già gestito da `applyHashOverrides` solo se presente). Aggiungere reset della search nell'header global-search per la pagina projects è già gestito.

Verificare in app.js (riga 41-49) che `searchEl.value = ''` resetti correttamente.

**Step 3: Aggiungere stato di loading** in `renderProjects`. Aggiungere all'inizio:

```js
export async function renderProjects() {
  document.getElementById('page').innerHTML = `<div style="padding:60px;text-align:center;color:var(--text-muted);font-size:13px">Loading projects…</div>`
  const [actData, metaData] = await Promise.all([
    api.get('/api/projects').catch(() => ({ projects: [] })),
    api.get('/api/projects-meta').catch(() => ({ projects: [] })),
  ])
  // … resto invariato
```

**Step 4: Responsive — assicurarsi che tutti i breakpoint funzionino**. Append finale a `style.css`:

```css
@media (max-width: 720px) {
  .proj-header { gap: 8px; }
  .proj-view-pill span { display: none } /* solo icona */
  .proj-toolbar { padding: 8px; }
  .proj-stats-segment { padding: 4px 8px; font-size: 11px; }
  .proj-stats-segment .n { font-size: 13px; }
}

/* Card actions visible always on touch */
@media (hover: none) {
  .proj-card-select { opacity: 1; }
}
```

**Step 5: Accessibility quick wins**

In `renderViewPill` aggiungere `aria-label`:

```js
function renderViewPill(view, icon, label, current) {
  const active = view === current
  return `<button class="proj-view-pill ${active ? 'active' : ''}" role="tab" aria-selected="${active}" aria-label="${label} view"
    onclick="changeProjectView('${view}')">${icon} <span>${label}</span></button>`
}
```

In `renderCardGrid` aggiungere `role="button" tabindex="0"`:

```js
return `<div class="proj-card-v2 ${stateClass ? 'state-'+stateClass : ''} ${isSelected ? 'selected' : ''}"
    role="button" tabindex="0"
    data-name="${escHtml(p.name)}" onclick="${onCardClick}"
    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openProjectDetail('${escHtml(p.name)}')}">
```

**Step 6: Verifica browser finale**
- Testa tutte le 4 viste, switching fluido
- Testa con 0 progetti → empty state zero
- Testa con filtri attivi che producono 0 risultati → empty state "no match"
- Testa drag&drop con un solo progetto in colonna
- Testa bulk delete su 3+ progetti
- Testa export → file scaricato
- Testa duplicate → nuovo progetto compare in vista
- Testa prev/next nel detail panel
- Testa edit modal con tutti i tab
- Testa tag-input stack: aggiungi 5 tag, salva, riapri → tutti presenti
- Verifica responsive: ridimensiona finestra fino a 400px

**Step 7: Commit finale**

```bash
git add packages/codegraph/public/js/render.js packages/codegraph/public/js/modal.js packages/codegraph/public/app.js packages/codegraph/public/style.css
git commit -m "feat(projects): polish, loading state, a11y, responsive, cleanup legacy filterProjects"
```

---

## Riepilogo task

| # | Task | Output |
|---|---|---|
| 1 | Foundation + view switcher | State object, switcher 4 pills, persistence base |
| 2 | Toolbar (filters/sort/group/search) | Filtri multi-select, hash sync, search funzionante |
| 3 | Stats bar | 4 segmenti clickable per status |
| 4 | Pin + Pinned section | Star toggle, sezione pinned in cima |
| 5 | Card v2 + Grid view | Card compatte, state borders, grid responsive |
| 6 | Card menu actions | Archive/Duplicate/Export/Delete funzionanti |
| 7 | List view | Vista densa tabellare |
| 8 | Kanban + DnD | 4 colonne + drag&drop ottimistico |
| 9 | Table view | Tabella sortabile per colonna |
| 10 | Bulk operations | Toolbar fluttuante + iterazione PUT/DELETE |
| 11 | Detail prev/next + 2-col | Nav nel detail, layout grid overview |
| 12 | Activity filter + group-by-day | Chip filter, raggruppamento per data |
| 13 | Edit modal tabs | 5 tab navigabili |
| 14 | Stack tag-input | Chip removable + Enter/Backspace |
| 15 | Polish + cleanup | Loading, a11y, responsive, rimozione legacy |

## Note per l'esecutore

1. **Avvia il dev server una sola volta** (Task 1) e tienilo aperto in background. Refresh manuale (Cmd-R) dopo ogni cambio file.
2. **Commit frequenti** — ogni task termina con un commit indipendente. Se un task fallisce a metà, lo riprendi da dove sei. Non amend di commit precedenti.
3. **Non fare git push** senza esplicita richiesta dell'utente.
4. **Se un test browser fallisce** → leggi gli errori console, applica il fix, NON andare avanti finché non verde.
5. **Backward compat**: tutti gli endpoint chiamati esistono già. Se ne aggiungi uno, è bug.
6. **Code reuse**: il file `js/render.js` contiene già `escHtml`, `badge`, `confBar` — usare quelle (sono in scope nel modulo).
7. **Filename `_meta`**: convenzione interna che ho usato per evitare collisione con altri campi quando si fa merge fra dati activity e meta. Mantienila.
