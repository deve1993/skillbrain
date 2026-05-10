# Whiteboard — 6 Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inspector drawer, frame header strip, SVG thumbnails, dark canvas mode, dock grouping, and multi-select align styling to the Synapse whiteboard.

**Architecture:** All frontend changes are in `packages/codegraph/public/whiteboard/` (vanilla ES modules, no build step). The thumbnail is generated client-side as an SVG data URL and sent with each save — the server already accepts `thumbnailDataUrl` in the PUT endpoint. No new dependencies.

**Tech Stack:** Vanilla JS ES modules, CSS custom properties, SVG string generation, localStorage for dark mode persistence.

---

## File Map

| File | What changes |
|------|-------------|
| `public/whiteboard.html` | Add inspector drawer `<div>`, dark toggle button in topbar, divider after select in dock |
| `public/whiteboard/whiteboard.css` | Inspector drawer styles, frame header strip styles, dark canvas CSS vars, align toolbar badge styling |
| `public/whiteboard/render.js` | Frame `renderNode()` → header strip layout instead of floating label |
| `public/whiteboard/main.js` | Inspector drawer mount/update logic, dark mode toggle + localStorage, SVG thumbnail generation, `doSave()` integration |

---

## Task 1: Frame Header Strip

Replace the floating `.wb-frame-label` badge with a structural header strip inside the frame.

**Files:**
- Modify: `packages/codegraph/public/whiteboard/render.js` (lines 145–148, the frame branch of `renderNode`)
- Modify: `packages/codegraph/public/whiteboard/whiteboard.css` (`.wb-frame`, `.wb-frame-label` sections ~lines 549–568)

- [ ] **Step 1: Update `renderNodes()` to pass child count to frame nodes**

In `render.js`, replace the `renderNodes` function:

```js
function renderNodes() {
  const { nodes, selection, matches, voting } = getState()
  const matchSet = new Set(matches)
  // Pre-compute how many non-frame nodes overlap each frame
  const frameChildCount = {}
  const frames = nodes.filter(n => n.type === 'frame')
  for (const f of frames) {
    frameChildCount[f.id] = nodes.filter(n =>
      n.id !== f.id && n.type !== 'frame' &&
      n.x >= f.x && n.y >= f.y &&
      n.x + n.w <= f.x + f.w + 20 &&
      n.y + n.h <= f.y + f.h + 20
    ).length
  }
  const html = nodes.map((n) => renderNode(n, selection.has(n.id), matchSet.has(n.id), voting, frameChildCount[n.id] ?? 0)).join('')
  $nodes.innerHTML = html
}
```

- [ ] **Step 2: Update `renderNode` signature and frame branch**

Change the function signature from:
```js
function renderNode(n, selected, isMatch, voting) {
```
to:
```js
function renderNode(n, selected, isMatch, voting, childCount = 0) {
```

Then replace the frame body (currently `body = \`<div class="wb-frame-label">...\``):

```js
  if (n.type === 'frame') {
    if (n.borderColor) cls.push('wb-frame-custom-border')
    const headerBg = n.color ? hexToRgba(n.color, 0.18) : 'rgba(99,102,241,0.12)'
    const headerBorder = n.color ? hexToRgba(n.color, 0.25) : 'rgba(99,102,241,0.2)'
    const iconBg = n.color ? hexToRgba(n.color, 0.55) : 'rgba(99,102,241,0.5)'
    const labelColor = n.color ? (getLuminance(n.color) > 0.4 ? '#374151' : '#1e293b') : '#4338ca'
    const countHtml = childCount > 0
      ? `<span class="wb-frame-count">${childCount}</span>`
      : ''
    body = `
      <div class="wb-frame-header" style="background:${headerBg};border-bottom:1.5px solid ${headerBorder}">
        <span class="wb-frame-icon" style="background:${iconBg}"></span>
        <span class="wb-frame-name" style="color:${labelColor}">${escHtml(n.name || 'Frame')}</span>
        ${countHtml}
      </div>
      <div class="wb-frame-body"></div>
    `
  }
```

- [ ] **Step 3: Update frame CSS — make frame a flex column, replace floating label**

In `whiteboard.css`, replace the `.wb-frame` and `.wb-frame-label` blocks:

```css
/* Frame */
.wb-frame {
  border: 1.5px solid rgba(99,102,241,0.4) !important;
  border-radius: 12px;
  padding: 0 !important;
  cursor: grab;
  overflow: hidden !important;   /* was: visible */
  display: flex;
  flex-direction: column;
}
.wb-frame.selected { border-color: #6366f1 !important; border-style: solid !important; }
.wb-frame.wb-frame-custom-border { border: var(--wb-custom-border) !important; }

/* Frame header strip (replaces .wb-frame-label) */
.wb-frame-header {
  height: 26px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 6px;
}
.wb-frame-icon {
  width: 10px; height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}
.wb-frame-name {
  font-size: 11px;
  font-weight: 700;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb-frame-count {
  font-size: 9px;
  opacity: 0.65;
  font-feature-settings: 'tnum';
}
.wb-frame-body {
  flex: 1;
}

/* Remove old floating label (keep for inline rename input) */
.wb-frame-label { display: none; }
.wb-frame-label.editing { display: block; }
.wb-frame-label-input {
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  color: #1e293b;
  background: #fff;
  border: none;
  outline: none;
  padding: 4px 8px;
  border-radius: 4px;
  width: 180px;
}
```

- [ ] **Step 4: Fix inline frame rename to target `.wb-frame-name` instead of `.wb-frame-label`**

In `main.js`, find `startInlineFrameRename` (search for `wb-frame-label-input`). Update selector from `[data-render-id]` on frame label to the new `.wb-frame-name`:

```js
function startInlineFrameRename(id) {
  const el = document.querySelector(`.wb-node[data-id="${id}"] .wb-frame-name`)
  if (!el) return
  el.style.display = 'none'
  const input = document.createElement('input')
  input.className = 'wb-frame-label-input'
  input.value = getState().nodes.find(n => n.id === id)?.name || ''
  el.parentElement.insertBefore(input, el)
  input.focus()
  input.select()
  const finish = () => {
    patchNode(id, { name: input.value })
    input.remove()
    el.style.display = ''
    commitHistory(); scheduleSave()
  }
  input.addEventListener('blur', finish)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur() } if (e.key === 'Escape') { input.remove(); el.style.display = '' } })
}
```

- [ ] **Step 5: Manual test — open a board with frames, verify header strip shows, count updates, rename works**

Open `http://localhost:{port}/whiteboard.html?id={any}`, apply the Retro template, verify three frames each show their colored header strip with name.

- [ ] **Step 6: Commit**

```bash
git add packages/codegraph/public/whiteboard/render.js \
        packages/codegraph/public/whiteboard/whiteboard.css \
        packages/codegraph/public/whiteboard.html
git commit -m "feat(whiteboard): frame header strip with color, icon, child count"
```

---

## Task 2: Inspector Drawer (above tool dock)

Context-sensitive properties panel that rises above the bottom dock when a node is selected.

**Files:**
- Modify: `packages/codegraph/public/whiteboard.html` (add drawer `<div>` before `</body>`)
- Modify: `packages/codegraph/public/whiteboard/whiteboard.css` (add inspector styles)
- Modify: `packages/codegraph/public/whiteboard/main.js` (add `updateInspectorDrawer()` + wire controls)

- [ ] **Step 1: Add inspector drawer HTML to `whiteboard.html`**

Add before the `<script>` tags at the bottom:

```html
<!-- Inspector drawer — rises above tool dock when node selected -->
<div id="wb-inspector-drawer" class="wb-inspector-drawer" style="display:none"></div>
```

- [ ] **Step 2: Add inspector drawer CSS to `whiteboard.css`**

```css
/* ── Inspector Drawer (above tool dock) ── */
.wb-inspector-drawer {
  position: fixed;
  bottom: 64px;   /* sits above the dock (dock is ~52px + 12px gap) */
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06);
  padding: 6px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 85;
  white-space: nowrap;
  animation: wb-insp-in 0.12s ease-out;
}
@keyframes wb-insp-in {
  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.wb-insp-label {
  font-size: 9px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: .4px;
}
.wb-insp-colors {
  display: flex;
  gap: 4px;
  align-items: center;
}
.wb-insp-swatch {
  width: 16px; height: 16px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.1s;
  flex-shrink: 0;
}
.wb-insp-swatch:hover { transform: scale(1.15); }
.wb-insp-swatch.active { border-color: #0f172a; transform: scale(1.15); }
.wb-insp-swatch.custom {
  background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
  border: 1.5px dashed #cbd5e1;
}
.wb-insp-divider {
  width: 1px; height: 22px;
  background: #e2e8f0;
  margin: 0 2px;
  flex-shrink: 0;
}
.wb-insp-slider-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
}
.wb-insp-slider {
  -webkit-appearance: none;
  width: 72px; height: 4px;
  border-radius: 2px;
  background: #e2e8f0;
  outline: none;
  cursor: pointer;
}
.wb-insp-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: #6366f1;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(99,102,241,0.35);
  cursor: pointer;
}
.wb-insp-val {
  font-size: 10px;
  color: #1e293b;
  min-width: 26px;
  text-align: right;
  font-feature-settings: 'tnum';
}
.wb-insp-seg {
  display: flex;
  gap: 2px;
}
.wb-insp-seg-btn {
  width: 26px; height: 22px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-size: 11px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.wb-insp-seg-btn.active { background: #eef2ff; border-color: #6366f1; color: #4338ca; }
.wb-insp-tag {
  font-size: 9px;
  background: #f1f5f9;
  color: #64748b;
  padding: 2px 6px;
  border-radius: 4px;
}
.wb-insp-color-input {
  position: fixed; opacity: 0; width: 0; height: 0; pointer-events: none;
}
```

- [ ] **Step 3: Add `updateInspectorDrawer()` function to `main.js`**

Add after the `updateFloatingToolbar` function (around line 213):

```js
const INSPECTOR_PALETTE = ['#fef3c7','#dcfce7','#dbeafe','#fce7f3','#e0e7ff','#fed7aa','#fff','#1e293b']
const BORDER_STYLES = ['none','solid','dashed','dotted']

let inspColorInput = null
function updateInspectorDrawer() {
  const drawer = document.getElementById('wb-inspector-drawer')
  if (!drawer) return
  const sel = [...getState().selection]
  if (!sel.length || isReadOnly) { drawer.style.display = 'none'; return }

  // Determine primary node type
  const nodes = getState().nodes
  const selected = sel.map(id => nodes.find(n => n.id === id)).filter(Boolean)
  if (!selected.length) { drawer.style.display = 'none'; return }
  // Skip if editing text
  if (selected.some(n => n.editing)) { drawer.style.display = 'none'; return }

  const primary = selected[0]
  const type = primary.type

  // Check if it's a connector selection (connectors aren't in nodes)
  const connectors = getState().connectors
  const selectedConn = sel.map(id => connectors.find(c => c.id === id)).filter(Boolean)
  if (selectedConn.length && !selected.length) { drawer.style.display = 'none'; return }

  let html = ''

  // BG color swatches (sticky, frame, sb-card, shape)
  if (['sticky','frame','sb-card','shape'].includes(type)) {
    const curColor = primary.color || ''
    html += `<span class="wb-insp-label">BG</span>`
    html += `<div class="wb-insp-colors">`
    for (const c of INSPECTOR_PALETTE) {
      const active = curColor === c ? ' active' : ''
      const borderStyle = c === '#fff' ? 'border-color:#cbd5e1' : ''
      html += `<span class="wb-insp-swatch${active}" data-insp-color="${c}" style="background:${c};${borderStyle}" title="${c}"></span>`
    }
    html += `<input type="color" class="wb-insp-color-input" id="wb-insp-color-picker" value="${curColor && curColor.startsWith('#') ? curColor : '#fef3c7'}">`
    html += `<span class="wb-insp-swatch custom" data-insp-color-picker title="Custom color"></span>`
    html += `</div>`
    html += `<span class="wb-insp-divider"></span>`
  }

  // Font size slider (sticky only)
  if (type === 'sticky') {
    const fs = primary.fontSize ?? 13
    html += `<span class="wb-insp-label">Size</span>`
    html += `<div class="wb-insp-slider-wrap">`
    html += `<input type="range" class="wb-insp-slider" id="wb-insp-fontsize" min="8" max="32" step="1" value="${fs}">`
    html += `<span class="wb-insp-val" id="wb-insp-fontsize-val">${fs}</span>`
    html += `</div>`
    html += `<span class="wb-insp-divider"></span>`
  }

  // Opacity slider (frame)
  if (type === 'frame') {
    const op = Math.round((primary.opacity ?? 0.08) * 100)
    html += `<span class="wb-insp-label">Fill</span>`
    html += `<div class="wb-insp-slider-wrap">`
    html += `<input type="range" class="wb-insp-slider" id="wb-insp-opacity" min="0" max="40" step="2" value="${op}">`
    html += `<span class="wb-insp-val" id="wb-insp-opacity-val">${op}%</span>`
    html += `</div>`
    html += `<span class="wb-insp-divider"></span>`
  }

  // Border style (sticky, frame)
  if (['sticky','frame'].includes(type)) {
    const curStyle = primary.borderStyle || (primary.borderColor ? 'solid' : 'none')
    html += `<span class="wb-insp-label">Border</span>`
    html += `<div class="wb-insp-seg">`
    const labels = { none: '—', solid: '▬', dashed: '╌', dotted: '···' }
    for (const s of BORDER_STYLES) {
      const active = curStyle === s ? ' active' : ''
      html += `<button class="wb-insp-seg-btn${active}" data-insp-border="${s}" title="${s}">${labels[s]}</button>`
    }
    html += `</div>`
    html += `<span class="wb-insp-divider"></span>`
  }

  // Connector style (when connector selected — connectors have their own IDs)
  // Note: connector selection is tracked via selection Set with connector IDs
  // (future: connector selection support)

  // Type badge
  html += `<span class="wb-insp-tag">${type}</span>`

  drawer.innerHTML = html
  drawer.style.display = 'flex'

  // Wire events
  drawer.querySelectorAll('[data-insp-color]').forEach(el => {
    el.addEventListener('click', () => {
      const c = el.dataset.inspColor
      sel.forEach(id => patchNode(id, { color: c }))
      scheduleSave()
      updateInspectorDrawer()
    })
  })

  const picker = drawer.querySelector('[data-insp-color-picker]')
  const pickerInput = drawer.querySelector('#wb-insp-color-picker')
  if (picker && pickerInput) {
    picker.addEventListener('click', () => pickerInput.click())
    pickerInput.addEventListener('input', () => {
      sel.forEach(id => patchNode(id, { color: pickerInput.value }))
      scheduleSave()
    })
  }

  const fsSlider = drawer.querySelector('#wb-insp-fontsize')
  const fsVal = drawer.querySelector('#wb-insp-fontsize-val')
  if (fsSlider) {
    fsSlider.addEventListener('input', () => {
      const v = parseInt(fsSlider.value)
      if (fsVal) fsVal.textContent = v
      sel.forEach(id => patchNode(id, { fontSize: v }))
    })
    fsSlider.addEventListener('change', () => { commitHistory(); scheduleSave() })
  }

  const opSlider = drawer.querySelector('#wb-insp-opacity')
  const opVal = drawer.querySelector('#wb-insp-opacity-val')
  if (opSlider) {
    opSlider.addEventListener('input', () => {
      const v = parseInt(opSlider.value)
      if (opVal) opVal.textContent = v + '%'
      sel.forEach(id => patchNode(id, { opacity: v / 100 }))
    })
    opSlider.addEventListener('change', () => { commitHistory(); scheduleSave() })
  }

  drawer.querySelectorAll('[data-insp-border]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.inspBorder
      sel.forEach(id => {
        if (s === 'none') patchNode(id, { borderStyle: 'none', borderColor: undefined })
        else patchNode(id, { borderStyle: s, borderColor: primary.borderColor || '#6366f1' })
      })
      commitHistory(); scheduleSave()
      updateInspectorDrawer()
    })
  })
}
```

- [ ] **Step 4: Call `updateInspectorDrawer()` from the render loop**

In `main.js`, inside the `scheduleRender` callback (around line 78), add:

```js
function scheduleRender() {
  if (renderQueued) return
  renderQueued = true
  requestAnimationFrame(() => {
    renderQueued = false
    render()
    highlightCode()
    updateEmptyState()
    updateFloatingToolbar()
    updateInspectorDrawer()   // ← add this line
    updateMinimap()
  })
}
```

- [ ] **Step 5: Manual test — select a sticky, verify drawer appears with color swatches, font size slider works live; select a frame, verify opacity slider; deselect, verify drawer hides**

- [ ] **Step 6: Commit**

```bash
git add packages/codegraph/public/whiteboard.html \
        packages/codegraph/public/whiteboard/whiteboard.css \
        packages/codegraph/public/whiteboard/main.js
git commit -m "feat(whiteboard): inspector drawer above tool dock"
```

---

## Task 3: SVG Thumbnail Generation

Generate an SVG thumbnail from the board state and send it with each save. The server already accepts `thumbnailDataUrl` in `PUT /api/whiteboards/:id`.

**Files:**
- Modify: `packages/codegraph/public/whiteboard/main.js` (add `generateThumbnailSvg()`, update `doSave()`)

- [ ] **Step 1: Add `generateThumbnailSvg()` to `main.js`**

Add after the `doSave` function:

```js
function generateThumbnailSvg() {
  const { nodes, connectors } = getState()
  if (!nodes.length) return null

  const W = 200, H = 100
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h)
  }
  const worldW = Math.max(1, maxX - minX)
  const worldH = Math.max(1, maxY - minY)
  // Scale with 5% padding
  const pad = 0.05
  const scaleX = W * (1 - 2 * pad) / worldW
  const scaleY = H * (1 - 2 * pad) / worldH
  const scale = Math.min(scaleX, scaleY)
  const offX = W / 2 - (minX + worldW / 2) * scale
  const offY = H / 2 - (minY + worldH / 2) * scale

  const toX = x => ((x - minX) * scale + W * pad).toFixed(1)
  const toY = y => ((y - minY) * scale + H * pad).toFixed(1)
  const toW = w => Math.max(2, (w * scale)).toFixed(1)
  const toH = h => Math.max(2, (h * scale)).toFixed(1)

  const NODE_COLORS = {
    sticky: '#fde68a', frame: 'rgba(99,102,241,0.15)', code: '#334155',
    'sb-card': '#6366f1', shape: '#a5b4fc', image: '#94a3b8',
    emoji: '#fde68a', group: 'rgba(168,85,247,0.2)', pen: '#64748b',
  }

  let rects = ''
  // Frames first (render below stickies)
  for (const n of nodes.filter(n => n.type === 'frame')) {
    const fill = n.color ? `${n.color}26` : 'rgba(99,102,241,0.1)'
    const stroke = n.color ? `${n.color}66` : 'rgba(99,102,241,0.4)'
    rects += `<rect x="${toX(n.x)}" y="${toY(n.y)}" width="${toW(n.w)}" height="${toH(n.h)}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="0.8"/>`
    // Frame header strip (proportional 14% height, min 4px)
    const headerH = Math.max(4, n.h * scale * 0.14)
    rects += `<rect x="${toX(n.x)}" y="${toY(n.y)}" width="${toW(n.w)}" height="${headerH.toFixed(1)}" rx="3" fill="${n.color ? n.color + '40' : 'rgba(99,102,241,0.25)'}"/>`
  }
  // Other nodes
  for (const n of nodes.filter(n => n.type !== 'frame')) {
    const fill = n.color || NODE_COLORS[n.type] || '#94a3b8'
    rects += `<rect x="${toX(n.x)}" y="${toY(n.y)}" width="${toW(n.w)}" height="${toH(n.h)}" rx="2" fill="${fill}" opacity="0.85"/>`
  }
  // Connectors as straight lines
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  let lines = ''
  for (const c of connectors) {
    const a = nodeMap.get(c.from), b = nodeMap.get(c.to)
    if (!a || !b) continue
    const ax = parseFloat(toX(a.x + a.w / 2)), ay = parseFloat(toY(a.y + a.h / 2))
    const bx = parseFloat(toX(b.x + b.w / 2)), by = parseFloat(toY(b.y + b.h / 2))
    const stroke = c.color || '#64748b'
    lines += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${stroke}" stroke-width="0.8" stroke-opacity="0.55"/>`
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0f172a"/>${lines}${rects}</svg>`
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}
```

- [ ] **Step 2: Send thumbnail in `doSave()`**

Update the `doSave` function to include the thumbnail:

```js
async function doSave() {
  if (isReadOnly) { setSaveState('idle'); return }
  if (savingNow) { scheduleSave(); return }
  savingNow = true
  const stateJson = serialize()
  const expectedVersion = getState().stateVersion
  const thumbnailDataUrl = generateThumbnailSvg()   // ← add this line
  try {
    const { board } = await wb.save(boardId, { stateJson, expectedVersion, thumbnailDataUrl })  // ← add thumbnailDataUrl
    update({ stateVersion: board.stateVersion })
    setSaveState('saved')
  } catch (err) {
    // ... existing error handling unchanged
  } finally {
    savingNow = false
  }
}
```

- [ ] **Step 3: Verify `wb.save` passes `thumbnailDataUrl` to the API**

Check `packages/codegraph/public/whiteboard/api.js` — find the `save` method and confirm it passes the full body object. If it only passes `{ stateJson, expectedVersion }`, update it to spread the rest:

```js
// In api.js, the save method should be:
save: (id, body) => request(`PUT /api/whiteboards/${id}`, body),
// or equivalent — just ensure the full body object is passed through
```

- [ ] **Step 4: Update whiteboard list page to render thumbnail**

Find the list page component (likely in the main app `src/app` or `public/app.js`/`index.html`). Search for the card rendering code:

```bash
grep -rn "No preview\|thumbnail\|wb-card-thumb" packages/codegraph/public/ --include="*.js" --include="*.html" | head -20
```

Replace the placeholder `"No preview"` rendering with:

```js
// In the card rendering function:
const thumbHtml = board.thumbnailDataUrl
  ? `<img src="${board.thumbnailDataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`
  : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#475569;font-size:11px">No preview</div>`
```

- [ ] **Step 5: Manual test — save any board with nodes, navigate to the whiteboard list, verify thumbnail appears instead of "No preview"**

- [ ] **Step 6: Commit**

```bash
git add packages/codegraph/public/whiteboard/main.js
git commit -m "feat(whiteboard): SVG thumbnail auto-generation on save"
```

---

## Task 4: Dark Canvas Mode

Toggle that switches canvas background + grid to dark theme. Persisted in localStorage.

**Files:**
- Modify: `packages/codegraph/public/whiteboard.html` (add toggle button in topbar)
- Modify: `packages/codegraph/public/whiteboard/whiteboard.css` (dark canvas CSS)
- Modify: `packages/codegraph/public/whiteboard/main.js` (toggle behavior)

- [ ] **Step 1: Add dark mode toggle button to `whiteboard.html`**

In the topbar `<div class="wb-right">`, add before the export button:

```html
<button id="btn-dark" class="wb-btn wb-collapse-medium" title="Dark canvas mode">🌙</button>
```

- [ ] **Step 2: Add dark canvas CSS to `whiteboard.css`**

Add after the `#wb-canvas-container` rules:

```css
/* ── Dark canvas mode ── */
#wb-canvas-container.wb-dark-canvas {
  background: #0f172a;
}
#wb-canvas-container.wb-dark-canvas #wb-grid {
  background-image: radial-gradient(circle, rgba(99,102,241,0.3) 1px, transparent 1px);
}
#wb-canvas-container.wb-dark-canvas .wb-node {
  border-color: rgba(255,255,255,0.08);
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
}
#wb-canvas-container.wb-dark-canvas .wb-node:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
}
#wb-canvas-container.wb-dark-canvas .wb-node.selected {
  outline-color: #818cf8;
}
/* Sticky notes in dark mode — bg color stays, add dark border */
#wb-canvas-container.wb-dark-canvas .wb-sticky-render {
  /* text color auto-computed by getContrastColor — no override needed */
}
/* Empty state card on dark canvas */
#wb-canvas-container.wb-dark-canvas .wb-empty-card {
  background: #1e293b;
  border-color: #334155;
  color: #e2e8f0;
}
#wb-canvas-container.wb-dark-canvas .wb-empty-card h2 { color: #f1f5f9; }
#wb-canvas-container.wb-dark-canvas .wb-empty-card p { color: #94a3b8; }
#wb-canvas-container.wb-dark-canvas .wb-empty-card li { color: #cbd5e1; }
```

- [ ] **Step 3: Add dark mode toggle logic to `main.js`**

Add after `bindUI()` setup (search for `btn-fullscreen` binding, add nearby):

```js
// Dark canvas mode
const btnDark = $('#btn-dark')
if (btnDark) {
  const container = document.getElementById('wb-canvas-container')
  const applyDark = (on) => {
    container.classList.toggle('wb-dark-canvas', on)
    btnDark.textContent = on ? '☀️' : '🌙'
    btnDark.title = on ? 'Light canvas mode' : 'Dark canvas mode'
  }
  // Restore from localStorage
  applyDark(localStorage.getItem('wb-dark') === '1')
  btnDark.addEventListener('click', () => {
    const next = !container.classList.contains('wb-dark-canvas')
    applyDark(next)
    localStorage.setItem('wb-dark', next ? '1' : '0')
  })
}
```

- [ ] **Step 4: Manual test — toggle dark mode, verify canvas goes dark, grid changes to indigo tint, sticky notes remain readable, preference survives page reload**

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/public/whiteboard.html \
        packages/codegraph/public/whiteboard/whiteboard.css \
        packages/codegraph/public/whiteboard/main.js
git commit -m "feat(whiteboard): dark canvas mode toggle with localStorage persistence"
```

---

## Task 5: Tool Dock — Add Divider After Select

The dock already has dividers between groups 2/3/4. Missing one: between the cursor (select) and the canvas objects (sticky/frame/code).

**Files:**
- Modify: `packages/codegraph/public/whiteboard.html` (add one `<span class="wb-tooldock-divider">`)

- [ ] **Step 1: Add divider after select button in `whiteboard.html`**

Find the dock section. After the `data-tool="select"` button and before `data-tool="sticky"`, add:

```html
    <button class="wb-tool" data-tool="select" title="Select (V)" aria-label="Select">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 2 L5 18 L9 14 L11 19 L13 18 L11 13 L17 13 Z"/></svg>
    </button>
    <span class="wb-tooldock-divider"></span>   <!-- ← add this line -->
    <button class="wb-tool" data-tool="sticky" ...>
```

- [ ] **Step 2: Remove pen from the connector group — move it between connectors and shapes**

Currently pen is in the connector group (between the second and third dividers). This is unintuitive — pen is a drawing tool closer to shapes. Move it after the connector/line group divider and before shapes:

```html
    <!-- Connectors group -->
    <button class="wb-tool" data-tool="connector" ...>Connector</button>
    <button class="wb-tool" data-tool="line" ...>Line</button>
    <span class="wb-tooldock-divider"></span>
    <!-- Drawing / Shapes group -->
    <button class="wb-tool" data-tool="pen" ...>Pen</button>
    <button class="wb-tool" data-tool="shape-rect" ...>
    <button class="wb-tool" data-tool="shape-ellipse" ...>
    <button class="wb-tool" data-tool="shape-triangle" ...>
    <span class="wb-tooldock-divider"></span>
    <!-- Media + extras -->
    ...
```

- [ ] **Step 3: Verify dock in browser — 5 groups clearly separated: [Select] | [Sticky+Frame+Code] | [Connector+Line] | [Pen+Rect+Ellipse+Triangle] | [Image+Emoji+Vote]**

- [ ] **Step 4: Commit**

```bash
git add packages/codegraph/public/whiteboard.html
git commit -m "feat(whiteboard): tool dock — add divider after select, move pen to drawing group"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|-----------------|------|
| Inspector drawer — BG color swatches | Task 2 ✓ |
| Inspector drawer — font size slider | Task 2 ✓ |
| Inspector drawer — border style toggle | Task 2 ✓ |
| Inspector drawer — opacity slider for frames | Task 2 ✓ |
| Inspector drawer — animates in above dock | Task 2 ✓ (CSS animation) |
| Frame header strip with color + icon + count | Task 1 ✓ |
| Frame inline rename | Task 1 Step 4 ✓ |
| SVG thumbnail on save | Task 3 ✓ |
| Thumbnail in list page | Task 3 Step 4 ✓ |
| Dark canvas mode toggle | Task 4 ✓ |
| Dark mode localStorage persistence | Task 4 ✓ |
| Tool dock grouping | Task 5 ✓ |
| Multi-select align toolbar | Already implemented in `updateFloatingToolbar()` — no new task needed |

### Potential issues identified

1. **`btoa` and unicode SVG** — the thumbnail SVG might contain unicode frame names. `btoa(unescape(encodeURIComponent(svg)))` in Task 3 Step 1 handles this correctly.

2. **Frame `overflow: hidden` breaks existing inline rename input** — addressed in Task 1 Step 4 by updating `startInlineFrameRename` to target `.wb-frame-name` and insert the input inside the header.

3. **Inspector drawer `bottom: 64px`** — assumes the dock is ~52px tall. If the dock height changes, update this value. The dock CSS `.wb-tooldock` has `padding: 6px` + buttons `36px` + `border` ≈ 50px. 64px gives safe clearance.

4. **Connector color inspector** — the spec mentions connector style control but connector IDs are not currently added to `selection` (selection tracks node IDs only). Connector style is currently only settable via MCP tools. This is noted as a future enhancement — not a bug in this plan.
