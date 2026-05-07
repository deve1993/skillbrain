// Synapse Whiteboard — interaction layer
// Pan, zoom, select, drag, resize, marquee, tool dispatch.

import {
  getState, update, patchNode, addNode, addConnector, removeNodes, nid,
  commitHistory, undo, redo, copySelection, pasteClipboard,
  bringToFront, sendToBack, bringForward, sendBackward,
} from './state.js'
import { enterEditMode, exitEditMode } from './render.js'

const SNAP_GRID = 8
const SNAP_THRESHOLD = 6  // pixels (in canvas coords) within which to snap to another node
let isSpaceDown = false
let currentLineDraw = null
let currentShapeDraw = null
let currentPenDraw = null

const $container = document.getElementById('wb-canvas-container')
const $nodes = document.getElementById('wb-nodes')
const $marquee = document.getElementById('wb-marquee')

let pendingConnectorFrom = null
let onCanvasChange = () => {}

export function init({ onChange }) {
  onCanvasChange = onChange || (() => {})

  // Pan via middle-click or space+drag or background drag
  let isPanning = false
  let panStart = { x: 0, y: 0, vx: 0, vy: 0 }

  $container.addEventListener('mousedown', (e) => {
    const target = e.target
    const isBackground = target === $container || target.id === 'wb-grid' || target.tagName === 'svg' || target.id === 'wb-canvas' || target.id === 'wb-nodes'
    const tool = getState().tool

    // Edge click → select-or-delete
    if (target.tagName === 'path' && target.dataset.edge) {
      handleEdgeClick(target.dataset.edge, e)
      return
    }

    // Pan: middle-click OR space+drag (desktop-style: plain drag is for selection)
    if (e.button === 1 || isSpaceDown) {
      isPanning = true
      panStart = { x: e.clientX, y: e.clientY, vx: getState().viewport.x, vy: getState().viewport.y }
      $container.classList.add('panning')
      e.preventDefault()
      return
    }

    if (e.button === 0 && isBackground) {
      const pt = clientToCanvas(e.clientX, e.clientY)
      if (tool === 'sticky') {
        const id = nid('sticky')
        addNode({
          id, type: 'sticky',
          x: pt.x - 80, y: pt.y - 50,
          w: 180, h: 100,
          text: '',
          color: getState().myColor,
          author: getState().myEmail,
          editing: true,
        })
        update({ tool: 'select', selection: new Set([id]) })
        enterEditMode(id)
        onCanvasChange()
        e.preventDefault()
        return
      }
      if (tool === 'frame') {
        const id = nid('frame')
        addNode({
          id, type: 'frame',
          x: pt.x - 150, y: pt.y - 100,
          w: 300, h: 200,
          name: 'New frame',
          color: '#fef3c7',
          author: getState().myEmail,
        })
        update({ tool: 'select', selection: new Set([id]) })
        onCanvasChange()
        e.preventDefault()
        return
      }
      if (tool === 'code') {
        const id = nid('code')
        addNode({
          id, type: 'code',
          x: pt.x - 120, y: pt.y - 60,
          w: 280, h: 140,
          language: 'javascript',
          body: '// type code here\n',
          author: getState().myEmail,
        })
        update({ tool: 'select', selection: new Set([id]) })
        commitHistory()
        onCanvasChange()
        e.preventDefault()
        return
      }
      // Line tool: drag to draw
      if (tool === 'line') {
        currentLineDraw = { startPoint: pt, currentPoint: pt }
        e.preventDefault()
        return
      }
      // Shape tools (rect, ellipse, triangle): drag to draw bounding box
      if (tool === 'shape-rect' || tool === 'shape-ellipse' || tool === 'shape-triangle') {
        const shapeKind = tool.replace('shape-', '')
        currentShapeDraw = { startPoint: pt, currentPoint: pt, shape: shapeKind }
        e.preventDefault()
        return
      }
      // Pen tool: drag to draw free-hand path
      if (tool === 'pen') {
        currentPenDraw = { points: [pt], minX: pt.x, minY: pt.y, maxX: pt.x, maxY: pt.y }
        e.preventDefault()
        return
      }
      // Emoji stamp tool: click to place selected emoji
      if (tool === 'emoji') {
        const emoji = window.__wbCurrentEmoji || '⭐'
        const id = nid('emoji')
        addNode({
          id, type: 'emoji',
          x: pt.x - 30, y: pt.y - 30,
          w: 60, h: 60,
          emoji,
          author: getState().myEmail,
        })
        commitHistory()
        onCanvasChange()
        // Stay in emoji mode if Shift held (multi-stamp)
        if (!e.shiftKey) update({ tool: 'select' })
        e.preventDefault()
        return
      }
      // Desktop-style: drag on empty area in select tool = marquee select.
      // Hold Shift to ADD to existing selection instead of replacing.
      if (tool === 'select') {
        startMarquee(e, !!e.shiftKey)
        return
      }
      // Other tools fall through (handled above)
    }
  })

  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x
      const dy = e.clientY - panStart.y
      update({ viewport: { ...getState().viewport, x: panStart.vx + dx, y: panStart.vy + dy } })
    }
    if (currentDrag) handleDrag(e)
    if (currentResize) handleResize(e)
    if (marqueeActive) updateMarquee(e)
    if (pendingConnectorFrom) updatePendingEdge(e)
    if (currentLineDraw) updateLineDraw(e)
    if (currentShapeDraw) updateShapeDraw(e)
    if (currentPenDraw) updatePenDraw(e)
  })

  window.addEventListener('mouseup', (e) => {
    if (isPanning) { isPanning = false; if (!isSpaceDown) $container.classList.remove('panning') }
    if (currentDrag) endDrag(e)
    if (currentResize) endResize()
    if (marqueeActive) endMarquee()
    if (currentLineDraw) endLineDraw(e)
    if (currentShapeDraw) endShapeDraw(e)
    if (currentPenDraw) endPenDraw(e)
  })

  // Wheel handling — distinguishes:
  //   • Ctrl/Cmd + wheel  → zoom (mouse wheel + modifier)
  //   • Trackpad pinch    → ctrlKey is auto-set by browser → zoom
  //   • Plain trackpad swipe (2 fingers) → pan (deltaX + deltaY both non-zero, no modifier)
  //   • Plain mouse wheel → zoom (single-axis deltaY, no modifier)
  $container.addEventListener('wheel', (e) => {
    e.preventDefault()
    const { viewport } = getState()
    const isPinch = e.ctrlKey  // Browsers map trackpad pinch to wheel + ctrlKey
    const isModifier = e.metaKey || (e.ctrlKey && !isPinch)
    // Heuristic: trackpad 2-finger pan typically has fractional/small deltas on both axes
    const looksLikeTrackpadPan = !isPinch && !isModifier && (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) < 50)
    if (looksLikeTrackpadPan && Math.abs(e.deltaX) + Math.abs(e.deltaY) < 100) {
      // 2-finger pan
      update({ viewport: { ...viewport, x: viewport.x - e.deltaX, y: viewport.y - e.deltaY } })
      return
    }
    // Zoom around cursor
    const rect = $container.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    // Smoother zoom factor for pinch (small deltaY) vs wheel (large step)
    const intensity = isPinch ? Math.exp(-e.deltaY * 0.01) : (e.deltaY < 0 ? 1.15 : 1 / 1.15)
    const newZoom = Math.min(4, Math.max(0.1, viewport.zoom * intensity))
    const wx = (cx - viewport.x) / viewport.zoom
    const wy = (cy - viewport.y) / viewport.zoom
    update({ viewport: {
      x: cx - wx * newZoom,
      y: cy - wy * newZoom,
      zoom: newZoom,
    }})
  }, { passive: false })

  // Node mousedown → drag or vote or connector-source
  $nodes.addEventListener('mousedown', (e) => {
    const node = e.target.closest('.wb-node')
    if (!node) return
    const id = node.dataset.id
    const state = getState()

    // Resize handle? (any of the 8)
    if (e.target.classList.contains('wb-handle')) {
      startResize(id, e, e.target.dataset.handle)
      e.stopPropagation()
      return
    }
    // Legacy single-corner handle support
    if (e.target.classList.contains('wb-resize')) {
      startResize(id, e, 'se')
      e.stopPropagation()
      return
    }

    // Voting tool?
    if (state.voting) {
      castVote(id)
      e.stopPropagation()
      return
    }

    // Connector tool: pick source then target
    if (state.tool === 'connector') {
      if (!pendingConnectorFrom) {
        pendingConnectorFrom = id
        node.classList.add('connector-source')
        e.stopPropagation()
        return
      }
      if (pendingConnectorFrom === id) {
        pendingConnectorFrom = null
        node.classList.remove('connector-source')
        e.stopPropagation()
        return
      }
      addConnector({
        id: nid('conn'),
        from: pendingConnectorFrom, to: id,
        kind: 'related', label: '',
      })
      const srcEl = document.querySelector(`[data-id="${pendingConnectorFrom}"]`)
      if (srcEl) srcEl.classList.remove('connector-source')
      pendingConnectorFrom = null
      hidePendingEdge()
      update({ tool: 'select' })
      onCanvasChange()
      e.stopPropagation()
      return
    }

    // Already editing? let textarea handle
    if (e.target.tagName === 'TEXTAREA') return

    // Select (with shift for additive)
    const sel = new Set(state.selection)
    if (e.shiftKey) {
      if (sel.has(id)) sel.delete(id); else sel.add(id)
    } else if (!sel.has(id)) {
      sel.clear(); sel.add(id)
    }
    update({ selection: sel })

    // Don't drag locked nodes
    const targetNode = state.nodes.find((x) => x.id === id)
    if (targetNode?.locked) return

    // Begin drag of selected nodes
    startDrag(e)
  })

  // Double-click on EMPTY canvas → create sticky in edit mode (FigJam pattern)
  $container.addEventListener('dblclick', (e) => {
    const target = e.target
    const isBackground = target === $container || target.id === 'wb-grid' || target.tagName === 'svg' || target.id === 'wb-canvas' || target.id === 'wb-nodes'
    if (!isBackground) return
    const pt = clientToCanvas(e.clientX, e.clientY)
    const id = nid('sticky')
    addNode({
      id, type: 'sticky',
      x: pt.x - 80, y: pt.y - 50,
      w: 180, h: 100,
      text: '',
      color: getState().myColor,
      author: getState().myEmail,
      editing: true,
    })
    update({ selection: new Set([id]) })
    enterEditMode(id)
    onCanvasChange()
    e.preventDefault()
  })

  // Double-click sticky → edit
  $nodes.addEventListener('dblclick', (e) => {
    const node = e.target.closest('.wb-node')
    if (!node) return
    const id = node.dataset.id
    const state = getState()
    const n = state.nodes.find((x) => x.id === id)
    if (!n) return
    if (n.type === 'sticky') enterEditMode(id)
    else if (n.type === 'frame') {
      if (window.__wbStartFrameRename) window.__wbStartFrameRename(id)
    } else if (n.type === 'code') {
      if (window.__wbOpenCodeEditor) window.__wbOpenCodeEditor(id)
    } else if (n.type === 'sb-card') {
      // Open inline detail panel (was: external link). Hold Shift to open in new tab.
      if (e.shiftKey) {
        const url = cardLinkUrl(n)
        if (url) window.open(url, '_blank')
      } else if (window.__wbOpenEntityPanel) {
        window.__wbOpenEntityPanel(n)
      }
    }
  })

  // Sticky textarea blur → save
  $nodes.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'TEXTAREA' && e.target.dataset.editId) {
      const id = e.target.dataset.editId
      exitEditMode(id, e.target.value)
      commitHistory()
      onCanvasChange()
    }
  })

  // Sticky textarea input → grow node BOTH dimensions to fit content (auto-grow)
  $nodes.addEventListener('input', (e) => {
    if (e.target.tagName !== 'TEXTAREA' || !e.target.dataset.editId) return
    const id = e.target.dataset.editId
    const node = getState().nodes.find((n) => n.id === id)
    if (!node) return
    // Measure required height
    e.target.style.height = 'auto'
    const neededH = Math.min(600, Math.max(node.h, e.target.scrollHeight + 24))
    // Measure longest line for horizontal grow (only if user types long words/lines without breaks)
    const text = e.target.value || ''
    const longestLine = text.split('\n').reduce((m, l) => Math.max(m, l.length), 0)
    // Approximate: 7px per char @ 13px font, plus padding
    const approxLineW = longestLine * 7 + 32
    const neededW = Math.min(480, Math.max(node.w, approxLineW))
    const patch = {}
    if (neededH !== node.h) patch.h = neededH
    if (neededW !== node.w) patch.w = neededW
    if (Object.keys(patch).length) patchNode(id, patch)
    e.target.style.height = '100%'
  })

  // Track Space key for pan
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' && !isInField(e.target)) {
      isSpaceDown = true
      $container.classList.add('panning')
      e.preventDefault()
    }
  })
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      isSpaceDown = false
      $container.classList.remove('panning')
    }
  })

  // Main keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const inField = isInField(e.target)
    const cmd = e.metaKey || e.ctrlKey

    // Esc always
    if (e.key === 'Escape') {
      if (pendingConnectorFrom) {
        const srcEl = document.querySelector(`[data-id="${pendingConnectorFrom}"]`)
        if (srcEl) srcEl.classList.remove('connector-source')
        pendingConnectorFrom = null
        hidePendingEdge()
        update({ tool: 'select' })
        return
      }
      if (inField && e.target.tagName === 'TEXTAREA' && e.target.dataset.editId) {
        e.target.blur()
        return
      }
      // Close any context menu
      const ctx = document.getElementById('wb-context-menu')
      if (ctx) ctx.remove()
      document.querySelectorAll('.wb-panel').forEach((p) => p.style.display = 'none')
      document.getElementById('wb-search-overlay').style.display = 'none'
      update({ matches: [] })
      return
    }

    // Undo/Redo work even when focus is in input (matches FigJam)
    if (cmd && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (undo()) onCanvasChange()
      return
    }
    if (cmd && (e.key === 'Z' || (e.shiftKey && e.key === 'z') || e.key === 'y')) {
      e.preventDefault()
      if (redo()) onCanvasChange()
      return
    }

    if (inField) return

    // Cmd+A select all
    if (cmd && e.key === 'a') {
      e.preventDefault()
      update({ selection: new Set(getState().nodes.map((n) => n.id)) })
      return
    }
    // Cmd+C copy
    if (cmd && e.key === 'c') {
      const n = copySelection()
      if (n) toast(`Copied ${n} node${n > 1 ? 's' : ''}`)
      return
    }
    // Cmd+V paste
    if (cmd && e.key === 'v') {
      const newIds = pasteClipboard(30)
      if (newIds.length) onCanvasChange()
      return
    }
    if (cmd && e.key === 'f') {
      e.preventDefault()
      document.getElementById('wb-search-overlay').style.display = 'flex'
      document.getElementById('wb-search-input').focus()
      return
    }
    if (cmd && e.key === 'd') {
      e.preventDefault()
      const sel = [...getState().selection]
      if (sel.length) {
        for (const id of sel) {
          const n = getState().nodes.find((x) => x.id === id)
          if (n) addNode({ ...n, id: nid(n.type), x: n.x + 30, y: n.y + 30 })
        }
        commitHistory()
        onCanvasChange()
      }
      return
    }
    // Z-order
    if (e.key === ']' && cmd) {
      const sel = [...getState().selection]; if (sel.length) { bringToFront(sel); onCanvasChange() }; return
    }
    if (e.key === '[' && cmd) {
      const sel = [...getState().selection]; if (sel.length) { sendToBack(sel); onCanvasChange() }; return
    }
    if (e.key === ']' && !cmd) {
      const sel = [...getState().selection]; if (sel.length) { bringForward(sel); onCanvasChange() }; return
    }
    if (e.key === '[' && !cmd) {
      const sel = [...getState().selection]; if (sel.length) { sendBackward(sel); onCanvasChange() }; return
    }
    // Arrow keys nudge
    if (e.key.startsWith('Arrow')) {
      const sel = [...getState().selection]
      if (!sel.length) return
      const step = e.shiftKey ? 10 : 1
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      if (dx === 0 && dy === 0) return
      e.preventDefault()
      for (const id of sel) {
        const n = getState().nodes.find((x) => x.id === id)
        if (n) patchNode(id, { x: n.x + dx, y: n.y + dy })
      }
      // Debounce history commit when arrow-nudging
      if (nudgeCommitTimer) clearTimeout(nudgeCommitTimer)
      nudgeCommitTimer = setTimeout(() => { commitHistory(); onCanvasChange() }, 500)
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const ids = [...getState().selection]
      if (ids.length) { removeNodes(ids); commitHistory(); onCanvasChange() }
      return
    }
    if (e.key === '0') {
      fitToView()
      return
    }
    if (e.key === 'g' && !cmd) { // toggle snap
      update({ snapEnabled: !getState().snapEnabled })
      toast(getState().snapEnabled ? 'Snap ON' : 'Snap OFF')
      return
    }
    // Group / Ungroup with Cmd+G / Cmd+Shift+G
    if (e.key === 'g' && cmd) {
      e.preventDefault()
      const sel = [...getState().selection]
      if (e.shiftKey) {
        // Ungroup: if selection contains a group node, dissolve it
        const groups = sel.map((id) => getState().nodes.find((n) => n.id === id)).filter((n) => n && n.type === 'group')
        if (groups.length) {
          for (const g of groups) {
            // Re-anchor children: clear groupId
            const children = getState().nodes.filter((n) => n.groupId === g.id)
            for (const c of children) patchNode(c.id, { groupId: undefined })
            removeNodes([g.id])
          }
          commitHistory(); onCanvasChange()
          toast('Ungrouped')
        }
      } else {
        // Group: wrap selection in a new group node (bounding box, child links via groupId)
        if (sel.length < 2) { toast('Select at least 2 nodes to group'); return }
        const nodes = sel.map((id) => getState().nodes.find((n) => n.id === id)).filter(Boolean)
        const minX = Math.min(...nodes.map((n) => n.x)) - 12
        const minY = Math.min(...nodes.map((n) => n.y)) - 12
        const maxX = Math.max(...nodes.map((n) => n.x + n.w)) + 12
        const maxY = Math.max(...nodes.map((n) => n.y + n.h)) + 12
        const groupId = nid('group')
        // Insert group node BEFORE its children so it renders below them
        addNode({
          id: groupId, type: 'group',
          x: minX, y: minY, w: maxX - minX, h: maxY - minY,
          name: `Group of ${sel.length}`,
          author: getState().myEmail,
        })
        for (const n of nodes) patchNode(n.id, { groupId })
        update({ selection: new Set([groupId]) })
        commitHistory(); onCanvasChange()
        toast(`Grouped ${sel.length} nodes`)
      }
      return
    }
    // Lock / unlock selected
    if (e.key === 'l' && cmd) {
      e.preventDefault()
      const sel = [...getState().selection]
      if (!sel.length) return
      const allLocked = sel.every((id) => getState().nodes.find((n) => n.id === id)?.locked)
      for (const id of sel) patchNode(id, { locked: !allLocked })
      commitHistory(); onCanvasChange()
      toast(allLocked ? 'Unlocked' : 'Locked')
      return
    }
    const map = {
      v: 'select', s: 'sticky', f: 'frame', c: 'code', a: 'connector',
      l: 'line', p: 'pen', r: 'shape-rect', e: 'shape-ellipse', t: 'shape-triangle',
      m: 'emoji',
    }
    if (map[e.key]) update({ tool: map[e.key] })
  })

  // Right-click context menu
  $container.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    const node = e.target.closest('.wb-node')
    if (node) {
      const id = node.dataset.id
      const sel = new Set(getState().selection)
      if (!sel.has(id)) { sel.clear(); sel.add(id); update({ selection: sel }) }
    }
    showContextMenu(e.clientX, e.clientY)
  })

  // Subscribe to tool changes to toggle connector banner

  // Subscribe to tool changes to toggle connector banner
  import('./state.js').then(({ subscribe: sub }) => {
    sub((s) => {
      const banner = document.getElementById('wb-connector-banner')
      if (banner) banner.style.display = s.tool === 'connector' ? 'block' : 'none'
    })
  })
}

// ── Drag ──
let currentDrag = null
function startDrag(e) {
  const sel = [...getState().selection]
  if (!sel.length) return
  const startPos = sel.map((id) => {
    const n = getState().nodes.find((x) => x.id === id)
    return { id, x: n.x, y: n.y, w: n.w, h: n.h }
  })
  // For frames: drag children inside the frame's bounds
  // For groups: drag all children with matching groupId
  const childIds = new Set()
  for (const id of sel) {
    const n = getState().nodes.find((x) => x.id === id)
    if (!n) continue
    if (n.type === 'frame') {
      for (const other of getState().nodes) {
        if (other.id === id || sel.includes(other.id)) continue
        if (other.x >= n.x && other.y >= n.y && other.x + other.w <= n.x + n.w && other.y + other.h <= n.y + n.h) {
          childIds.add(other.id)
        }
      }
    }
    if (n.type === 'group') {
      for (const other of getState().nodes) {
        if (other.groupId === n.id && !sel.includes(other.id)) childIds.add(other.id)
      }
    }
  }
  const childStartPos = [...childIds].map((id) => {
    const n = getState().nodes.find((x) => x.id === id)
    return { id, x: n.x, y: n.y }
  })
  currentDrag = {
    startClient: { x: e.clientX, y: e.clientY },
    startPos: [...startPos, ...childStartPos],
  }
}

function handleDrag(e) {
  if (!currentDrag) return
  const zoom = getState().viewport.zoom
  let dx = (e.clientX - currentDrag.startClient.x) / zoom
  let dy = (e.clientY - currentDrag.startClient.y) / zoom
  // Filter out locked nodes from positions to update
  currentDrag.startPos = currentDrag.startPos.filter((p) => {
    const n = getState().nodes.find((x) => x.id === p.id)
    return n && !n.locked
  })

  // Snap to grid + alignment guides (only when not holding Alt)
  let guides = []
  const snapOn = getState().snapEnabled && !e.altKey
  if (snapOn && currentDrag.startPos.length === 1) {
    const p = currentDrag.startPos[0]
    const targetX = p.x + dx
    const targetY = p.y + dy
    // Snap to grid first
    const gridX = Math.round(targetX / SNAP_GRID) * SNAP_GRID
    const gridY = Math.round(targetY / SNAP_GRID) * SNAP_GRID
    // Then check alignment with other nodes
    const others = getState().nodes.filter((n) => n.id !== p.id)
    const candidates = { x: [gridX], y: [gridY], guides: [] }
    for (const o of others) {
      const oxs = [o.x, o.x + o.w / 2, o.x + o.w]
      const oys = [o.y, o.y + o.h / 2, o.y + o.h]
      const myXs = [targetX, targetX + p.w / 2, targetX + p.w]
      const myYs = [targetY, targetY + p.h / 2, targetY + p.h]
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (Math.abs(myXs[i] - oxs[j]) < SNAP_THRESHOLD) {
            candidates.x.push(targetX + (oxs[j] - myXs[i]))
            candidates.guides.push({ x: oxs[j] })
          }
          if (Math.abs(myYs[i] - oys[j]) < SNAP_THRESHOLD) {
            candidates.y.push(targetY + (oys[j] - myYs[i]))
            candidates.guides.push({ y: oys[j] })
          }
        }
      }
    }
    // Pick the candidate closest to original target
    const finalX = candidates.x.length === 1 ? candidates.x[0] : candidates.x.reduce((a, b) => Math.abs(a - targetX) < Math.abs(b - targetX) ? a : b)
    const finalY = candidates.y.length === 1 ? candidates.y[0] : candidates.y.reduce((a, b) => Math.abs(a - targetY) < Math.abs(b - targetY) ? a : b)
    dx = finalX - p.x
    dy = finalY - p.y
    // Only show guides that actually triggered the snap
    guides = candidates.guides.filter((g) =>
      (g.x !== undefined && Math.abs(g.x - finalX) < 1) ||
      (g.x !== undefined && Math.abs(g.x - (finalX + p.w / 2)) < 1) ||
      (g.x !== undefined && Math.abs(g.x - (finalX + p.w)) < 1) ||
      (g.y !== undefined && Math.abs(g.y - finalY) < 1) ||
      (g.y !== undefined && Math.abs(g.y - (finalY + p.h / 2)) < 1) ||
      (g.y !== undefined && Math.abs(g.y - (finalY + p.h)) < 1)
    )
  } else if (snapOn) {
    // Multi-select: snap to grid only
    dx = Math.round(dx / SNAP_GRID) * SNAP_GRID
    dy = Math.round(dy / SNAP_GRID) * SNAP_GRID
  }

  for (const p of currentDrag.startPos) {
    patchNode(p.id, { x: p.x + dx, y: p.y + dy })
  }
  update({ guides })
}

function endDrag() {
  currentDrag = null
  update({ guides: [] })
  commitHistory()
  onCanvasChange()
}

// ── Resize (8 handles: nw, n, ne, w, e, sw, s, se) ──
let currentResize = null
function startResize(id, e, handle = 'se') {
  const n = getState().nodes.find((x) => x.id === id)
  if (!n) return
  currentResize = {
    id, handle,
    startClient: { x: e.clientX, y: e.clientY },
    startX: n.x, startY: n.y, startW: n.w, startH: n.h,
  }
}
function handleResize(e) {
  if (!currentResize) return
  const zoom = getState().viewport.zoom
  const dx = (e.clientX - currentResize.startClient.x) / zoom
  const dy = (e.clientY - currentResize.startClient.y) / zoom
  const h = currentResize.handle
  let { startX: x, startY: y, startW: w, startH: ht } = currentResize
  // Apply per-handle delta
  if (h.includes('e')) w = currentResize.startW + dx
  if (h.includes('w')) { w = currentResize.startW - dx; x = currentResize.startX + dx }
  if (h.includes('s')) ht = currentResize.startH + dy
  if (h.includes('n')) { ht = currentResize.startH - dy; y = currentResize.startY + dy }
  // Min size guard (prevent flipping)
  const minW = 60, minH = 40
  if (w < minW) {
    if (h.includes('w')) x = currentResize.startX + currentResize.startW - minW
    w = minW
  }
  if (ht < minH) {
    if (h.includes('n')) y = currentResize.startY + currentResize.startH - minH
    ht = minH
  }
  patchNode(currentResize.id, { x, y, w, h: ht })
}
function endResize() { currentResize = null; commitHistory(); onCanvasChange() }

// ── Helpers ──
let nudgeCommitTimer = null
function isInField(target) {
  return target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
}
function toast(msg) {
  const el = document.createElement('div')
  el.className = 'wb-toast'
  el.textContent = msg
  const c = document.getElementById('wb-toast-container')
  if (c) {
    c.appendChild(el)
    setTimeout(() => el.remove(), 2000)
  }
}

// ── Right-click context menu ──
function showContextMenu(x, y) {
  const existing = document.getElementById('wb-context-menu')
  if (existing) existing.remove()
  const sel = [...getState().selection]
  const hasSel = sel.length > 0
  const menu = document.createElement('div')
  menu.id = 'wb-context-menu'
  menu.className = 'wb-context-menu'
  menu.style.left = x + 'px'
  menu.style.top = y + 'px'
  menu.innerHTML = `
    ${hasSel ? `
      <div class="item" data-act="copy">Copy <span class="kbd">⌘C</span></div>
      <div class="item" data-act="duplicate">Duplicate <span class="kbd">⌘D</span></div>
      <div class="item" data-act="delete">Delete <span class="kbd">Del</span></div>
      <div class="sep"></div>
      <div class="item" data-act="bring-front">Bring to front <span class="kbd">⌘]</span></div>
      <div class="item" data-act="bring-forward">Bring forward <span class="kbd">]</span></div>
      <div class="item" data-act="send-backward">Send backward <span class="kbd">[</span></div>
      <div class="item" data-act="send-back">Send to back <span class="kbd">⌘[</span></div>
      <div class="sep"></div>
    ` : ''}
    <div class="item" data-act="paste">Paste <span class="kbd">⌘V</span></div>
    <div class="item" data-act="select-all">Select all <span class="kbd">⌘A</span></div>
    <div class="sep"></div>
    <div class="item" data-act="snap">${getState().snapEnabled ? '✓ ' : ''}Snap to grid <span class="kbd">G</span></div>
    <div class="item" data-act="fit">Fit to view <span class="kbd">0</span></div>
  `
  document.body.appendChild(menu)
  menu.querySelectorAll('.item').forEach((el) => {
    el.addEventListener('click', () => {
      handleContextMenuAction(el.dataset.act)
      menu.remove()
    })
  })
  // Click outside closes
  setTimeout(() => {
    document.addEventListener('mousedown', function once(ev) {
      if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', once) }
    })
  }, 0)
}

function handleContextMenuAction(act) {
  const sel = [...getState().selection]
  switch (act) {
    case 'copy': { const n = copySelection(); if (n) toast(`Copied ${n}`); break }
    case 'paste': { pasteClipboard(30); onCanvasChange(); break }
    case 'duplicate': {
      for (const id of sel) {
        const n = getState().nodes.find((x) => x.id === id)
        if (n) addNode({ ...n, id: nid(n.type), x: n.x + 30, y: n.y + 30 })
      }
      commitHistory(); onCanvasChange(); break
    }
    case 'delete': { removeNodes(sel); commitHistory(); onCanvasChange(); break }
    case 'bring-front': { bringToFront(sel); onCanvasChange(); break }
    case 'bring-forward': { bringForward(sel); onCanvasChange(); break }
    case 'send-back': { sendToBack(sel); onCanvasChange(); break }
    case 'send-backward': { sendBackward(sel); onCanvasChange(); break }
    case 'select-all': { update({ selection: new Set(getState().nodes.map((n) => n.id)) }); break }
    case 'snap': { update({ snapEnabled: !getState().snapEnabled }); toast(getState().snapEnabled ? 'Snap ON' : 'Snap OFF'); break }
    case 'fit': { fitToView(); break }
  }
}

// ── Marquee (desktop-style drag-select) ──
const MARQUEE_MIN_DRAG = 4   // px before we consider it a real drag (not a click)
let marqueeActive = null
function startMarquee(e, additive = false) {
  // Marquee element is inside #wb-canvas-container, so its absolute coords are
  // relative to container's top-left. Convert client X/Y → container-local.
  const rect = $container.getBoundingClientRect()
  const baseSel = additive ? new Set(getState().selection) : null
  marqueeActive = {
    x0: e.clientX - rect.left,
    y0: e.clientY - rect.top,
    startClient: { x: e.clientX, y: e.clientY },
    additive,
    baseSel,
    isDragging: false,
  }
}
function updateMarquee(e) {
  if (!marqueeActive) return
  const rect = $container.getBoundingClientRect()
  const x = e.clientX - rect.left, y = e.clientY - rect.top
  if (!marqueeActive.isDragging) {
    const movedX = Math.abs(e.clientX - marqueeActive.startClient.x)
    const movedY = Math.abs(e.clientY - marqueeActive.startClient.y)
    if (movedX < MARQUEE_MIN_DRAG && movedY < MARQUEE_MIN_DRAG) return
    marqueeActive.isDragging = true
    $marquee.style.display = 'block'
  }
  const left = Math.min(marqueeActive.x0, x), top = Math.min(marqueeActive.y0, y)
  const w = Math.abs(x - marqueeActive.x0), h = Math.abs(y - marqueeActive.y0)
  $marquee.style.left = left + 'px'
  $marquee.style.top = top + 'px'
  $marquee.style.width = w + 'px'
  $marquee.style.height = h + 'px'
  recomputeMarqueeSelection()
}
function recomputeMarqueeSelection() {
  if (!marqueeActive || !marqueeActive.isDragging) return
  const rect = $container.getBoundingClientRect()
  const left = parseInt($marquee.style.left), top = parseInt($marquee.style.top)
  const w = parseInt($marquee.style.width), h = parseInt($marquee.style.height)
  // Convert container-local marquee → viewport → canvas-world
  const a = clientToCanvas(left + rect.left, top + rect.top)
  const b = clientToCanvas(left + rect.left + w, top + rect.top + h)
  const hits = new Set()
  for (const n of getState().nodes) {
    // INTERSECTION (any overlap), not strict containment — matches desktop behavior
    if (n.x + n.w >= a.x && n.x <= b.x && n.y + n.h >= a.y && n.y <= b.y) hits.add(n.id)
  }
  if (marqueeActive.additive && marqueeActive.baseSel) {
    for (const id of marqueeActive.baseSel) hits.add(id)
  }
  update({ selection: hits })
}
function endMarquee() {
  if (!marqueeActive) return
  // If user just clicked (no drag) → clear selection (unless shift held)
  if (!marqueeActive.isDragging) {
    if (!marqueeActive.additive) update({ selection: new Set() })
  }
  $marquee.style.display = 'none'
  marqueeActive = null
}

// ── Edge click ──
function handleEdgeClick(edgeId, e) {
  if (e.altKey) {
    update({ connectors: getState().connectors.filter((c) => c.id !== edgeId) })
    onCanvasChange()
    return
  }
  // Cycle connector kind / set label
  const c = getState().connectors.find((x) => x.id === edgeId)
  if (!c) return
  const kinds = ['related', 'depends-on', 'blocks', 'leads-to']
  const next = kinds[(kinds.indexOf(c.kind || 'related') + 1) % kinds.length]
  const label = e.shiftKey ? prompt('Edge label:', c.label || '') : c.label
  if (label === null) return
  const conns = getState().connectors.map((x) => x.id === edgeId ? { ...x, kind: next, label: label || '' } : x)
  update({ connectors: conns })
  onCanvasChange()
}

// ── Voting ──
function castVote(nodeId) {
  const state = getState()
  if (state.votesUsed >= state.votePool) return
  const n = state.nodes.find((x) => x.id === nodeId)
  if (!n) return
  const votes = { ...(n.votes || {}) }
  votes[state.myEmail] = (votes[state.myEmail] || 0) + 1
  patchNode(nodeId, { votes })
  update({ votesUsed: state.votesUsed + 1 })
  document.getElementById('wb-votes-left').textContent = String(state.votePool - (state.votesUsed + 1))
  onCanvasChange()
}

// ── Shape draw (rect, ellipse, triangle) ──
function updateShapeDraw(e) {
  if (!currentShapeDraw) return
  currentShapeDraw.currentPoint = clientToCanvas(e.clientX, e.clientY)
  const pendingEdge = document.getElementById('wb-pending-edge')
  if (!pendingEdge) return
  const a = currentShapeDraw.startPoint, b = currentShapeDraw.currentPoint
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
  const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y)
  const path = pendingEdge.querySelector('path')
  // Render preview as a rectangle outline regardless of shape kind
  path.setAttribute('d', `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`)
  pendingEdge.style.display = 'block'
}
function endShapeDraw() {
  if (!currentShapeDraw) return
  const a = currentShapeDraw.startPoint, b = currentShapeDraw.currentPoint
  const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y)
  if (w > 5 && h > 5) {
    const id = nid('shape')
    addNode({
      id, type: 'shape',
      shape: currentShapeDraw.shape,
      x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      w, h,
      color: 'rgba(99,102,241,0.12)',
      stroke: '#6366f1',
      author: getState().myEmail,
    })
    update({ selection: new Set([id]) })
    commitHistory()
    onCanvasChange()
  }
  currentShapeDraw = null
  hidePendingEdge()
  update({ tool: 'select' })
}

// ── Pen draw (free-hand SVG path) ──
function updatePenDraw(e) {
  if (!currentPenDraw) return
  const pt = clientToCanvas(e.clientX, e.clientY)
  // Ignore points too close to the previous (smoothing)
  const last = currentPenDraw.points[currentPenDraw.points.length - 1]
  if (Math.hypot(pt.x - last.x, pt.y - last.y) < 2) return
  currentPenDraw.points.push(pt)
  currentPenDraw.minX = Math.min(currentPenDraw.minX, pt.x)
  currentPenDraw.minY = Math.min(currentPenDraw.minY, pt.y)
  currentPenDraw.maxX = Math.max(currentPenDraw.maxX, pt.x)
  currentPenDraw.maxY = Math.max(currentPenDraw.maxY, pt.y)
  // Live preview using pending-edge SVG (single path)
  const pendingEdge = document.getElementById('wb-pending-edge')
  if (pendingEdge) {
    const d = currentPenDraw.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    pendingEdge.querySelector('path').setAttribute('d', d)
    pendingEdge.style.display = 'block'
  }
}
function endPenDraw() {
  if (!currentPenDraw) return
  const { points, minX, minY, maxX, maxY } = currentPenDraw
  if (points.length >= 3) {
    const padding = 8
    const x = minX - padding, y = minY - padding
    const w = (maxX - minX) + padding * 2, h = (maxY - minY) + padding * 2
    // Translate path to local coordinates
    const local = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x - x).toFixed(1)} ${(p.y - y).toFixed(1)}`).join(' ')
    const id = nid('pen')
    addNode({
      id, type: 'pen',
      x, y, w, h,
      path: local,
      color: getState().myColor || '#1e293b',
      strokeWidth: 3,
      author: getState().myEmail,
    })
    commitHistory()
    onCanvasChange()
  }
  currentPenDraw = null
  hidePendingEdge()
  // Pen tool stays active for continuous drawing — toggle off via Esc or V
}

// ── Standalone line draw ──
function updateLineDraw(e) {
  if (!currentLineDraw) return
  currentLineDraw.currentPoint = clientToCanvas(e.clientX, e.clientY)
  const pendingEdge = document.getElementById('wb-pending-edge')
  if (!pendingEdge) return
  const a = currentLineDraw.startPoint, b = currentLineDraw.currentPoint
  const path = pendingEdge.querySelector('path')
  path.setAttribute('d', `M ${a.x} ${a.y} L ${b.x} ${b.y}`)
  pendingEdge.style.display = 'block'
}

function endLineDraw() {
  if (!currentLineDraw) return
  const a = currentLineDraw.startPoint, b = currentLineDraw.currentPoint
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  if (dist > 8) {
    addConnector({
      id: nid('line'),
      from: '__point__', to: '__point__',
      fromPoint: a, toPoint: b,
      kind: 'related',
      label: '',
    })
    commitHistory()
    onCanvasChange()
  }
  currentLineDraw = null
  hidePendingEdge()
  update({ tool: 'select' })
}

// ── Pending connector preview ──
function updatePendingEdge(e) {
  const pendingEdge = document.getElementById('wb-pending-edge')
  if (!pendingEdge || !pendingConnectorFrom) return
  const srcEl = document.querySelector(`[data-id="${pendingConnectorFrom}"]`)
  if (!srcEl) return
  const srcNode = getState().nodes.find((n) => n.id === pendingConnectorFrom)
  if (!srcNode) return
  const ax = srcNode.x + srcNode.w / 2
  const ay = srcNode.y + srcNode.h / 2
  const pt = clientToCanvas(e.clientX, e.clientY)
  const path = pendingEdge.querySelector('path')
  path.setAttribute('d', `M ${ax} ${ay} L ${pt.x} ${pt.y}`)
  pendingEdge.style.display = 'block'
}

function hidePendingEdge() {
  const pendingEdge = document.getElementById('wb-pending-edge')
  if (pendingEdge) pendingEdge.style.display = 'none'
}

// ── Coords ──
export function clientToCanvas(cx, cy) {
  const rect = $container.getBoundingClientRect()
  const { viewport } = getState()
  return {
    x: (cx - rect.left - viewport.x) / viewport.zoom,
    y: (cy - rect.top - viewport.y) / viewport.zoom,
  }
}

export function fitToView() {
  const { nodes } = getState()
  if (!nodes.length) { update({ viewport: { x: 100, y: 100, zoom: 1 } }); return }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x)
    minY = Math.min(minY, n.y)
    maxX = Math.max(maxX, n.x + n.w)
    maxY = Math.max(maxY, n.y + n.h)
  }
  const rect = $container.getBoundingClientRect()
  const padding = 60
  const zoomX = (rect.width - padding * 2) / (maxX - minX || 1)
  const zoomY = (rect.height - padding * 2) / (maxY - minY || 1)
  const zoom = Math.min(1.5, Math.max(0.1, Math.min(zoomX, zoomY)))
  update({
    viewport: {
      zoom,
      x: padding - minX * zoom,
      y: padding - minY * zoom,
    },
  })
}

function cardLinkUrl(n) {
  const id = n.refId
  if (!id) return null
  switch (n.cardKind) {
    case 'memory':  return `/#/memories?id=${encodeURIComponent(id)}`
    case 'skill':   return `/#/skills?name=${encodeURIComponent(id)}`
    case 'session': return `/#/sessions?id=${encodeURIComponent(id)}`
    case 'project': return `/#/projects?name=${encodeURIComponent(id)}`
    default: return null
  }
}
