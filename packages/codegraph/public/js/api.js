// SkillBrain Hub — API client module
// All fetch calls go through here. Same-origin, no auth header needed beyond credentials.

const API = '' // same-origin

async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (res.status === 401) {
    window.location.href = '/login.html'
    throw new Error('unauthorized')
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.headers.get('content-type')?.includes('application/json') ? res.json() : res.text()
}

export const api = {
  get:  (path)        => req(path),
  post: (path, body)  => req(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:  (path, body)  => req(path, { method: 'PUT',    body: JSON.stringify(body) }),
  del:  (path)        => req(path, { method: 'DELETE' }),
}
