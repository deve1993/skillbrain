// Synapse Whiteboard — orchestrator
// Wires everything together: load board, render, interact, save, panels.

import { wb } from './api.js'
import { getState, update, hydrate, serialize, addNode, nid, addConnector, patchNode, removeNodes, subscribe, initHistory, commitHistory } from './state.js'
import { render, highlightCode, enterEditMode } from './render.js'
import { init as initInteract, fitToView, clientToCanvas } from './interact.js'
import { initTooltips } from './tooltip.js'

const $ = (s) => document.querySelector(s)

// ── Bootstrap ──

const params = new URLSearchParams(location.search)
const boardId = params.get('id')
const shareToken = params.get('share')
const focusNode = params.get('node')
const isReadOnly = !!shareToken

if (!boardId && !shareToken) {
  document.body.innerHTML = '<p style="padding:40px;color:#64748b">Missing ?id or ?share parameter. <a href="/#/whiteboards">Back to list</a></p>'
  throw new Error('no board id or share token')
}

;(async function start() {
  try {
    let board
    let authors = []
    let me = { email: 'viewer@local', color: '#94a3b8', name: 'Viewer' }
    if (isReadOnly) {
      const r = await wb.readShared(shareToken)
      board = r.board
    } else {
      const [{ board: b }, m, { authors: a }] = await Promise.all([
        wb.read(boardId),
        wb.myColor(),
        wb.authors(boardId),
      ])
      board = b; me = m; authors = a
    }
    update({ myEmail: me.email, myColor: me.color, myName: me.name, authors })
    hydrate(board)
    initHistory()
    $('#wb-name').value = board.name
    if (isReadOnly) $('#wb-name').readOnly = true
    $('#wb-meta').textContent = (isReadOnly ? '👁 Read-only · ' : '') + (board.scope === 'project' ? `Project · ${board.projectName}` : 'Team')
    document.title = `Synapse · ${board.name}` + (isReadOnly ? ' (read-only)' : '')
    if (isReadOnly) document.body.classList.add('wb-readonly')
    renderAuthorLegend(authors)
    if (!isReadOnly) await refreshCommentCounts()
    bindUI()
    initTooltips()
    initInteract({ onChange: isReadOnly ? () => {} : scheduleSave })
    render()
    highlightCode()
    fitToView()
    setTimeout(() => {
      if (focusNode) jumpToNode(focusNode)
    }, 100)
  } catch (err) {
    console.error('Failed to load board:', err)
    document.body.innerHTML = `<p style="padding:40px;color:#b91c1c">Error: ${err.message}</p>`
  }
})()

// Re-render on every state change (debounced via rAF)
let renderQueued = false
function scheduleRender() {
  if (renderQueued) return
  renderQueued = true
  requestAnimationFrame(() => {
    renderQueued = false
    render()
    highlightCode()
    updateEmptyState()
    updateFloatingToolbar()
    updateInspectorDrawer()
    updateMinimap()
  })
}
subscribe(scheduleRender)

function updateEmptyState() {
  const empty = $('#wb-empty-state')
  if (!empty) return
  empty.style.display = getState().nodes.length === 0 ? 'flex' : 'none'
}

function updateMinimap() {
  const mini = $('#wb-minimap')
  const svg = $('#wb-minimap-svg')
  if (!mini || !svg) return
  const { nodes, viewport } = getState()
  if (!nodes.length) { mini.style.display = 'none'; return }
  // Compute world bbox covering all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h)
  }
  // Add 10% padding
  const padX = (maxX - minX) * 0.1 || 100
  const padY = (maxY - minY) * 0.1 || 100
  minX -= padX; minY -= padY; maxX += padX; maxY += padY
  // Show only when zoomed in enough that you can't see the full content
  const containerRect = document.getElementById('wb-canvas-container').getBoundingClientRect()
  const visibleWorldW = containerRect.width / viewport.zoom
  const visibleWorldH = containerRect.height / viewport.zoom
  const totalW = maxX - minX, totalH = maxY - minY
  const showMinimap = visibleWorldW < totalW * 0.9 || visibleWorldH < totalH * 0.9
  if (!showMinimap) { mini.style.display = 'none'; return }
  mini.style.display = 'block'
  svg.setAttribute('viewBox', `${minX} ${minY} ${totalW} ${totalH}`)
  // Render simplified rects + viewport indicator
  const nodeRects = nodes.map((n) => `<rect class="node" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3"/>`).join('')
  // Viewport rect = visible world area
  const vpX = -viewport.x / viewport.zoom
  const vpY = -viewport.y / viewport.zoom
  const vpW = visibleWorldW
  const vpH = visibleWorldH
  svg.innerHTML = nodeRects + `<rect class="viewport" x="${vpX}" y="${vpY}" width="${vpW}" height="${vpH}" rx="2"/>`
}

// Click on minimap → recenter viewport
const $minimap = document.getElementById('wb-minimap')
if ($minimap) {
  $minimap.addEventListener('click', (e) => {
    const svg = $('#wb-minimap-svg')
    const rect = svg.getBoundingClientRect()
    const vb = svg.viewBox.baseVal
    const wx = vb.x + (e.clientX - rect.left) / rect.width * vb.width
    const wy = vb.y + (e.clientY - rect.top) / rect.height * vb.height
    const containerRect = document.getElementById('wb-canvas-container').getBoundingClientRect()
    const zoom = getState().viewport.zoom
    update({ viewport: {
      zoom,
      x: containerRect.width / 2 - wx * zoom,
      y: containerRect.height / 2 - wy * zoom,
    }})
  })
}

const STICKY_PALETTE = ['#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#e0e7ff', '#fed7aa', '#fff', '#1e293b']

let floatingToolbarEl = null
function updateFloatingToolbar() {
  const sel = [...getState().selection]
  if (floatingToolbarEl) { floatingToolbarEl.remove(); floatingToolbarEl = null }
  if (!sel.length) return
  const node = getState().nodes.find((x) => x.id === sel[0])
  if (!node || node.editing) return

  const el = document.createElement('div')
  el.className = 'wb-floating-toolbar'
  let html = ''
  // Color swatches for sticky/frame
  if (node.type === 'sticky' || node.type === 'frame' || node.type === 'sb-card') {
    const COLOR_NAMES = { '#fef3c7':'Yellow','#dcfce7':'Green','#dbeafe':'Blue','#fce7f3':'Pink','#e0e7ff':'Purple','#fed7aa':'Orange','#fff':'White','#1e293b':'Dark' }
    html += STICKY_PALETTE.map((c) => `<span class="swatch" data-color="${c}" data-tip="Color: ${COLOR_NAMES[c] || c}" style="background:${c};${c === '#fff' ? 'border-color:#cbd5e1' : ''}"></span>`).join('')
    html += '<span class="divider"></span>'
  }
  if (sel.length === 1 && node.type === 'sticky') {
    html += '<button data-act="edit" title="Edit text"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>'
  }
  if (sel.length === 1 && node.type === 'code') {
    html += '<button data-act="edit-code" title="Edit code">{...}</button>'
  }
  if (sel.length === 1 && node.type === 'frame') {
    html += '<button data-act="rename" title="Rename frame">Aa</button>'
  }
  // Align/Distribute when 2+ selected
  if (sel.length >= 2) {
    html += '<button data-act="align-left" title="Align left edges">⫶◀</button>'
    html += '<button data-act="align-center-x" title="Align horizontal centers">⫶◆⫶</button>'
    html += '<button data-act="align-right" title="Align right edges">▶⫶</button>'
    html += '<button data-act="align-top" title="Align top edges">⫶▲</button>'
    html += '<button data-act="align-middle-y" title="Align vertical centers">⫶◆⫶</button>'
    html += '<button data-act="align-bottom" title="Align bottom edges">▼⫶</button>'
    if (sel.length >= 3) {
      html += '<button data-act="distribute-h" title="Distribute horizontally (equal spacing)">↔</button>'
      html += '<button data-act="distribute-v" title="Distribute vertically (equal spacing)">↕</button>'
    }
    html += '<span class="divider"></span>'
  }
  // Group/Ungroup
  if (sel.length >= 2) html += '<button data-act="group" title="Group (⌘G)">⊞</button>'
  if (sel.length === 1 && node.type === 'group') html += '<button data-act="ungroup" title="Ungroup (⌘⇧G)">⊟</button>'
  // Lock toggle
  html += `<button data-act="lock" title="${node.locked ? 'Unlock' : 'Lock'} (⌘L)">${node.locked ? '🔓' : '🔒'}</button>`
  html += '<button data-act="duplicate" title="Duplicate (⌘D)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>'
  html += '<button data-act="delete" title="Delete (Del)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg></button>'
  el.innerHTML = html

  // Position above the topmost selected node — must add canvas-container's
  // viewport offset (sidebar pushes container right by 220px / 56px collapsed).
  const minY = Math.min(...sel.map((id) => getState().nodes.find((n) => n.id === id)?.y ?? 0))
  const minX = Math.min(...sel.map((id) => getState().nodes.find((n) => n.id === id)?.x ?? 0))
  const vp = getState().viewport
  const containerRect = document.getElementById('wb-canvas-container').getBoundingClientRect()
  const screenX = containerRect.left + minX * vp.zoom + vp.x
  const screenY = containerRect.top + minY * vp.zoom + vp.y - 44 /* toolbar height */
  el.style.left = Math.max(containerRect.left + 8, Math.min(window.innerWidth - 240, screenX)) + 'px'
  el.style.top = Math.max(56, screenY) + 'px'

  document.body.appendChild(el)
  floatingToolbarEl = el

  el.querySelectorAll('[data-color]').forEach((s) => s.addEventListener('click', () => {
    const c = s.dataset.color
    sel.forEach((id) => patchNodeColor(id, c))
    scheduleSave()
  }))
  el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => handleToolbarAction(b.dataset.act, sel)))
}

const INSPECTOR_PALETTE = ['#fef3c7','#dcfce7','#dbeafe','#fce7f3','#e0e7ff','#fed7aa','#fff','#1e293b']
const BORDER_STYLES = ['none','solid','dashed','dotted']

function updateInspectorDrawer() {
  const drawer = document.getElementById('wb-inspector-drawer')
  if (!drawer) return
  const sel = [...getState().selection]
  if (!sel.length || isReadOnly) { drawer.style.display = 'none'; return }

  const nodes = getState().nodes
  const selected = sel.map(id => nodes.find(n => n.id === id)).filter(Boolean)
  if (!selected.length) { drawer.style.display = 'none'; return }
  if (selected.some(n => n.editing)) { drawer.style.display = 'none'; return }

  const primary = selected[0]
  const type = primary.type

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

function patchNodeColor(id, color) {
  patchNode(id, { color })
}

function handleToolbarAction(act, sel) {
  if (act === 'delete') { removeNodes(sel); commitHistory(); scheduleSave(); return }
  if (act === 'duplicate') { duplicateSelection(sel); return }
  if (act === 'edit') { enterEditMode(sel[0]); return }
  if (act === 'rename') { startInlineFrameRename(sel[0]); return }
  if (act === 'edit-code') { openCodeEditor(sel[0]); return }
  if (act === 'lock') {
    const allLocked = sel.every((id) => getState().nodes.find((n) => n.id === id)?.locked)
    for (const id of sel) patchNode(id, { locked: !allLocked })
    commitHistory(); scheduleSave(); return
  }
  if (act === 'group') {
    // Trigger Cmd+G simulation
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', metaKey: true }))
    return
  }
  if (act === 'ungroup') {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', metaKey: true, shiftKey: true }))
    return
  }
  // Align / Distribute
  const nodes = sel.map((id) => getState().nodes.find((n) => n.id === id)).filter(Boolean)
  if (nodes.length < 2) return
  if (act === 'align-left') {
    const x = Math.min(...nodes.map((n) => n.x))
    nodes.forEach((n) => patchNode(n.id, { x }))
  } else if (act === 'align-right') {
    const right = Math.max(...nodes.map((n) => n.x + n.w))
    nodes.forEach((n) => patchNode(n.id, { x: right - n.w }))
  } else if (act === 'align-center-x') {
    const cx = nodes.reduce((s, n) => s + n.x + n.w / 2, 0) / nodes.length
    nodes.forEach((n) => patchNode(n.id, { x: cx - n.w / 2 }))
  } else if (act === 'align-top') {
    const y = Math.min(...nodes.map((n) => n.y))
    nodes.forEach((n) => patchNode(n.id, { y }))
  } else if (act === 'align-bottom') {
    const bottom = Math.max(...nodes.map((n) => n.y + n.h))
    nodes.forEach((n) => patchNode(n.id, { y: bottom - n.h }))
  } else if (act === 'align-middle-y') {
    const cy = nodes.reduce((s, n) => s + n.y + n.h / 2, 0) / nodes.length
    nodes.forEach((n) => patchNode(n.id, { y: cy - n.h / 2 }))
  } else if (act === 'distribute-h') {
    const sorted = [...nodes].sort((a, b) => a.x - b.x)
    const total = sorted[sorted.length - 1].x - sorted[0].x
    const gap = total / (sorted.length - 1)
    sorted.forEach((n, i) => patchNode(n.id, { x: sorted[0].x + i * gap }))
  } else if (act === 'distribute-v') {
    const sorted = [...nodes].sort((a, b) => a.y - b.y)
    const total = sorted[sorted.length - 1].y - sorted[0].y
    const gap = total / (sorted.length - 1)
    sorted.forEach((n, i) => patchNode(n.id, { y: sorted[0].y + i * gap }))
  }
  commitHistory(); scheduleSave()
}

function duplicateSelection(ids) {
  for (const id of ids) {
    const n = getState().nodes.find((x) => x.id === id)
    if (!n) continue
    addNode({ ...n, id: nid(n.type), x: n.x + 30, y: n.y + 30 })
  }
  scheduleSave()
}

// ── Inline frame rename ──
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

// ── Code editor modal ──
function openCodeEditor(id) {
  const node = getState().nodes.find((n) => n.id === id)
  if (!node || node.type !== 'code') return
  const langs = ['javascript', 'typescript', 'jsx', 'tsx', 'python', 'bash', 'json', 'yaml', 'sql', 'css', 'markdown']
  const modal = document.createElement('div')
  modal.className = 'wb-code-editor-modal'
  modal.innerHTML = `
    <div class="wb-code-editor-card">
      <header>
        <h3>Edit code snippet</h3>
        <select id="ce-lang">${langs.map((l) => `<option ${l === node.language ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </header>
      <textarea id="ce-body" spellcheck="false"></textarea>
      <div class="actions">
        <button class="cancel" id="ce-cancel">Cancel</button>
        <button class="save" id="ce-save">Save (⌘+Enter)</button>
      </div>
    </div>
  `
  document.body.appendChild(modal)
  const ta = modal.querySelector('#ce-body')
  ta.value = node.body || ''
  ta.focus()
  const close = () => modal.remove()
  modal.querySelector('#ce-cancel').onclick = close
  modal.querySelector('#ce-save').onclick = () => {
    patchNode(id, { body: ta.value, language: modal.querySelector('#ce-lang').value })
    scheduleSave()
    close()
  }
  ta.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { modal.querySelector('#ce-save').click() }
    else if (e.key === 'Escape') { close() }
    else if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart, en = ta.selectionEnd; ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en); ta.selectionStart = ta.selectionEnd = s + 2 }
  })
  modal.addEventListener('click', (e) => { if (e.target === modal) close() })
}

// Expose for interact.js to use
window.__wbOpenCodeEditor = openCodeEditor
window.__wbStartFrameRename = startInlineFrameRename
window.__wbOpenEntityPanel = openEntityPanel
window.__wbCurrentEmoji = '⭐'

// ── Export pipeline ──

/** Compute the world-space bbox containing all nodes (with padding). */
function nodesBbox(padding = 80) {
  const { nodes } = getState()
  if (!nodes.length) return { x: 0, y: 0, w: 1200, h: 800 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.w)
    maxY = Math.max(maxY, n.y + n.h)
  }
  return { x: minX - padding, y: minY - padding, w: (maxX - minX) + padding * 2, h: (maxY - minY) + padding * 2 }
}

/** Reset viewport to fit ALL nodes at zoom=1, capture, then restore. */
async function exportImage(kind /* 'png' | 'jpg' */) {
  if (!window.html2canvas) throw new Error('html2canvas not loaded')
  const savedViewport = { ...getState().viewport }
  const bbox = nodesBbox(80)
  // Translate canvas so bbox.x,bbox.y maps to (0,0); zoom 1
  update({ viewport: { x: -bbox.x, y: -bbox.y, zoom: 1 } })
  // Wait for re-render
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const canvasEl = document.getElementById('wb-canvas')
  // html2canvas of #wb-canvas with explicit width/height
  const opts = {
    backgroundColor: kind === 'jpg' ? '#ffffff' : null,
    scale: 2,                          // retina-quality
    width: bbox.w,
    height: bbox.h,
    x: 0, y: 0,
    useCORS: true,
    logging: false,
  }
  let canvas
  try {
    canvas = await window.html2canvas(canvasEl, opts)
  } finally {
    update({ viewport: savedViewport })
  }
  const mime = kind === 'jpg' ? 'image/jpeg' : 'image/png'
  const dataUrl = canvas.toDataURL(mime, kind === 'jpg' ? 0.92 : undefined)
  const a = document.createElement('a')
  a.href = dataUrl
  const safeName = (getState().name || 'whiteboard').replace(/[^\w-]+/g, '-')
  a.download = `${safeName}-${Date.now()}.${kind}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** Open a print preview window with the board image — user "Save as PDF" from the browser dialog. */
async function exportPrintPdf() {
  if (!window.html2canvas) throw new Error('html2canvas not loaded')
  const savedViewport = { ...getState().viewport }
  const bbox = nodesBbox(80)
  update({ viewport: { x: -bbox.x, y: -bbox.y, zoom: 1 } })
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  let canvas
  try {
    canvas = await window.html2canvas(document.getElementById('wb-canvas'), {
      backgroundColor: '#ffffff',
      scale: 2,
      width: bbox.w, height: bbox.h, x: 0, y: 0,
      useCORS: true, logging: false,
    })
  } finally {
    update({ viewport: savedViewport })
  }
  const dataUrl = canvas.toDataURL('image/png')
  // Open new window with image + auto-trigger print
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) throw new Error('Pop-up blocked — allow pop-ups for this site')
  const safeName = (getState().name || 'whiteboard').replace(/[^\w-]+/g, '-')
  // Landscape if wider than tall
  const orientation = bbox.w > bbox.h ? 'landscape' : 'portrait'
  w.document.write(`
    <!doctype html><html><head><title>${safeName}</title>
    <style>
      @page { size: A4 ${orientation}; margin: 8mm; }
      html,body { margin:0; padding:0; background:#fff; }
      img { width:100%; height:auto; display:block; }
      @media print { .no-print { display:none } }
      .no-print { padding: 12px; font: 14px sans-serif; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; }
      .no-print button { padding: 6px 14px; background: #6366f1; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    </style></head><body>
    <div class="no-print">Premi <strong>⌘P</strong> (o usa il bottone) e scegli <strong>"Save as PDF"</strong> nella destinazione.&nbsp;
      <button onclick="window.print()">🖨 Print / Save as PDF</button>
    </div>
    <img src="${dataUrl}" alt="">
    <script>setTimeout(() => window.print(), 600)</script>
    </body></html>
  `)
  w.document.close()
}

function exportJson() {
  const data = {
    boardName: getState().name,
    boardId: getState().id,
    exportedAt: new Date().toISOString(),
    state: { nodes: getState().nodes, connectors: getState().connectors, viewport: getState().viewport },
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeName = (getState().name || 'whiteboard').replace(/[^\w-]+/g, '-')
  a.download = `${safeName}-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Activity panel ──
async function loadActivity() {
  const list = $('#wb-activity-list')
  list.innerHTML = '<div class="wb-hint">Loading…</div>'
  try {
    const { activity } = await wb.activity(boardId)
    if (!activity.length) { list.innerHTML = '<div class="wb-hint">No activity yet.</div>'; return }
    const ICONS = { edited: '✏️', commented: '💬', restored: '↶', shared: '↗', snapshot: '📸', trashed: '🗑', 'restored-snapshot': '⟲', created: '✨' }
    list.innerHTML = activity.map((a) => `
      <div class="wb-activity-item">
        <span class="icon">${ICONS[a.action] || '•'}</span>
        <div class="body">
          <span class="who">${escHtml((a.userEmail || '').split('@')[0])}</span>
          <span class="what">${escHtml(a.action)}</span>
          ${a.detail ? `<span class="what">· ${escHtml(a.detail.slice(0, 40))}</span>` : ''}
          <div class="when">${formatRelative(a.createdAt)}</div>
        </div>
      </div>
    `).join('')
  } catch (err) {
    list.innerHTML = `<div class="wb-hint" style="color:#b91c1c">${escHtml(err.message)}</div>`
  }
}

// ── Notifications ──
async function refreshNotifBadge() {
  try {
    const { unread } = await wb.notif.list(true)
    const badge = $('#wb-notif-badge')
    if (unread > 0) { badge.style.display = 'inline-block'; badge.textContent = String(unread) }
    else badge.style.display = 'none'
  } catch {}
}

async function loadNotifications() {
  const list = $('#wb-notif-list')
  list.innerHTML = '<div class="wb-hint">Loading…</div>'
  try {
    const { notifications } = await wb.notif.list(false)
    if (!notifications.length) { list.innerHTML = '<div class="wb-hint">No notifications.</div>'; return }
    list.innerHTML = notifications.map((n) => `
      <div class="wb-notif-item ${n.readAt ? '' : 'unread'}" data-id="${escAttr(n.id)}" data-board="${escAttr(n.boardId || '')}" data-node="${escAttr(n.nodeId || '')}">
        <span class="type-pill">${escHtml(n.type)}</span>
        <div>${escHtml(n.body || '')}</div>
        <span class="when">${formatRelative(n.createdAt)}</span>
      </div>
    `).join('')
    list.querySelectorAll('.wb-notif-item').forEach((el) => {
      el.addEventListener('click', async () => {
        try { await wb.notif.markRead(el.dataset.id) } catch {}
        if (el.dataset.board && el.dataset.board !== boardId) {
          location.href = '/whiteboard.html?id=' + encodeURIComponent(el.dataset.board) + (el.dataset.node ? '&node=' + encodeURIComponent(el.dataset.node) : '')
        } else if (el.dataset.node) {
          jumpToNode(el.dataset.node)
          $('#wb-notif-panel').style.display = 'none'
        }
        refreshNotifBadge()
        el.classList.remove('unread')
      })
    })
  } catch (err) {
    list.innerHTML = `<div class="wb-hint" style="color:#b91c1c">${escHtml(err.message)}</div>`
  }
}

// ── Presence (heartbeat-based active editors) ──
let _lastPresenceList = ''
async function refreshPresence() {
  try {
    const { editors } = await wb.presence.list(boardId)
    const me = getState().myEmail
    const others = editors.filter((e) => e.userEmail !== me)
    const sig = JSON.stringify(others.map((e) => e.userEmail))
    if (sig === _lastPresenceList) return
    _lastPresenceList = sig
    const el = $('#wb-presence')
    if (!others.length) { el.style.display = 'none'; return }
    el.style.display = 'flex'
    el.innerHTML = others.slice(0, 4).map((e) => {
      const initials = (e.userEmail || '?').split('@')[0].slice(0, 2).toUpperCase()
      const color = colorFromEmail(e.userEmail)
      return `<span class="wb-presence-avatar" title="${escAttr(e.userEmail)} · last seen ${formatRelative(e.lastSeen)}" style="background:${color}">${initials}</span>`
    }).join('') + (others.length > 4 ? `<span class="wb-presence-avatar" style="background:#475569">+${others.length - 4}</span>` : '')
  } catch {}
}

function colorFromEmail(email) {
  let h = 0
  for (let i = 0; i < (email || '').length; i++) h = (h * 31 + email.charCodeAt(i)) | 0
  const palette = ['#6366f1','#8b5cf6','#ec4899','#f97316','#10b981','#06b6d4','#0ea5e9','#84cc16']
  return palette[Math.abs(h) % palette.length]
}

function formatRelative(iso) {
  const d = new Date(iso)
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 30) return 'now'
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)}d ago`
  return iso.split('T')[0]
}

// ── Onboarding tour ──
const ONBOARDING_STEPS = [
  { selector: '#wb-canvas-container', title: 'Welcome!', body: '<strong>Double-click anywhere</strong> on the empty canvas to add a sticky note. Drag stickies, frames, and shapes from the bottom toolbar.', position: 'center' },
  { selector: '#wb-tooldock', title: 'Tools dock', body: 'Switch tool with the icons here, or by pressing single-letter shortcuts: <kbd>S</kbd> sticky · <kbd>F</kbd> frame · <kbd>A</kbd> connector · <kbd>P</kbd> pen · <kbd>R</kbd>/<kbd>E</kbd>/<kbd>T</kbd> shapes · <kbd>M</kbd> emoji.', position: 'top' },
  { selector: '#btn-link', title: '+ Link', body: 'Drop Synapse memories, skills, sessions or projects directly onto the canvas as live cards.', position: 'bottom' },
  { selector: '#btn-generate', title: 'Generate', body: 'Auto-build the board from your data: by-type, by-project, semantic clusters, decisions log, etc. — all with filters and live preview.', position: 'bottom' },
  { selector: '#btn-templates', title: 'Templates', body: 'Insert ready-made layouts: Retro, Brainstorm, Kanban, OKR, Mind Map.', position: 'bottom' },
  { selector: '#btn-help', title: 'Help & shortcuts', body: 'Press <kbd>?</kbd> at any time for the full keyboard cheatsheet. <strong>Drag</strong> on empty area = marquee select · <strong>Space + drag</strong> = pan.', position: 'bottom' },
]
let _onbStep = 0

function showOnboardingTour() {
  // Build overlay
  if (document.getElementById('wb-onb-overlay')) return
  const overlay = document.createElement('div')
  overlay.id = 'wb-onb-overlay'
  overlay.className = 'wb-onb-overlay'
  overlay.innerHTML = `
    <div class="wb-onb-spotlight"></div>
    <div class="wb-onb-card">
      <h3 id="wb-onb-title"></h3>
      <div id="wb-onb-body"></div>
      <div class="wb-onb-actions">
        <span id="wb-onb-step" class="wb-meta"></span>
        <div style="margin-left:auto;display:flex;gap:6px">
          <button id="wb-onb-skip" class="wb-btn">Skip tour</button>
          <button id="wb-onb-prev" class="wb-btn">Back</button>
          <button id="wb-onb-next" class="wb-btn wb-btn-primary">Next</button>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  $('#wb-onb-skip').onclick = endOnboardingTour
  $('#wb-onb-prev').onclick = () => { _onbStep = Math.max(0, _onbStep - 1); renderOnbStep() }
  $('#wb-onb-next').onclick = () => {
    if (_onbStep >= ONBOARDING_STEPS.length - 1) endOnboardingTour()
    else { _onbStep++; renderOnbStep() }
  }
  _onbStep = 0
  renderOnbStep()
}

function renderOnbStep() {
  const step = ONBOARDING_STEPS[_onbStep]
  $('#wb-onb-title').innerHTML = step.title
  $('#wb-onb-body').innerHTML = step.body
  $('#wb-onb-step').textContent = `${_onbStep + 1} / ${ONBOARDING_STEPS.length}`
  $('#wb-onb-prev').style.visibility = _onbStep === 0 ? 'hidden' : 'visible'
  $('#wb-onb-next').textContent = _onbStep === ONBOARDING_STEPS.length - 1 ? 'Got it!' : 'Next'
  // Position spotlight + card relative to target
  const target = step.selector ? document.querySelector(step.selector) : null
  const spot = $('.wb-onb-spotlight')
  const card = $('.wb-onb-card')
  if (target) {
    const r = target.getBoundingClientRect()
    spot.style.left = (r.left - 8) + 'px'
    spot.style.top = (r.top - 8) + 'px'
    spot.style.width = (r.width + 16) + 'px'
    spot.style.height = (r.height + 16) + 'px'
    spot.style.display = step.position === 'center' ? 'none' : 'block'
    if (step.position === 'top') {
      card.style.left = Math.min(window.innerWidth - 400, Math.max(20, r.left + r.width / 2 - 200)) + 'px'
      card.style.top = (r.top - card.offsetHeight - 16) + 'px'
    } else if (step.position === 'bottom') {
      card.style.left = Math.min(window.innerWidth - 400, Math.max(20, r.left + r.width / 2 - 200)) + 'px'
      card.style.top = (r.bottom + 16) + 'px'
    } else {
      card.style.left = (window.innerWidth / 2 - 200) + 'px'
      card.style.top = (window.innerHeight / 2 - 100) + 'px'
    }
  } else {
    spot.style.display = 'none'
    card.style.left = (window.innerWidth / 2 - 200) + 'px'
    card.style.top = (window.innerHeight / 2 - 100) + 'px'
  }
}

function endOnboardingTour() {
  document.getElementById('wb-onb-overlay')?.remove()
  localStorage.setItem('wb-onboarding-done', '1')
}

// Manually re-trigger tour (e.g. from help modal in future)
window.__wbStartOnboarding = () => { localStorage.removeItem('wb-onboarding-done'); showOnboardingTour() }

function bindEmojiPalette() {
  const palette = $('#wb-emoji-palette')
  if (!palette) return
  // Show palette when emoji tool activates
  subscribe((s) => {
    if (s.tool === 'emoji') showEmojiPalette()
    else palette.style.display = 'none'
  })
  // Click on an emoji button → set as current, close (or keep open with shift)
  palette.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-emoji]')
    if (!btn) return
    palette.querySelectorAll('button.selected').forEach((b) => b.classList.remove('selected'))
    btn.classList.add('selected')
    window.__wbCurrentEmoji = btn.dataset.emoji
    toast(`Emoji ${btn.dataset.emoji} ready — click on the canvas to place`, 'success')
  })
  // Custom emoji input
  $('#wb-emoji-custom-input').addEventListener('input', (e) => {
    if (e.target.value) window.__wbCurrentEmoji = e.target.value
  })
  // Click outside palette closes it (and switches back to select)
  document.addEventListener('click', (e) => {
    if (palette.style.display === 'none') return
    if (palette.contains(e.target)) return
    if (e.target.closest('[data-tool="emoji"]')) return
    if (e.target.closest('#wb-canvas-container')) return  // canvas clicks should still place
    palette.style.display = 'none'
  })
}

function showEmojiPalette() {
  const palette = $('#wb-emoji-palette')
  if (!palette) return
  // Position: above the dock, centered (under emoji tool)
  const tool = document.querySelector('[data-tool="emoji"]')
  const tr = tool.getBoundingClientRect()
  palette.style.left = Math.max(12, Math.min(window.innerWidth - 300, tr.left + tr.width / 2 - 140)) + 'px'
  palette.style.top  = (tr.top - palette.offsetHeight - 12) + 'px'
  palette.style.display = 'block'
  // Position again after layout (since offsetHeight is 0 if just shown)
  requestAnimationFrame(() => {
    palette.style.top = (tr.top - palette.offsetHeight - 12) + 'px'
  })
}

// ── Entity detail panel (memory / skill / session / project) ──

async function openEntityPanel(node) {
  const panel = $('#wb-entity-panel')
  const body = $('#wb-entity-body')
  $('#wb-entity-title').textContent = `${labelForKind(node.cardKind)} · ${node.snapshot?.title || node.refId}`
  body.innerHTML = '<div class="wb-hint">Loading…</div>'
  // Close other panels for clarity
  document.querySelectorAll('.wb-panel').forEach((p) => { if (p.id !== 'wb-entity-panel') p.style.display = 'none' })
  panel.style.display = 'flex'
  try {
    if (node.cardKind === 'memory') return renderMemoryDetail(body, node.refId)
    if (node.cardKind === 'skill')   return renderSkillDetail(body, node.refId)
    if (node.cardKind === 'session') return renderSessionDetail(body, node.refId)
    if (node.cardKind === 'project') return renderProjectDetail(body, node.refId)
    body.innerHTML = '<div class="wb-hint">Unknown card kind.</div>'
  } catch (err) {
    body.innerHTML = `<div class="wb-hint" style="color:#b91c1c">Error: ${escHtml(err.message)}</div>`
  }
}

function labelForKind(k) {
  return ({ memory: '💡 Memory', skill: '🛠 Skill', session: '⏱ Session', project: '📁 Project' })[k] || k
}

async function renderMemoryDetail(body, id) {
  const r = await fetch('/api/memories/' + encodeURIComponent(id), { credentials: 'include' })
  if (!r.ok) { body.innerHTML = `<div class="wb-hint" style="color:#b91c1c">Memory not found</div>`; return }
  const m = await r.json()
  body.innerHTML = `
    <div class="wb-entity-meta">
      <span class="wb-pill type-${escAttr(m.type?.toLowerCase() || 'fact')}">${escHtml(m.type)}</span>
      <span class="wb-pill">conf: ${m.confidence}</span>
      <span class="wb-pill">imp: ${m.importance}</span>
      <span class="wb-pill">${escHtml(m.status)}</span>
      ${m.project ? `<span class="wb-pill">📁 ${escHtml(m.project)}</span>` : ''}
      ${m.skill ? `<span class="wb-pill">🛠 ${escHtml(m.skill)}</span>` : ''}
    </div>
    <form id="wb-mem-edit" class="wb-entity-form">
      <label>Context</label>
      <textarea name="context" rows="3">${escHtml(m.context || '')}</textarea>
      <label>Problem</label>
      <textarea name="problem" rows="2">${escHtml(m.problem || '')}</textarea>
      <label>Solution</label>
      <textarea name="solution" rows="3">${escHtml(m.solution || '')}</textarea>
      <label>Reason</label>
      <textarea name="reason" rows="2">${escHtml(m.reason || '')}</textarea>
      <label>Tags (comma-separated)</label>
      <input type="text" name="tags" value="${escAttr((m.tags || []).join(', '))}">
      <div class="wb-entity-actions">
        <button type="button" class="wb-btn" data-act="deprecate">Deprecate</button>
        <button type="button" class="wb-btn" data-act="delete" style="color:#dc2626">Delete</button>
        <button type="submit" class="wb-btn wb-btn-primary">Save</button>
      </div>
    </form>
    ${m.edges?.length ? `<div class="wb-entity-edges"><h4>Edges (${m.edges.length})</h4>${m.edges.slice(0,8).map(e => `<div class="edge"><span class="wb-pill">${escHtml(e.type)}</span> → ${escHtml(e.targetId.slice(0,12))}</div>`).join('')}</div>` : ''}
  `
  body.querySelector('#wb-mem-edit').addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const form = ev.target
    const data = {
      context: form.context.value, problem: form.problem.value,
      solution: form.solution.value, reason: form.reason.value,
      tags: form.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
    }
    try {
      const r = await fetch('/api/memories/' + encodeURIComponent(id), {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!r.ok) throw new Error((await r.text()) || r.statusText)
      toast('Memory updated', 'success')
      // Refresh the snapshot of all sb-cards on the board pointing to this memory
      refreshSbCardSnapshot('memory', id, { title: data.context.slice(0, 60), subtitle: data.tags.join(', ') })
    } catch (err) { toast('Update failed: ' + err.message, 'error') }
  })
  body.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', async () => {
    const act = btn.dataset.act
    if (act === 'delete' && !confirm('Delete this memory permanently?')) return
    try {
      if (act === 'delete') {
        await fetch('/api/memories/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'include' })
        toast('Memory deleted', 'success')
        $('#wb-entity-panel').style.display = 'none'
      } else if (act === 'deprecate') {
        await fetch('/api/memories/' + encodeURIComponent(id), {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'deprecated' }),
        })
        toast('Marked deprecated', 'success')
        renderMemoryDetail(body, id)
      }
    } catch (err) { toast('Failed: ' + err.message, 'error') }
  }))
}

async function renderSkillDetail(body, name) {
  // Reuse the dashboard skills detail endpoint if exists; else show summary from /api/skills
  body.innerHTML = `<div class="wb-entity-meta"><span class="wb-pill">🛠 skill</span><span class="wb-pill">${escHtml(name)}</span></div>
    <p class="wb-hint">Detail view coming soon. <a href="/#/skills?name=${encodeURIComponent(name)}" target="_blank">Open in dashboard ↗</a></p>`
}
async function renderSessionDetail(body, id) {
  body.innerHTML = `<div class="wb-entity-meta"><span class="wb-pill">⏱ session</span><span class="wb-pill">${escHtml(id)}</span></div>
    <p class="wb-hint">Detail view coming soon. <a href="/#/sessions?id=${encodeURIComponent(id)}" target="_blank">Open in dashboard ↗</a></p>`
}
async function renderProjectDetail(body, name) {
  body.innerHTML = `<div class="wb-entity-meta"><span class="wb-pill">📁 project</span><span class="wb-pill">${escHtml(name)}</span></div>
    <p class="wb-hint">Detail view coming soon. <a href="/#/projects?name=${encodeURIComponent(name)}" target="_blank">Open in dashboard ↗</a></p>`
}

/** Update the snapshot of all sb-card nodes referencing a given entity, so the canvas stays in sync. */
function refreshSbCardSnapshot(cardKind, refId, snapshot) {
  const nodes = getState().nodes.map((n) => {
    if (n.type !== 'sb-card' || n.cardKind !== cardKind || n.refId !== refId) return n
    return { ...n, snapshot: { ...n.snapshot, ...snapshot } }
  })
  update({ nodes })
  scheduleSave()
}

// ── Save ──

let saveTimer = null
let savingNow = false
const SAVE_DEBOUNCE_MS = 1500

function scheduleSave() {
  setSaveState('saving')
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(doSave, SAVE_DEBOUNCE_MS)
}

async function doSave() {
  if (isReadOnly) { setSaveState('idle'); return }
  if (savingNow) { scheduleSave(); return }
  savingNow = true
  const stateJson = serialize()
  const expectedVersion = getState().stateVersion
  try {
    const { board } = await wb.save(boardId, { stateJson, expectedVersion })
    update({ stateVersion: board.stateVersion })
    setSaveState('saved')
  } catch (err) {
    if (err.status === 409) {
      $('#wb-conflict-modal').style.display = 'flex'
      $('#wb-conflict-reload').onclick = () => location.reload()
    } else {
      setSaveState('error')
      toast(`Save failed: ${err.message}`, 'error')
      // Retry once after 5s
      setTimeout(() => scheduleSave(), 5000)
    }
  } finally {
    savingNow = false
  }
}

function setSaveState(s) {
  const el = $('#wb-savestate')
  el.className = 'wb-savestate ' + s
  el.textContent = s === 'saving' ? 'Saving…' : s === 'saved' ? 'Saved' : s === 'error' ? 'Error' : 'Idle'
}

// Save on tab close
window.addEventListener('beforeunload', () => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    // Synchronous save attempt via sendBeacon (best effort)
    const data = JSON.stringify({ stateJson: serialize(), expectedVersion: getState().stateVersion })
    try { navigator.sendBeacon('/api/whiteboards/' + boardId, new Blob([data], { type: 'application/json' })) } catch {}
  }
})

// ── UI bindings ──

function bindUI() {
  // Name editing
  $('#wb-name').addEventListener('change', async (e) => {
    try { await wb.patch(boardId, { name: e.target.value }); update({ name: e.target.value }); document.title = 'Synapse · ' + e.target.value }
    catch (err) { toast('Rename failed: ' + err.message, 'error') }
  })

  // Tools
  document.querySelectorAll('.wb-tool').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool
      if (tool === 'vote') {
        const voting = !getState().voting
        update({ voting, votesUsed: 0, tool: voting ? 'vote' : 'select' })
        $('#wb-vote-counter').style.display = voting ? 'block' : 'none'
        $('#wb-votes-left').textContent = String(getState().votePool)
      } else {
        update({ tool, voting: false })
        $('#wb-vote-counter').style.display = 'none'
      }
      reflectActiveTool()
    })
  })
  reflectActiveTool()

  // Panel buttons
  $('#btn-link').addEventListener('click', () => togglePanel('wb-link-panel', loadLinkable))
  $('#btn-templates').addEventListener('click', () => togglePanel('wb-templates-panel', loadTemplates))
  $('#btn-generate').addEventListener('click', () => togglePanel('wb-generate-panel'))
  $('#btn-comments').addEventListener('click', openCommentsForSelection)
  $('#btn-export-mem').addEventListener('click', exportSelectionToMemory)
  $('#btn-timer').addEventListener('click', () => $('#wb-timer').style.display = 'flex')
  $('#btn-search').addEventListener('click', () => {
    $('#wb-search-overlay').style.display = 'flex'
    $('#wb-search-input').focus()
  })
  $('#btn-fit').addEventListener('click', fitToView)

  // ── Activity log panel ──
  $('#btn-activity').addEventListener('click', () => togglePanel('wb-activity-panel', loadActivity))

  // ── Notifications ──
  $('#btn-notifications').addEventListener('click', () => togglePanel('wb-notif-panel', loadNotifications))
  $('#wb-notif-mark-all').addEventListener('click', async () => {
    try { await wb.notif.markAllRead(); refreshNotifBadge(); loadNotifications() } catch {}
  })
  // Initial badge + periodic refresh
  refreshNotifBadge()
  setInterval(refreshNotifBadge, 60_000)

  // ── Presence: send heartbeat every 30s, refresh active editors avatars ──
  if (!isReadOnly) {
    setInterval(async () => {
      try { await wb.presence.heartbeat(boardId) } catch {}
    }, 30_000)
    wb.presence.heartbeat(boardId).catch(() => {})
    setInterval(refreshPresence, 30_000)
    setTimeout(refreshPresence, 1000)
  }
  // Mark board as opened (server bumps last_opened_at)
  fetch('/api/whiteboards/' + encodeURIComponent(boardId) + '/opened', { method: 'POST', credentials: 'include' }).catch(() => {})

  // ── Onboarding tour (first visit only, persisted in localStorage) ──
  if (!isReadOnly && !localStorage.getItem('wb-onboarding-done')) {
    setTimeout(showOnboardingTour, 800)
  }

  // ── Help modal (?) ──
  $('#btn-help').addEventListener('click', () => $('#wb-help-modal').style.display = 'flex')
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !isInField(e.target)) {
      $('#wb-help-modal').style.display = 'flex'
      e.preventDefault()
    }
  })

  // ── Fullscreen toggle ──
  $('#btn-fullscreen').addEventListener('click', toggleFullscreen)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F11' || (e.key === 'f' && (e.metaKey || e.ctrlKey) && e.shiftKey)) {
      e.preventDefault()
      toggleFullscreen()
    }
  })
  function toggleFullscreen() {
    document.body.classList.toggle('wb-fullscreen')
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.().catch(() => {})
  }

  // ── Export ──
  $('#btn-export').addEventListener('click', () => {
    $('#wb-export-status').textContent = ''
    $('#wb-export-modal').style.display = 'flex'
  })
  $('#wb-export-modal').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-export]')
    if (!btn) return
    const kind = btn.dataset.export
    const status = $('#wb-export-status')
    btn.disabled = true
    status.textContent = '⏳ Capturing board…'
    try {
      if (kind === 'json') exportJson()
      else if (kind === 'pdf') await exportPrintPdf()
      else await exportImage(kind)
      status.textContent = '✓ Done'
      setTimeout(() => { $('#wb-export-modal').style.display = 'none' }, 800)
    } catch (err) {
      status.textContent = '✗ ' + err.message
    } finally {
      btn.disabled = false
    }
  })

  // ── Share link (Batch 4 will add proper read-only token; for now just copy current URL) ──
  $('#btn-share').addEventListener('click', async () => {
    try {
      const { url } = await wb.share(boardId)
      const fullUrl = location.origin + url
      try { await navigator.clipboard.writeText(fullUrl) } catch {}
      prompt('Read-only share link (already copied to clipboard):', fullUrl)
    } catch (err) {
      // Fallback before Batch 4 is wired: copy plain URL
      const fullUrl = location.href
      try { await navigator.clipboard.writeText(fullUrl) } catch {}
      prompt('Share link (copied to clipboard) — read-only mode coming soon:', fullUrl)
    }
  })

  function isInField(t) {
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  }

  // ── Emoji palette ──
  bindEmojiPalette()

  // ── Sidebar collapse toggle ──
  const sidebarToggle = $('#btn-sidebar-toggle')
  if (sidebarToggle) {
    // Restore saved state
    if (localStorage.getItem('wb-sidebar-collapsed') === '1') {
      document.body.classList.add('wb-sidebar-collapsed')
    }
    sidebarToggle.addEventListener('click', () => {
      const collapsed = document.body.classList.toggle('wb-sidebar-collapsed')
      localStorage.setItem('wb-sidebar-collapsed', collapsed ? '1' : '0')
    })
  }

  // Close buttons
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.close).style.display = 'none'
      if (btn.dataset.close === 'wb-search-overlay') {
        update({ matches: [] })
        scheduleRender()
      }
    })
  })

  // Linkable tabs
  document.querySelectorAll('.wb-tab[data-link-type]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.wb-tab[data-link-type]').forEach((t) => t.classList.remove('active'))
      tab.classList.add('active')
      loadLinkable(tab.dataset.linkType)
    })
  })
  $('#wb-link-search').addEventListener('input', debounce(() => {
    const activeTab = document.querySelector('.wb-tab[data-link-type].active')
    loadLinkable(activeTab.dataset.linkType, $('#wb-link-search').value)
  }, 250))

  // Generate buttons
  document.querySelectorAll('[data-gen]').forEach((btn) => {
    btn.addEventListener('click', () => runGenerator(btn.dataset.gen))
  })

  // Preview modal Apply button
  $('#wb-preview-apply').addEventListener('click', applyPreviewToBoard)

  // Populate project filter dropdown from API
  loadGenerateProjects()
  // React to project change → enable/disable project-required buttons
  $('#wb-gen-project').addEventListener('change', refreshGenerateButtons)
  refreshGenerateButtons()

  // Comments
  $('#wb-comment-send').addEventListener('click', sendComment)

  // Search + Find & Replace
  $('#wb-search-input').addEventListener('input', debounce(runSearch, 200))
  $('#wb-search-next').addEventListener('click', () => navigateMatch(1))
  $('#wb-search-prev').addEventListener('click', () => navigateMatch(-1))
  $('#wb-toggle-replace').addEventListener('click', () => {
    const showing = $('#wb-replace-input').style.display !== 'none'
    $('#wb-replace-input').style.display = showing ? 'none' : 'inline-block'
    $('#wb-replace-one').style.display = showing ? 'none' : 'inline-block'
    $('#wb-replace-all').style.display = showing ? 'none' : 'inline-block'
    if (!showing) $('#wb-replace-input').focus()
  })
  $('#wb-replace-one').addEventListener('click', () => doReplace(false))
  $('#wb-replace-all').addEventListener('click', () => doReplace(true))

  // Timer
  bindTimer()

  // Subscribe to selection changes for comments badge / button enabling
  subscribe((s) => {
    const hasOne = s.selection.size === 1
    $('#btn-comments').disabled = !hasOne
    $('#btn-export-mem').disabled = !s.selection.size
  })
}

function reflectActiveTool() {
  const tool = getState().tool
  document.querySelectorAll('.wb-tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool))
  document.getElementById('wb-canvas-container').className =
    'tool-' + (tool === 'vote' ? 'vote' : tool)
}

function togglePanel(id, onOpen) {
  const el = document.getElementById(id)
  const open = el.style.display === 'none' || !el.style.display
  // Close all panels first
  document.querySelectorAll('.wb-panel').forEach((p) => p.style.display = 'none')
  if (open) {
    el.style.display = 'flex'
    if (onOpen) onOpen()
  }
}

// ── Linkable sidebar ──

let lastLinkType = 'memory'
async function loadLinkable(type = lastLinkType, q = '') {
  lastLinkType = type
  const list = $('#wb-link-results')
  list.innerHTML = '<div class="wb-hint">Loading…</div>'
  try {
    const { items } = await wb.linkable({ type, q })
    list.innerHTML = items.map((it) => `
      <div class="wb-link-item" draggable="true" data-id="${escAttr(it.id)}" data-type="${type}" data-title="${escAttr(it.title)}" data-subtitle="${escAttr(it.subtitle || '')}" data-badge="${escAttr(it.badge || '')}">
        <div class="t">${escHtml(it.title)}</div>
        ${it.subtitle ? `<div class="s">${escHtml(it.subtitle)}</div>` : ''}
        ${it.badge ? `<span class="b">${escHtml(it.badge)}</span>` : ''}
      </div>
    `).join('') || '<div class="wb-hint">No results.</div>'
    // Drag start
    list.querySelectorAll('.wb-link-item').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/wb-card', JSON.stringify({
          id: el.dataset.id, type: el.dataset.type,
          title: el.dataset.title, subtitle: el.dataset.subtitle, badge: el.dataset.badge,
        }))
      })
    })
  } catch (err) {
    list.innerHTML = `<div class="wb-hint" style="color:#b91c1c">Error: ${escHtml(err.message)}</div>`
  }
}

// Drop zone on canvas (cards + images)
const $dropZone = document.getElementById('wb-canvas-container')
$dropZone.addEventListener('dragover', (e) => {
  const types = e.dataTransfer.types
  const isCard = types.includes('text/wb-card')
  const hasFiles = types.includes('Files')
  if (isCard || hasFiles) {
    e.preventDefault()
    if (hasFiles) $dropZone.classList.add('image-drop-target')
  }
})
$dropZone.addEventListener('dragleave', (e) => {
  if (e.target === $dropZone) $dropZone.classList.remove('image-drop-target')
})
$dropZone.addEventListener('drop', async (e) => {
  $dropZone.classList.remove('image-drop-target')
  // Image files take precedence
  const files = [...(e.dataTransfer.files || [])].filter((f) => f.type.startsWith('image/'))
  if (files.length) {
    e.preventDefault()
    const pt = clientToCanvas(e.clientX, e.clientY)
    let offset = 0
    for (const file of files) {
      await insertImageFile(file, pt.x + offset, pt.y + offset)
      offset += 30
    }
    return
  }
  const data = e.dataTransfer.getData('text/wb-card')
  if (!data) return
  e.preventDefault()
  try {
    const card = JSON.parse(data)
    const pt = clientToCanvas(e.clientX, e.clientY)
    addNode({
      id: nid('sb'), type: 'sb-card',
      cardKind: card.type, refId: card.id,
      x: pt.x - 100, y: pt.y - 30, w: 200, h: 70,
      snapshot: { title: card.title, subtitle: card.subtitle, badge: card.badge },
      color: '#e0e7ff',
      author: getState().myEmail,
    })
    scheduleSave()
  } catch (err) { console.error(err) }
})

// Image insert helper — base64 inline, capped at 1MB to keep state JSON small
const IMAGE_MAX_BYTES = 1024 * 1024
async function insertImageFile(file, dropX, dropY) {
  if (file.size > IMAGE_MAX_BYTES) {
    toast(`Image too large: ${(file.size / 1024).toFixed(0)}KB (max ${IMAGE_MAX_BYTES / 1024}KB). Compress and retry.`, 'error')
    return
  }
  const dataUrl = await new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => res(reader.result)
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
  // Determine natural size
  const dims = await new Promise((res) => {
    const img = new Image()
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => res({ w: 240, h: 180 })
    img.src = dataUrl
  })
  // Fit into max 320 wide while preserving aspect ratio
  const MAX_W = 320
  const ratio = dims.w / dims.h
  let w = Math.min(MAX_W, dims.w), h = w / ratio
  addNode({
    id: nid('img'), type: 'image',
    src: dataUrl,
    x: (dropX || 0) - w / 2, y: (dropY || 0) - h / 2,
    w, h,
    author: getState().myEmail,
  })
  commitHistory()
  scheduleSave()
}

// File picker button
$('#btn-image').addEventListener('click', () => $('#wb-image-input').click())
$('#wb-image-input').addEventListener('change', async (e) => {
  const files = [...(e.target.files || [])]
  // Insert at viewport center
  const rect = document.getElementById('wb-canvas-container').getBoundingClientRect()
  const center = clientToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2)
  let offset = 0
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      await insertImageFile(file, center.x + offset, center.y + offset)
      offset += 30
    }
  }
  e.target.value = ''
})

// ── Templates ──

async function loadGenerateProjects() {
  const sel = $('#wb-gen-project')
  if (!sel) return
  try {
    const { items } = await wb.linkable({ type: 'project', limit: 50 })
    sel.innerHTML = '<option value="">— All projects —</option>' +
      items.map((p) => `<option value="${escAttr(p.id)}">${escHtml(p.title)}</option>`).join('')
    // Auto-select current board's projectName if any
    const cur = getState().projectName
    if (cur) sel.value = cur
    refreshGenerateButtons()
  } catch (err) {
    console.warn('Failed to load projects for generate panel:', err.message)
  }
}

function refreshGenerateButtons() {
  const proj = $('#wb-gen-project')?.value
  document.querySelectorAll('[data-needs-project]').forEach((b) => {
    if (proj) {
      b.removeAttribute('disabled')
      b.title = b.title.replace(/\s*Richiede.*$/i, '')
    } else {
      b.setAttribute('disabled', 'true')
    }
  })
}

async function loadTemplates() {
  const list = $('#wb-templates-list')
  list.innerHTML = '<div class="wb-hint">Loading…</div>'
  try {
    const { templates } = await wb.templates.list()
    list.innerHTML = templates.map((t) => `
      <div class="wb-template-card">
        <div class="t">${escHtml(t.name)}</div>
        <div class="d">${escHtml(t.description)}</div>
        <div class="actions">
          <button class="wb-btn wb-btn-primary" data-tpl-here="${escAttr(t.id)}">Insert here</button>
          ${t.applyAs.includes('board') ? `<button class="wb-link-action" data-tpl-new="${escAttr(t.id)}" title="Create a new board with this template">↗ Open in new board</button>` : ''}
        </div>
      </div>
    `).join('')
    list.querySelectorAll('[data-tpl-here]').forEach((b) => b.addEventListener('click', () => insertTemplateAsFrame(b.dataset.tplHere)))
    list.querySelectorAll('[data-tpl-new]').forEach((b) => b.addEventListener('click', () => createBoardFromTemplate(b.dataset.tplNew)))
  } catch (err) {
    list.innerHTML = `<div class="wb-hint" style="color:#b91c1c">Error: ${escHtml(err.message)}</div>`
  }
}

async function insertTemplateAsFrame(id) {
  try {
    const { template } = await wb.templates.get(id)
    // Compute offset = current viewport center
    const rect = document.getElementById('wb-canvas-container').getBoundingClientRect()
    const center = clientToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2)
    const offsetX = Math.round(center.x - 200)
    const offsetY = Math.round(center.y - 200)
    // Re-id + offset every node and connector
    const idMap = {}
    for (const n of [...template.frames, ...template.nodes]) {
      const newId = nid('tpl')
      idMap[n.id] = newId
      addNode({ ...n, id: newId, x: n.x + offsetX, y: n.y + offsetY })
    }
    for (const c of (template.connectors || [])) {
      addConnector({ ...c, id: nid('conn'), from: idMap[c.from] || c.from, to: idMap[c.to] || c.to })
    }
    togglePanel('wb-templates-panel')
    scheduleSave()
    toast(`Inserted "${template.name}" as frame`, 'success')
  } catch (err) { toast('Failed: ' + err.message, 'error') }
}

async function createBoardFromTemplate(id) {
  const name = prompt('New board name:', 'Untitled')
  if (!name) return
  const scope = getState().scope
  const projectName = getState().projectName
  try {
    const { board } = await wb.create({ name, scope, projectName, templateId: id })
    location.href = '/whiteboard.html?id=' + encodeURIComponent(board.id)
  } catch (err) { toast('Create failed: ' + err.message, 'error') }
}

// ── Generators ──

// Map of recipe → { label, fn, supportsFilters: [...] }
const RECIPES = {
  'memory-cluster':     { label: 'By tag (cluster)',  fn: wb.generate.memoryCluster,   filters: ['project', 'tags', 'type', 'status', 'minConfidence', 'sinceDays'], requiresProject: true },
  'by-type':            { label: 'By type',           fn: wb.generate.byType,          filters: ['project', 'tags', 'status', 'minConfidence', 'sinceDays'] },
  'by-project':         { label: 'By project',        fn: wb.generate.byProject,       filters: ['tags', 'type', 'status', 'minConfidence', 'sinceDays'] },
  'by-skill':           { label: 'By skill',          fn: wb.generate.bySkill,         filters: ['project', 'tags', 'type', 'status', 'minConfidence', 'sinceDays'] },
  'by-author':          { label: 'By author',         fn: wb.generate.byAuthor,        filters: ['project'] },
  'recent-memories':    { label: 'Recent memories',   fn: wb.generate.recentMemories,  filters: ['project', 'tags', 'type', 'minConfidence'] },
  'most-used-memories': { label: 'Most-used memories',fn: wb.generate.mostUsedMemories,filters: ['project', 'tags', 'type', 'minConfidence'] },
  'decisions-log':      { label: 'Decisions log',     fn: wb.generate.decisionsLog,    filters: ['project', 'tags', 'minConfidence', 'sinceDays'] },
  'antipatterns':       { label: 'AntiPatterns',      fn: wb.generate.antipatterns,    filters: ['project', 'tags', 'minConfidence', 'sinceDays'] },
  'open-todos':         { label: 'Open todos',        fn: wb.generate.openTodos,       filters: ['project', 'tags'] },
  'session-timeline':   { label: 'Session timeline',  fn: wb.generate.sessionTimeline, filters: ['project'] },
  'skill-graph':        { label: 'Skill graph',       fn: wb.generate.skillGraph,      filters: [] },
  'project-overview':   { label: 'Project overview',  fn: wb.generate.projectOverview, filters: ['project'], requiresProject: true },
  'semantic-cluster':   { label: '🧠 Semantic cluster', fn: wb.generate.semanticCluster, filters: ['project', 'tags', 'type', 'status', 'minConfidence', 'sinceDays'] },
}

const TYPES = ['Pattern','Decision','BugFix','AntiPattern','Fact','Todo','Preference']
const STATUSES = ['active','pending-review','deprecated']

let _currentRecipeKind = null
let _currentPreviewState = null
let _availableTags = []
let _availableProjects = []

async function runGenerator(kind) {
  const recipe = RECIPES[kind]
  if (!recipe) { toast('Unknown recipe: ' + kind, 'error'); return }
  _currentRecipeKind = kind
  // Preload tags and projects (cached after first call)
  if (!_availableProjects.length) {
    try { _availableProjects = (await wb.linkable({ type: 'project', limit: 50 })).items } catch {}
  }
  if (!_availableTags.length) {
    // Approximate top tags from server-side memory query — call by-tag endpoint and collect tag names from snapshots
    try {
      const r = await wb.generate.byType({})
      const parsed = JSON.parse(r.stateJson)
      const tagSet = new Set()
      for (const n of parsed.nodes || []) {
        if (n.snapshot?.subtitle) n.snapshot.subtitle.split(',').forEach((t) => { const tt = t.trim(); if (tt) tagSet.add(tt) })
      }
      _availableTags = [...tagSet].slice(0, 20)
    } catch {}
  }
  openPreviewModal(kind, recipe)
}

let _previewListenersAttached = false
function attachPreviewListenersOnce() {
  if (_previewListenersAttached) return
  _previewListenersAttached = true
  const filters = $('#wb-preview-filters')
  filters.addEventListener('change', refreshPreview)
  filters.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip')
    if (!chip || !filters.contains(chip)) return
    chip.classList.toggle('selected')
    refreshPreview()
  })
  filters.addEventListener('input', debounce(refreshPreview, 300))
}

function openPreviewModal(kind, recipe) {
  $('#wb-preview-title').textContent = `Generate: ${recipe.label}`
  $('#wb-preview-filters').innerHTML = renderFilters(recipe)
  $('#wb-preview-list').innerHTML = '<div class="wb-hint">Click a filter or just press Apply to use defaults.</div>'
  $('#wb-preview-nodes').textContent = '—'
  $('#wb-preview-frames').textContent = '—'
  $('#wb-preview-conn').textContent = '—'
  $('#wb-preview-status').textContent = ''
  $('#wb-preview-apply').disabled = true
  $('#wb-preview-modal').style.display = 'flex'

  attachPreviewListenersOnce()
  // Initial preview load (deferred so the DOM has settled)
  setTimeout(refreshPreview, 0)
}

function renderFilters(recipe) {
  const f = recipe.filters
  const projectDefault = $('#wb-gen-project')?.value || getState().projectName || ''
  const parts = []
  if (f.includes('project')) {
    const opts = '<option value="">— All projects —</option>' +
      _availableProjects.map((p) => `<option value="${escAttr(p.id)}" ${p.id === projectDefault ? 'selected' : ''}>${escHtml(p.title)}</option>`).join('')
    parts.push(`<div class="field"><label>Project ${recipe.requiresProject ? '<span class="wb-needs-tag">required</span>' : ''}</label><select data-filter="projectName">${opts}</select></div>`)
  }
  if (f.includes('type')) {
    parts.push(`<div class="field full"><label>Memory type</label><div class="chips" data-filter-multi="type">${TYPES.map((t) => `<span class="chip" data-value="${t}">${t}</span>`).join('')}</div></div>`)
  }
  if (f.includes('status')) {
    parts.push(`<div class="field"><label>Status</label><select data-filter="status"><option value="active">active</option><option value="pending-review">pending-review</option><option value="deprecated">deprecated</option><option value="">all</option></select></div>`)
  }
  if (f.includes('tags') && _availableTags.length) {
    parts.push(`<div class="field full"><label>Tags (any of)</label><div class="chips" data-filter-multi="tags">${_availableTags.map((t) => `<span class="chip" data-value="${t}">${t}</span>`).join('')}</div></div>`)
  }
  if (f.includes('minConfidence')) {
    parts.push(`<div class="field"><label>Min confidence</label><div class="range-row"><input type="range" min="1" max="10" value="1" data-filter="minConfidence"><span class="range-val" id="rval-minConf">1</span></div></div>`)
  }
  if (f.includes('sinceDays')) {
    parts.push(`<div class="field"><label>Since (days, 0=any)</label><div class="range-row"><input type="range" min="0" max="365" step="1" value="0" data-filter="sinceDays"><span class="range-val" id="rval-since">∞</span></div></div>`)
  }
  if (!parts.length) parts.push('<div class="wb-hint full" style="grid-column:1/-1">No filters available for this recipe.</div>')
  return parts.join('')
}

function readFiltersFromModal() {
  const f = {}
  $('#wb-preview-filters').querySelectorAll('[data-filter]').forEach((el) => {
    const key = el.dataset.filter
    if (el.tagName === 'INPUT' && el.type === 'range') {
      const v = parseInt(el.value, 10)
      if (key === 'sinceDays') $('#rval-since').textContent = v === 0 ? '∞' : String(v)
      else if (key === 'minConfidence') $('#rval-minConf').textContent = String(v)
      if (v) f[key] = v
    } else if (el.value) {
      f[key] = el.value
    }
  })
  $('#wb-preview-filters').querySelectorAll('[data-filter-multi]').forEach((box) => {
    const key = box.dataset.filterMulti
    const selected = [...box.querySelectorAll('.chip.selected')].map((c) => c.dataset.value)
    if (selected.length) f[key] = selected.length === 1 && key === 'type' ? selected[0] : selected
  })
  return f
}

async function refreshPreview() {
  const recipe = RECIPES[_currentRecipeKind]
  if (!recipe) return
  const filters = readFiltersFromModal()
  if (recipe.requiresProject && !filters.projectName) {
    $('#wb-preview-status').textContent = '⚠ Select a project to preview.'
    $('#wb-preview-nodes').textContent = $('#wb-preview-frames').textContent = $('#wb-preview-conn').textContent = '—'
    $('#wb-preview-list').innerHTML = ''
    $('#wb-preview-apply').disabled = true
    return
  }
  $('#wb-preview-status').textContent = '⏳ Loading preview…'
  try {
    const res = await recipe.fn(filters)
    const parsed = JSON.parse(res.stateJson)
    const nodes = parsed.nodes || []
    const connectors = parsed.connectors || []
    const frames = nodes.filter((n) => n.type === 'frame')
    $('#wb-preview-nodes').textContent = String(nodes.length)
    $('#wb-preview-frames').textContent = String(frames.length)
    $('#wb-preview-conn').textContent = String(connectors.length)
    // Show top frame names + first cards
    const summary = frames.length
      ? frames.map((fr) => {
          const childCards = nodes.filter((n) => n.type === 'sb-card' && n.x >= fr.x && n.x + n.w <= fr.x + fr.w && n.y >= fr.y && n.y + n.h <= fr.y + fr.h).length
          return `<div class="item"><span class="badge">frame</span><strong>${escHtml(fr.name || 'Frame')}</strong> · ${childCards} cards</div>`
        }).join('')
      : nodes.slice(0, 8).map((n) => `<div class="item"><span class="badge">${n.cardKind || n.type}</span>${escHtml(n.snapshot?.title || n.text || n.name || n.id)}</div>`).join('')
    $('#wb-preview-list').innerHTML = summary || '<div class="wb-hint">Empty result with current filters.</div>'
    $('#wb-preview-status').textContent = nodes.length === 0 ? '⚠ No content matches these filters.' : ''
    _currentPreviewState = parsed
    $('#wb-preview-apply').disabled = nodes.length === 0
  } catch (err) {
    $('#wb-preview-status').textContent = '✗ ' + err.message
    $('#wb-preview-apply').disabled = true
  }
}

function applyPreviewToBoard() {
  if (!_currentPreviewState) return
  const parsed = _currentPreviewState
  try {
    // Offset to current viewport center to avoid overlap
    const rect = document.getElementById('wb-canvas-container').getBoundingClientRect()
    const center = clientToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2)
    const idMap = {}
    for (const n of (parsed.nodes || [])) {
      const newId = nid('gen')
      idMap[n.id] = newId
      addNode({ ...n, id: newId, x: (n.x || 0) + center.x - 200, y: (n.y || 0) + center.y - 100 })
    }
    for (const c of (parsed.connectors || [])) {
      addConnector({ ...c, id: nid('conn'), from: idMap[c.from] || c.from, to: idMap[c.to] || c.to })
    }
    commitHistory()
    scheduleSave()
    $('#wb-preview-modal').style.display = 'none'
    togglePanel('wb-generate-panel')  // close the small generate panel too
    toast(`Generated ${RECIPES[_currentRecipeKind]?.label || _currentRecipeKind}`, 'success')
  } catch (err) {
    toast('Apply failed: ' + err.message, 'error')
  }
}

// ── Comments ──

async function openCommentsForSelection() {
  const sel = [...getState().selection]
  if (sel.length !== 1) { toast('Select exactly one node to comment', 'error'); return }
  const nodeId = sel[0]
  $('#wb-comments-panel').dataset.nodeId = nodeId
  $('#wb-comments-target').textContent = `· node ${nodeId.slice(0, 8)}`
  togglePanel('wb-comments-panel', loadComments)
}

async function loadComments() {
  const nodeId = $('#wb-comments-panel').dataset.nodeId
  const list = $('#wb-comments-list')
  list.innerHTML = '<div class="wb-hint">Loading…</div>'
  try {
    const { comments } = await wb.comments.list(boardId, nodeId)
    if (!comments.length) { list.innerHTML = '<div class="wb-hint">No comments yet.</div>'; return }
    // Build tree: top-level (no parentId) + replies grouped by parentId
    const byParent = {}
    for (const c of comments) {
      const k = c.parentId || '__root__'
      if (!byParent[k]) byParent[k] = []
      byParent[k].push(c)
    }
    const roots = byParent['__root__'] || []
    const renderComment = (c, isReply = false) => {
      const replies = byParent[c.id] || []
      return `
        <div class="wb-comment ${isReply ? 'reply' : ''}">
          <div class="h">
            <span class="author">${escHtml(c.authorEmail)}</span>
            <span>${escHtml(c.createdAt.split('T')[0])}
              <button class="reply-btn" data-reply-to="${c.id}">reply</button>
              <button class="delete" data-del-comment="${c.id}">delete</button>
            </span>
          </div>
          <div class="body">${escHtml(c.body)}</div>
          ${replies.map((r) => renderComment(r, true)).join('')}
        </div>
      `
    }
    list.innerHTML = roots.map((c) => renderComment(c)).join('')
    // Wire delete + reply
    list.querySelectorAll('[data-del-comment]').forEach((b) => {
      b.addEventListener('click', async () => {
        try { await wb.comments.remove(boardId, b.dataset.delComment); loadComments(); refreshCommentCounts() }
        catch (err) { toast(err.message, 'error') }
      })
    })
    list.querySelectorAll('[data-reply-to]').forEach((b) => {
      b.addEventListener('click', () => {
        $('#wb-comment-body').focus()
        $('#wb-comment-body').dataset.replyTo = b.dataset.replyTo
        $('#wb-comment-body').placeholder = 'Reply… (Esc to cancel)'
      })
    })
  } catch (err) {
    list.innerHTML = `<div class="wb-hint" style="color:#b91c1c">${escHtml(err.message)}</div>`
  }
}

async function sendComment() {
  const nodeId = $('#wb-comments-panel').dataset.nodeId
  const body = $('#wb-comment-body').value.trim()
  if (!body) return
  const parentId = $('#wb-comment-body').dataset.replyTo || null
  try {
    await wb.comments.add(boardId, { nodeId, body, parentId })
    $('#wb-comment-body').value = ''
    delete $('#wb-comment-body').dataset.replyTo
    $('#wb-comment-body').placeholder = 'Add a comment… use @email to notify'
    loadComments()
    refreshCommentCounts()
  } catch (err) { toast(err.message, 'error') }
}

async function refreshCommentCounts() {
  try {
    const { comments } = await wb.comments.list(boardId)
    const counts = {}
    for (const c of comments) counts[c.nodeId] = (counts[c.nodeId] || 0) + 1
    update({
      nodes: getState().nodes.map((n) => ({ ...n, commentCount: counts[n.id] || 0 })),
    })
  } catch {}
}

// ── Export selection to memory ──

async function exportSelectionToMemory() {
  const sel = [...getState().selection]
  if (!sel.length) { toast('Select nodes first', 'error'); return }
  const texts = sel.map((id) => {
    const n = getState().nodes.find((x) => x.id === id)
    if (!n) return ''
    if (n.type === 'sticky') return n.text
    if (n.type === 'frame') return n.name
    if (n.type === 'code') return `\`\`\`${n.language || ''}\n${n.body}\n\`\`\``
    if (n.type === 'sb-card') return n.snapshot?.title || n.refId
    return ''
  }).filter(Boolean)
  const type = prompt('Memory type (Fact|Pattern|Decision|BugFix|AntiPattern|Todo|Preference):', 'Fact')
  if (!type) return
  try {
    const { memoryId } = await wb.exportMemory(boardId, { selection: texts, type })
    toast(`Memory created: ${memoryId}`, 'success')
  } catch (err) { toast(err.message, 'error') }
}

// ── Search (local) ──

function runSearch() {
  const q = $('#wb-search-input').value.trim().toLowerCase()
  if (!q) { update({ matches: [] }); $('#wb-search-count').textContent = ''; return }
  const matches = getState().nodes.filter((n) => {
    const text = [n.text, n.name, n.body, n.snapshot?.title, n.snapshot?.subtitle, n.refId].filter(Boolean).join(' ').toLowerCase()
    return text.includes(q)
  }).map((n) => n.id)
  update({ matches })
  $('#wb-search-count').textContent = `${matches.length} matches`
  if (matches.length) jumpToNode(matches[0])
}

let matchIdx = 0
function navigateMatch(dir) {
  const { matches } = getState()
  if (!matches.length) return
  matchIdx = (matchIdx + dir + matches.length) % matches.length
  jumpToNode(matches[matchIdx])
}

function doReplace(all) {
  const q = $('#wb-search-input').value
  const repl = $('#wb-replace-input').value
  if (!q) return
  const lower = q.toLowerCase()
  let replaced = 0
  const newNodes = getState().nodes.map((n) => {
    let updated = { ...n }
    let didReplace = false
    if (n.type === 'sticky' && typeof n.text === 'string' && n.text.toLowerCase().includes(lower)) {
      if (all) updated.text = caseInsensitiveReplaceAll(n.text, q, repl)
      else if (!replaced) { updated.text = caseInsensitiveReplaceFirst(n.text, q, repl); didReplace = true }
    }
    if (n.type === 'frame' && typeof n.name === 'string' && n.name.toLowerCase().includes(lower)) {
      if (all || (!didReplace && !replaced)) {
        updated.name = all ? caseInsensitiveReplaceAll(n.name, q, repl) : caseInsensitiveReplaceFirst(n.name, q, repl)
        if (!all) didReplace = true
      }
    }
    if (n.type === 'code' && typeof n.body === 'string' && n.body.toLowerCase().includes(lower)) {
      if (all || (!didReplace && !replaced)) {
        updated.body = all ? caseInsensitiveReplaceAll(n.body, q, repl) : caseInsensitiveReplaceFirst(n.body, q, repl)
        if (!all) didReplace = true
      }
    }
    if (didReplace) replaced++
    return updated
  })
  update({ nodes: newNodes })
  commitHistory(); scheduleSave()
  runSearch()
  toast(`Replaced ${all ? newNodes.filter((n,i) => n !== getState().nodes[i]).length : (replaced ? '1' : '0')}`)
}

function caseInsensitiveReplaceFirst(haystack, needle, repl) {
  const idx = haystack.toLowerCase().indexOf(needle.toLowerCase())
  if (idx < 0) return haystack
  return haystack.slice(0, idx) + repl + haystack.slice(idx + needle.length)
}
function caseInsensitiveReplaceAll(haystack, needle, repl) {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return haystack.replace(re, repl)
}

function jumpToNode(nodeId) {
  const n = getState().nodes.find((x) => x.id === nodeId)
  if (!n) return
  const rect = document.getElementById('wb-canvas-container').getBoundingClientRect()
  const zoom = Math.max(0.6, getState().viewport.zoom)
  update({
    viewport: {
      zoom,
      x: rect.width / 2 - (n.x + n.w / 2) * zoom,
      y: rect.height / 2 - (n.y + n.h / 2) * zoom,
    },
    selection: new Set([nodeId]),
  })
}

// ── Timer ──

let timerInt = null
let timerEnd = 0
function bindTimer() {
  $('#wb-timer-start').addEventListener('click', () => {
    const min = Math.max(1, parseInt($('#wb-timer-input').value) || 5)
    timerEnd = Date.now() + min * 60_000
    if (timerInt) clearInterval(timerInt)
    timerInt = setInterval(tickTimer, 250)
    tickTimer()
  })
  $('#wb-timer-reset').addEventListener('click', () => {
    if (timerInt) clearInterval(timerInt)
    $('#wb-timer-display').textContent = ($('#wb-timer-input').value || 5) + ':00'
  })
}
function tickTimer() {
  const left = Math.max(0, timerEnd - Date.now())
  const m = Math.floor(left / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  $('#wb-timer-display').textContent = `${m}:${String(s).padStart(2, '0')}`
  if (left === 0 && timerInt) {
    clearInterval(timerInt); timerInt = null
    $('#wb-timer').classList.add('flash')
    setTimeout(() => $('#wb-timer').classList.remove('flash'), 3000)
    try { new AudioContext().resume() } catch {}
    toast('Timer finished!', 'success')
  }
}

// ── Author legend ──

function renderAuthorLegend(authors) {
  const el = $('#wb-author-legend')
  el.innerHTML = authors.map((a) => `
    <span class="wb-author-chip" title="${escHtml(a.email)}">
      <span class="dot" style="background:${a.color}"></span>${escHtml(a.email.split('@')[0])}
    </span>
  `).join('')
}

// ── Helpers ──

function debounce(fn, ms) {
  let t
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms) }
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[c])
}
function escAttr(s) { return escHtml(s) }

function toast(msg, kind = 'info') {
  const el = document.createElement('div')
  el.className = 'wb-toast ' + (kind || '')
  el.textContent = msg
  document.getElementById('wb-toast-container').appendChild(el)
  setTimeout(() => el.remove(), 4000)
}
