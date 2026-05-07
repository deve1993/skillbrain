// Synapse Whiteboard — DOM rendering
// Reads from state and produces nodes + edge SVG. Idempotent: full re-render
// on each subscribe-tick. The board is small enough (<200 nodes typical) that
// vanilla DOM diffing isn't necessary.

import { getState, patchNode } from './state.js'

const $nodes = document.getElementById('wb-nodes')
const $edges = document.getElementById('wb-edges')
const $canvas = document.getElementById('wb-canvas')

const ARROW_PALETTE = {
  related:     '#64748b',  // slate
  'depends-on':'#6366f1',  // indigo
  blocks:      '#dc2626',  // red
  'leads-to':  '#0d9488',  // teal
}

export function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[c])
}
function escAttr(s) { return escHtml(s) }

/**
 * Compute the point where a line from a node's center to (tx, ty) crosses the
 * node's bounding box. Returns the edge intersection point so connectors land
 * on the border instead of the center.
 */
function edgeAnchor(node, tx, ty) {
  return edgeAnchorWithSide(node, tx, ty)
}

/** Like edgeAnchor but also returns which side of the node was hit. */
function edgeAnchorWithSide(node, tx, ty) {
  const cx = node.x + node.w / 2
  const cy = node.y + node.h / 2
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy, side: 'right' }
  const halfW = node.w / 2
  const halfH = node.h / 2
  const tx1 = halfW / Math.abs(dx || 1)
  const ty1 = halfH / Math.abs(dy || 1)
  const t = Math.min(tx1, ty1)
  const x = cx + dx * t
  const y = cy + dy * t
  // Which side did we hit?
  let side
  if (tx1 < ty1) side = dx > 0 ? 'right' : 'left'
  else side = dy > 0 ? 'bottom' : 'top'
  return { x, y, side }
}

/** Returns the perpendicular control-point offset for a given anchor side. */
function sideOffset(side, distance, dx, dy) {
  switch (side) {
    case 'right':  return { x: distance,  y: 0 }
    case 'left':   return { x: -distance, y: 0 }
    case 'bottom': return { x: 0, y: distance }
    case 'top':    return { x: 0, y: -distance }
    default: {
      // Auto: project along source-to-target direction
      const len = Math.hypot(dx, dy) || 1
      return { x: dx / len * distance * 0.5, y: dy / len * distance * 0.5 }
    }
  }
}

/** Cubic Bezier midpoint (t=0.5) on one axis. */
function bezierMid(p0, p1, p2, p3) {
  return 0.125 * p0 + 0.375 * p1 + 0.375 * p2 + 0.125 * p3
}

/** Apply pan/zoom to the canvas root. */
export function applyViewport() {
  const { viewport } = getState()
  $canvas.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
}

/** Full re-render. Called on every state change (debounced upstream if needed). */
export function render() {
  applyViewport()
  renderNodes()
  renderEdges()
}

function renderNodes() {
  const { nodes, selection, matches, voting } = getState()
  const matchSet = new Set(matches)
  const html = nodes.map((n) => renderNode(n, selection.has(n.id), matchSet.has(n.id), voting)).join('')
  $nodes.innerHTML = html
}

function renderNode(n, selected, isMatch, voting) {
  const cls = ['wb-node']
  if (selected) cls.push('selected')
  if (isMatch) cls.push('match')
  if (n.locked) cls.push('locked')
  if (n.type === 'frame') cls.push('wb-frame')

  const style = `left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;` + (n.color ? `background:${n.color};` : '')

  // Badges (votes, comments)
  const totalVotes = n.votes ? Object.values(n.votes).reduce((s, v) => s + v, 0) : 0
  const voteBadge = totalVotes > 0
    ? `<span class="wb-vote-badge has-votes">★ ${totalVotes}</span>`
    : (voting ? '<span class="wb-vote-badge has-votes">★ 0</span>' : '')
  const commentBadge = n.commentCount > 0
    ? `<span class="wb-comment-indicator has-comments">${n.commentCount}</span>`
    : ''

  let body = ''
  if (n.type === 'frame') {
    body = `<div class="wb-frame-label">${escHtml(n.name || 'Frame')}</div>`
  } else if (n.type === 'group') {
    cls.push('group')
    body = `<div class="wb-group-label">${escHtml(n.name || 'Group')}</div>`
  } else if (n.type === 'sticky') {
    const text = n.text || ''
    if (n.editing) {
      body = `<textarea class="wb-sticky-text" data-edit-id="${n.id}">${escHtml(text)}</textarea>`
    } else {
      const md = renderMarkdown(text)
      body = `<div class="wb-sticky-render" data-render-id="${n.id}">${md || '<span style="color:#94a3b8">empty…</span>'}</div>`
    }
  } else if (n.type === 'code') {
    const lang = n.language || 'text'
    const code = n.body || ''
    let highlighted = escHtml(code)
    try {
      if (window.Prism && window.Prism.languages[lang]) {
        highlighted = window.Prism.highlight(code, window.Prism.languages[lang], lang)
      }
    } catch {}
    body = `<div class="wb-code-lang">${escHtml(lang)}</div>
            <pre class="wb-code-body"><code>${highlighted}</code></pre>`
    cls.push('wb-code-node')
  } else if (n.type === 'sb-card') {
    cls.push('wb-card')
    const snap = n.snapshot || {}
    body = `
      <div class="wb-card-title">${escHtml(snap.title || n.refId)}</div>
      ${snap.subtitle ? `<div class="wb-card-sub">${escHtml(snap.subtitle)}</div>` : ''}
      ${snap.badge ? `<span class="wb-card-badge">${escHtml(snap.badge)} · ${escHtml(n.cardKind)}</span>` : ''}
    `
  } else if (n.type === 'shape') {
    cls.push('wb-shape')
    const fill = n.color || 'rgba(99,102,241,0.15)'
    const stroke = n.stroke || '#6366f1'
    const sw = 2
    let svg = ''
    if (n.shape === 'rect') {
      svg = `<rect x="${sw / 2}" y="${sw / 2}" width="${n.w - sw}" height="${n.h - sw}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
    } else if (n.shape === 'ellipse') {
      svg = `<ellipse cx="${n.w / 2}" cy="${n.h / 2}" rx="${n.w / 2 - sw}" ry="${n.h / 2 - sw}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
    } else if (n.shape === 'triangle') {
      svg = `<polygon points="${n.w / 2},${sw} ${n.w - sw},${n.h - sw} ${sw},${n.h - sw}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`
    }
    body = `<svg width="${n.w}" height="${n.h}" style="position:absolute;left:0;top:0;pointer-events:none">${svg}</svg>${n.text ? `<div class="wb-shape-text">${escHtml(n.text)}</div>` : ''}`
  } else if (n.type === 'pen') {
    cls.push('wb-pen')
    const stroke = n.color || '#1e293b'
    const sw = n.strokeWidth || 3
    body = `<svg width="${n.w}" height="${n.h}" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none"><path d="${n.path}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  } else if (n.type === 'image') {
    cls.push('wb-image')
    body = `<img src="${escAttr(n.src)}" alt="" style="width:100%;height:100%;object-fit:contain;display:block" draggable="false">`
  } else if (n.type === 'emoji') {
    cls.push('wb-emoji-node')
    // Scale the emoji glyph to fit the node size
    const fontSize = Math.min(n.w, n.h) * 0.85
    body = `<span class="emoji-glyph" style="font-size:${fontSize}px">${escHtml(n.emoji || '⭐')}</span>`
  }

  // 8 resize handles when selected (corners + edges)
  const handles = selected ? `
    <div class="wb-handle h-nw" data-handle="nw" data-id="${n.id}"></div>
    <div class="wb-handle h-n"  data-handle="n"  data-id="${n.id}"></div>
    <div class="wb-handle h-ne" data-handle="ne" data-id="${n.id}"></div>
    <div class="wb-handle h-w"  data-handle="w"  data-id="${n.id}"></div>
    <div class="wb-handle h-e"  data-handle="e"  data-id="${n.id}"></div>
    <div class="wb-handle h-sw" data-handle="sw" data-id="${n.id}"></div>
    <div class="wb-handle h-s"  data-handle="s"  data-id="${n.id}"></div>
    <div class="wb-handle h-se" data-handle="se" data-id="${n.id}"></div>
  ` : ''

  return `<div class="${cls.join(' ')}" data-id="${n.id}" data-type="${n.type}" style="${style}">
    ${voteBadge}${commentBadge}
    ${body}
    ${handles}
  </div>`
}

/** Inline markdown rendering using `marked` (loaded as window.marked). */
function renderMarkdown(text) {
  if (!text) return ''
  if (!window.marked) return escHtml(text).replace(/\n/g, '<br>')
  try {
    // Restricted: no raw HTML, autolinking, breaks on \n
    const html = window.marked.parse(text, { breaks: true, gfm: true })
    return sanitizeBasic(html)
  } catch {
    return escHtml(text)
  }
}

/** Strip dangerous tags; allow only inline-safe markup. */
function sanitizeBasic(html) {
  // Remove script/iframe/object/embed/style/on* attrs and javascript: URLs.
  return html
    .replace(/<\/?(script|iframe|object|embed|style|link|meta)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"')
}

function renderEdges() {
  const { connectors, nodes, guides } = getState()
  const map = new Map(nodes.map((n) => [n.id, n]))
  const parts = []
  const labels = []  // labels rendered AFTER paths so they sit on top
  for (const c of connectors) {
    let ax, ay, bx, by
    let aSide = 'auto', bSide = 'auto'  // 'left' | 'right' | 'top' | 'bottom'
    // Standalone connector (line tool): from/to may be points {x,y} stored as fromPoint/toPoint
    if (c.fromPoint && c.toPoint) {
      ax = c.fromPoint.x; ay = c.fromPoint.y
      bx = c.toPoint.x; by = c.toPoint.y
    } else {
      const a = map.get(c.from), b = map.get(c.to)
      if (!a || !b) continue
      const acx = a.x + a.w / 2, acy = a.y + a.h / 2
      const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2
      const fromAnchor = edgeAnchorWithSide(a, bcx, bcy)
      const toAnchor = edgeAnchorWithSide(b, acx, acy)
      ax = fromAnchor.x; ay = fromAnchor.y; aSide = fromAnchor.side
      bx = toAnchor.x; by = toAnchor.y; bSide = toAnchor.side
    }
    const kind = c.kind || 'related'
    const color = ARROW_PALETTE[kind] || '#64748b'
    const isLeadsTo = kind === 'leads-to'
    const isDependsOn = kind === 'depends-on'
    const dashAttr = isDependsOn ? 'stroke-dasharray="6,4"' : (isLeadsTo ? 'stroke-dasharray="6,4" class="wb-edge-flow"' : '')
    const id = c.id
    // Build smooth cubic bezier with control points perpendicular to anchor sides.
    // Distance scales with the path length so longer connectors have softer arcs.
    const dx = bx - ax, dy = by - ay
    const dist = Math.hypot(dx, dy) || 1
    const cpDist = Math.min(160, Math.max(40, dist * 0.4))
    const offsetA = sideOffset(aSide, cpDist, dx, dy)
    const offsetB = sideOffset(bSide, cpDist, -dx, -dy)
    const c1x = ax + offsetA.x, c1y = ay + offsetA.y
    const c2x = bx + offsetB.x, c2y = by + offsetB.y
    const d = c.fromPoint
      ? `M ${ax} ${ay} L ${bx} ${by}`
      : `M ${ax} ${ay} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${bx} ${by}`
    // Hit area (transparent thick path) for easier mouse interaction
    parts.push(`<path d="${d}" stroke="transparent" stroke-width="14" fill="none" data-edge="${id}" class="wb-edge-hit" pointer-events="stroke"></path>`)
    parts.push(`<path d="${d}" stroke="${color}" ${dashAttr} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" filter="url(#wb-edge-shadow)" data-edge="${id}" class="wb-edge" marker-end="url(#wb-arrow-${kind})"></path>`)
    if (c.label) {
      // Compute midpoint of bezier (t=0.5)
      const mx = c.fromPoint ? (ax + bx) / 2 : bezierMid(ax, c1x, c2x, bx)
      const my = c.fromPoint ? (ay + by) / 2 : bezierMid(ay, c1y, c2y, by)
      const labelText = escHtml(c.label)
      const padX = 6, padY = 3
      const charW = 6.5  // approx for 11px font
      const labelW = Math.max(20, labelText.length * charW + padX * 2)
      const labelH = 18
      labels.push(`
        <g class="wb-edge-label" transform="translate(${mx - labelW / 2}, ${my - labelH / 2})">
          <rect width="${labelW}" height="${labelH}" rx="4" fill="${color}" opacity="0.95"></rect>
          <text x="${labelW / 2}" y="${labelH / 2 + 4}" text-anchor="middle" fill="#fff" font-size="11" font-weight="600">${labelText}</text>
        </g>
      `)
    }
  }
  // Alignment guides (rendered as long pink lines)
  if (guides && guides.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h)
    }
    const padX = (maxX - minX || 800) + 200
    const padY = (maxY - minY || 600) + 200
    for (const g of guides) {
      if (g.x !== undefined) parts.push(`<line x1="${g.x}" y1="${minY - 100}" x2="${g.x}" y2="${minY + padY}" stroke="#ec4899" stroke-width="1" stroke-dasharray="4,3" pointer-events="none"></line>`)
      if (g.y !== undefined) parts.push(`<line x1="${minX - 100}" y1="${g.y}" x2="${minX + padX}" y2="${g.y}" stroke="#ec4899" stroke-width="1" stroke-dasharray="4,3" pointer-events="none"></line>`)
    }
  }
  $edges.innerHTML = `
    <defs>
      <filter id="wb-edge-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#0f172a" flood-opacity="0.18"></feDropShadow>
      </filter>
      ${Object.entries(ARROW_PALETTE).map(([k, v]) => `
        <marker id="wb-arrow-${k}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1.5 L 10 6 L 0 10.5 L 3 6 Z" fill="${v}"></path>
        </marker>
      `).join('')}
    </defs>
    ${parts.join('')}
    ${labels.join('')}
  `
}

/** Apply Prism highlighting after a render where new code nodes appeared. */
export function highlightCode() {
  if (!window.Prism) return
  document.querySelectorAll('.wb-code-body code').forEach((el) => {
    if (!el.dataset.highlighted) {
      window.Prism.highlightElement(el)
      el.dataset.highlighted = '1'
    }
  })
}

/** Helper: turn a sticky into edit mode. */
export function enterEditMode(id) {
  patchNode(id, { editing: true })
  // The state update schedules a render via rAF in main.js. We need to wait
  // for that render to commit the textarea to the DOM before focusing it.
  // Two nested rAFs guarantee we run AFTER the render frame, regardless of
  // listener ordering in the scheduler.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const ta = document.querySelector(`[data-edit-id="${id}"]`)
      if (ta) {
        ta.focus()
        ta.setSelectionRange(ta.value.length, ta.value.length)
      }
    })
  })
}

export function exitEditMode(id, newText) {
  patchNode(id, { editing: false, text: newText })
}
