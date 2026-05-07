// Synapse Whiteboard — state management
// Single source of truth for board state. UI re-reads from here on render.
// `nodes` and `connectors` mirror the JSON persisted on the server.

const listeners = new Set()
let _state = {
  id: null,
  name: 'Untitled',
  scope: 'team',
  projectName: null,
  createdBy: '',
  stateVersion: 1,
  votePool: 5,
  nodes: [],
  connectors: [],
  viewport: { x: 0, y: 0, zoom: 1 },

  // ── Client-only ──
  selection: new Set(),
  tool: 'select',
  voting: false,
  votesUsed: 0,
  matches: [],          // search results (node ids)
  authors: [],          // [{ email, color }]
  myEmail: '',
  myColor: '#fde68a',
  myName: '',
  guides: [],           // alignment guide lines while dragging: [{x?, y?}]
  snapEnabled: true,
}

// ── Undo/Redo history ──
// Snapshots store only the persistent shape ({nodes, connectors}) — not selection
// or transient UI. Cap at 50 to bound memory.
const HISTORY_CAP = 50
let _history = []
let _historyIdx = -1
let _suppressHistory = false

function snapshot() {
  return JSON.stringify({ nodes: _state.nodes, connectors: _state.connectors })
}
function pushHistory() {
  if (_suppressHistory) return
  // Drop any "future" if user undid then made a new change
  if (_historyIdx < _history.length - 1) _history = _history.slice(0, _historyIdx + 1)
  _history.push(snapshot())
  if (_history.length > HISTORY_CAP) _history.shift()
  _historyIdx = _history.length - 1
}
export function initHistory() {
  _history = [snapshot()]
  _historyIdx = 0
}
export function undo() {
  if (_historyIdx <= 0) return false
  _historyIdx--
  applySnapshot(_history[_historyIdx])
  return true
}
export function redo() {
  if (_historyIdx >= _history.length - 1) return false
  _historyIdx++
  applySnapshot(_history[_historyIdx])
  return true
}
function applySnapshot(json) {
  _suppressHistory = true
  try {
    const parsed = JSON.parse(json)
    update({ nodes: parsed.nodes || [], connectors: parsed.connectors || [], selection: new Set() })
  } finally {
    _suppressHistory = false
  }
}

// ── In-memory clipboard ──
let _clipboard = []
export function copySelection() {
  const ids = [..._state.selection]
  if (!ids.length) return 0
  _clipboard = ids.map((id) => _state.nodes.find((n) => n.id === id)).filter(Boolean).map((n) => ({ ...n }))
  return _clipboard.length
}
export function pasteClipboard(offset = 30) {
  if (!_clipboard.length) return []
  const idMap = {}
  const newNodes = _clipboard.map((n) => {
    const newId = nid(n.type)
    idMap[n.id] = newId
    return { ...n, id: newId, x: (n.x ?? 0) + offset, y: (n.y ?? 0) + offset, votes: undefined, commentCount: 0 }
  })
  const newConnectors = []
  // If both endpoints of a clipboard connector are also in the clipboard, copy it
  for (const c of _state.connectors) {
    if (idMap[c.from] && idMap[c.to]) {
      newConnectors.push({ ...c, id: nid('conn'), from: idMap[c.from], to: idMap[c.to] })
    }
  }
  const updated = [..._state.nodes, ...newNodes]
  const updatedConn = [..._state.connectors, ...newConnectors]
  update({ nodes: updated, connectors: updatedConn, selection: new Set(newNodes.map((n) => n.id)) })
  pushHistory()
  return newNodes.map((n) => n.id)
}

// ── Z-order ──
export function bringToFront(ids) {
  const set = new Set(ids)
  const front = _state.nodes.filter((n) => !set.has(n.id))
  const moved = _state.nodes.filter((n) => set.has(n.id))
  update({ nodes: [...front, ...moved] })
  pushHistory()
}
export function sendToBack(ids) {
  const set = new Set(ids)
  const back = _state.nodes.filter((n) => !set.has(n.id))
  const moved = _state.nodes.filter((n) => set.has(n.id))
  update({ nodes: [...moved, ...back] })
  pushHistory()
}
export function bringForward(ids) {
  const arr = [..._state.nodes]
  const set = new Set(ids)
  for (let i = arr.length - 2; i >= 0; i--) {
    if (set.has(arr[i].id) && !set.has(arr[i + 1].id)) {
      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
    }
  }
  update({ nodes: arr })
  pushHistory()
}
export function sendBackward(ids) {
  const arr = [..._state.nodes]
  const set = new Set(ids)
  for (let i = 1; i < arr.length; i++) {
    if (set.has(arr[i].id) && !set.has(arr[i - 1].id)) {
      [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]
    }
  }
  update({ nodes: arr })
  pushHistory()
}

// ── Mutations that should record history ──
// Call commitHistory() after a logical action completes (e.g. drag end).
export function commitHistory() { pushHistory() }
export function suppressHistory(fn) {
  _suppressHistory = true
  try { fn() } finally { _suppressHistory = false }
}

export function getState() { return _state }

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function update(patch) {
  _state = { ...(_state), ...(typeof patch === 'function' ? patch(_state) : patch) }
  for (const fn of listeners) fn(_state)
}

export function patchNode(id, patch) {
  const idx = _state.nodes.findIndex((n) => n.id === id)
  if (idx < 0) return
  const nodes = [..._state.nodes]
  nodes[idx] = { ...nodes[idx], ...(typeof patch === 'function' ? patch(nodes[idx]) : patch) }
  update({ nodes })
}

export function addNode(node) {
  update({ nodes: [..._state.nodes, node] })
}

export function removeNodes(ids) {
  const set = new Set(ids)
  update({
    nodes: _state.nodes.filter((n) => !set.has(n.id)),
    connectors: _state.connectors.filter((c) => !set.has(c.from) && !set.has(c.to)),
    selection: new Set(),
  })
}

export function addConnector(c) {
  update({ connectors: [..._state.connectors, c] })
}

export function removeConnector(id) {
  update({ connectors: _state.connectors.filter((c) => c.id !== id) })
}

export function patchConnector(id, patch) {
  const idx = _state.connectors.findIndex((c) => c.id === id)
  if (idx < 0) return
  const connectors = [..._state.connectors]
  connectors[idx] = { ...connectors[idx], ...patch }
  update({ connectors })
}

/** Random short id for new nodes/connectors. */
export function nid(prefix = 'n') {
  return prefix + '-' + Math.random().toString(36).slice(2, 8)
}

/** Serialize the persistable parts of the state. */
export function serialize() {
  return JSON.stringify({
    nodes: _state.nodes,
    connectors: _state.connectors,
    viewport: _state.viewport,
  })
}

/** Hydrate from server response (board + parsed state_json). */
export function hydrate(board) {
  let parsed = { nodes: [], connectors: [], viewport: { x: 0, y: 0, zoom: 1 } }
  try { parsed = { ...parsed, ...(JSON.parse(board.stateJson) || {}) } } catch {}
  update({
    id: board.id,
    name: board.name,
    scope: board.scope,
    projectName: board.projectName,
    createdBy: board.createdBy,
    stateVersion: board.stateVersion,
    votePool: board.votePool,
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    connectors: Array.isArray(parsed.connectors) ? parsed.connectors : [],
    viewport: parsed.viewport || { x: 0, y: 0, zoom: 1 },
    selection: new Set(),
    voting: false,
    votesUsed: 0,
    matches: [],
  })
}
