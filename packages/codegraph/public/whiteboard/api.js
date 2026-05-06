// SkillBrain Whiteboard — API client
// Same-origin, uses session cookie. Throws on non-OK with server-provided detail.

async function req(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (res.status === 401) {
    window.location.href = '/login.html?return_to=' + encodeURIComponent(location.pathname + location.search)
    throw new Error('unauthorized')
  }
  if (!res.ok) {
    let detail = ''
    let body = null
    try {
      const text = await res.text()
      if (text) {
        try { body = JSON.parse(text); detail = body.error || text } catch { detail = text }
      }
    } catch {}
    const err = new Error(detail ? `${res.status} ${detail}` : `${res.status} ${res.statusText}`)
    err.status = res.status
    err.body = body
    throw err
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

export const api = {
  get:   (p)    => req(p),
  post:  (p, b) => req(p, { method: 'POST',   body: JSON.stringify(b ?? {}) }),
  put:   (p, b) => req(p, { method: 'PUT',    body: JSON.stringify(b ?? {}) }),
  patch: (p, b) => req(p, { method: 'PATCH',  body: JSON.stringify(b ?? {}) }),
  del:   (p)    => req(p, { method: 'DELETE' }),
}

// ── Whiteboard endpoints ──

export const wb = {
  list:    (params = {}) => api.get('/api/whiteboards' + qs(params)),
  create:  (data) => api.post('/api/whiteboards', data),
  read:    (id) => api.get('/api/whiteboards/' + encodeURIComponent(id)),
  save:    (id, data) => api.put('/api/whiteboards/' + encodeURIComponent(id), data),
  patch:   (id, data) => api.patch('/api/whiteboards/' + encodeURIComponent(id), data),
  remove:  (id) => api.del('/api/whiteboards/' + encodeURIComponent(id)),
  linkable:(params) => api.get('/api/whiteboards/linkable' + qs(params)),
  search:  (q) => api.get('/api/whiteboards/search' + qs({ q })),
  comments:{
    list:   (id, nodeId) => api.get(`/api/whiteboards/${encodeURIComponent(id)}/comments` + qs(nodeId ? { nodeId } : {})),
    add:    (id, data) => api.post(`/api/whiteboards/${encodeURIComponent(id)}/comments`, data),
    remove: (id, cid) => api.del(`/api/whiteboards/${encodeURIComponent(id)}/comments/${encodeURIComponent(cid)}`),
  },
  exportMemory: (id, data) => api.post(`/api/whiteboards/${encodeURIComponent(id)}/export-memory`, data),
  generate: {
    // Existing
    memoryCluster:    (data) => api.post('/api/whiteboards/generate/memory-cluster', data),
    sessionTimeline:  (data) => api.post('/api/whiteboards/generate/session-timeline', data),
    skillGraph:       ()     => api.post('/api/whiteboards/generate/skill-graph', {}),
    // Browse
    byType:           (data) => api.post('/api/whiteboards/generate/by-type', data),
    byProject:        (data) => api.post('/api/whiteboards/generate/by-project', data),
    bySkill:          (data) => api.post('/api/whiteboards/generate/by-skill', data),
    byAuthor:         (data) => api.post('/api/whiteboards/generate/by-author', data),
    // Time
    recentMemories:   (data) => api.post('/api/whiteboards/generate/recent-memories', data),
    mostUsedMemories: (data) => api.post('/api/whiteboards/generate/most-used-memories', data),
    // By type
    decisionsLog:     (data) => api.post('/api/whiteboards/generate/decisions-log', data),
    antipatterns:     (data) => api.post('/api/whiteboards/generate/antipatterns', data),
    openTodos:        (data) => api.post('/api/whiteboards/generate/open-todos', data),
    // Combined
    projectOverview:  (data) => api.post('/api/whiteboards/generate/project-overview', data),
    // AI / semantic
    semanticCluster:  (data) => api.post('/api/whiteboards/generate/semantic-cluster', data),
  },
  templates: {
    list: () => api.get('/api/whiteboards/templates'),
    get:  (id) => api.get('/api/whiteboards/templates/' + encodeURIComponent(id)),
  },
  authors:  (id) => api.get(`/api/whiteboards/${encodeURIComponent(id)}/authors`),
  myColor:  () => api.get('/api/whiteboards/me/color'),
  share:    (id) => api.post(`/api/whiteboards/${encodeURIComponent(id)}/share`, {}),
  unshare:  (id) => api.del(`/api/whiteboards/${encodeURIComponent(id)}/share`),
  readShared:(token) => api.get(`/api/whiteboards/shared/${encodeURIComponent(token)}`),
  // Phase E
  recent:   (limit = 5) => api.get('/api/whiteboards/recent' + qs({ limit })),
  tagsList: () => api.get('/api/whiteboards/tags'),
  pin:      (id) => api.post(`/api/whiteboards/${encodeURIComponent(id)}/pin`, {}),
  restore:  (id) => api.post(`/api/whiteboards/${encodeURIComponent(id)}/restore`, {}),
  duplicate:(id, data = {}) => api.post(`/api/whiteboards/${encodeURIComponent(id)}/duplicate`, data),
  moveBoard:(id, data) => api.post(`/api/whiteboards/${encodeURIComponent(id)}/move`, data),
  markOpened:(id) => api.post(`/api/whiteboards/${encodeURIComponent(id)}/opened`, {}),
  setMetadata:(id, data) => api.put(`/api/whiteboards/${encodeURIComponent(id)}/metadata`, data),
  bulk:     (ids, action) => api.post('/api/whiteboards/bulk', { ids, action }),
  snapshots:{
    list:    (id) => api.get(`/api/whiteboards/${encodeURIComponent(id)}/snapshots`),
    create:  (id) => api.post(`/api/whiteboards/${encodeURIComponent(id)}/snapshots`, {}),
    restore: (id, snapId) => api.post(`/api/whiteboards/${encodeURIComponent(id)}/restore-snapshot/${encodeURIComponent(snapId)}`, {}),
  },
  activity: (id) => api.get(`/api/whiteboards/${encodeURIComponent(id)}/activity`),
  notif:    {
    list:        (unread = false) => api.get('/api/me/notifications' + qs({ unread: unread ? '1' : '' })),
    markRead:    (id) => api.post(`/api/me/notifications/${encodeURIComponent(id)}/read`, {}),
    markAllRead: () => api.post('/api/me/notifications/mark-all-read', {}),
  },
  presence: {
    heartbeat: (id) => api.post(`/api/whiteboards/${encodeURIComponent(id)}/heartbeat`, {}),
    list:      (id) => api.get(`/api/whiteboards/${encodeURIComponent(id)}/presence`),
  },
}

function qs(obj) {
  const e = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!e.length) return ''
  return '?' + e.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&')
}
