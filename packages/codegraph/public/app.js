// SkillBrain Hub — SPA orchestrator
// Routing, event listeners, and init only. All rendering is in js/render.js.
// All modal logic is in js/modal.js. All fetch logic is in js/api.js.

import { api } from './js/api.js'
import {
  openEditProjectModal, closeEditModal, saveProject,
  editField, editSelect, memberRow,
  showMergeDialog, closeMergeModal, confirmMerge,
} from './js/modal.js'
import {
  renderHome, renderSkills, searchSkills, openSkillDetail,
  renderMemories, searchMemories, openMemoryDetail,
  renderSessions, renderProjects, renderProjectDetail,
  renderProjectTab, loadEnvVars, searchGlobal, renderWorkLog,
  renderComponents, openComponentDetail,
  renderDesignSystems, openDesignSystemDetail, renderScanReview,
  escHtml,
} from './js/render.js'

const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]

// ── State ──
let currentPage = 'home'

// ── Router ──
function route() {
  const hash = location.hash.slice(1) || '/'
  const page = hash.split('/')[1] || 'home'
  currentPage = page

  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page))

  const searchEl = $('#global-search')
  searchEl.value = ''
  searchEl.placeholder = page === 'skills' ? 'Search skills...'
    : page === 'memories' ? 'Search memories...'
    : 'Search skills and memories...'

  switch (page) {
    case 'projects': renderProjects(); break
    case 'worklog': renderWorkLog(); break
    case 'skills': renderSkills(); break
    case 'memories': renderMemories(); break
    case 'sessions': renderSessions(); break
    case 'components': renderComponents(); break
    case 'design-systems': renderDesignSystems(); break
    case 'team': renderTeam(); break
    default: renderHome()
  }
}

window.addEventListener('hashchange', route)

// ── Search ──
let searchTimeout
$('#global-search')?.addEventListener('input', (e) => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    const q = e.target.value.trim()
    if (!q) { route(); return }
    if (currentPage === 'skills') searchSkills(q)
    else if (currentPage === 'memories') searchMemories(q)
    else searchGlobal(q)
  }, 300)
})

// ── Detail Panel ──
$('#detail-close')?.addEventListener('click', closeDetail)

function openDetail(title, html) {
  $('#detail-title').textContent = title
  $('#detail-content').innerHTML = html
  $('#detail-panel').classList.remove('hidden')
}

function closeDetail() {
  $('#detail-panel').classList.add('hidden')
}

// ── Project detail ──
async function openProjectDetail(name) {
  await renderProjectDetail(name, openDetail)
}

function switchProjectTab(tab, name) {
  document.querySelectorAll('.proj-tab').forEach(b => {
    const active = b.dataset.tab === tab
    b.style.color = active ? 'var(--accent)' : 'var(--text-muted)'
    b.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent'
    b.classList.toggle('active', active)
  })
  renderProjectTab(tab, name)
}

// ── Memory actions ──
async function deleteMemory(id) {
  if (!confirm('Delete this memory permanently?')) return
  const r = await fetch(`/api/memories/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (r.ok) { closeDetail(); route() }
  else alert('Delete failed')
}

async function deprecateMemory(id) {
  const r = await fetch(`/api/memories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'deprecated' }),
  })
  if (r.ok) { closeDetail(); route() }
  else alert('Update failed')
}

// ── Session actions ──
async function cleanupDuplicates() {
  if (!confirm('Delete duplicate in-progress sessions (keeps most recent per project)?')) return
  const r = await fetch('/api/sessions/cleanup-duplicates', { method: 'POST' })
  const d = await r.json()
  alert(`Deleted ${d.deleted || 0} duplicate sessions`)
  renderSessions()
}

async function deleteSession(id) {
  if (!confirm('Delete this session?')) return
  const r = await fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (r.ok) renderSessions()
  else alert('Delete failed')
}

// ── Env Var actions ──
async function revealEnv(project, varName) {
  const r = await fetch(`/api/projects-meta/${encodeURIComponent(project)}/env/reveal`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ varName }),
  })
  if (!r.ok) { alert('Failed'); return }
  const { value } = await r.json()
  prompt(`${varName} (copy below):`, value)
}

async function exportEnv(project) {
  const r = await fetch(`/api/projects-meta/${encodeURIComponent(project)}/env/export`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  })
  if (!r.ok) { alert('Failed'); return }
  const { content, count } = await r.json()
  try {
    await navigator.clipboard.writeText(content)
    alert(`Copied ${count} env vars to clipboard`)
  } catch {
    prompt(`.env content (${count} vars):`, content)
  }
}

async function importEnv(project) {
  const content = prompt('Paste .env content:')
  if (!content) return
  const r = await fetch(`/api/projects-meta/${encodeURIComponent(project)}/env/import`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ envContent: content }),
  })
  const { saved } = await r.json()
  alert(`Saved ${saved} env vars`)
  loadEnvVars(project)
}

async function deleteEnv(project, varName) {
  if (!confirm(`Delete ${varName}?`)) return
  await fetch(`/api/projects-meta/${encodeURIComponent(project)}/env/${encodeURIComponent(varName)}`, { method: 'DELETE' })
  loadEnvVars(project)
}

// ── Team member helper (used by modal.js — exposed globally for onclick) ──
function addMemberRow() {
  const list = document.getElementById('team-members-list')
  const div = document.createElement('div')
  div.innerHTML = memberRow({}, list.children.length)
  list.appendChild(div.firstElementChild)
}

// ── Expose globals needed by inline onclick handlers ──
window.renderSkills = renderSkills
window.renderMemories = renderMemories
window.openSkillDetail = (name) => openSkillDetail(name, openDetail)
window.openMemoryDetail = (id) => openMemoryDetail(id, openDetail)
window.openProjectDetail = openProjectDetail
window.renderProjects = renderProjects
window.switchProjectTab = switchProjectTab
window.openEditProjectModal = openEditProjectModal
window.closeEditModal = closeEditModal
window.saveProject = saveProject
window.showMergeDialog = showMergeDialog
window.closeMergeModal = closeMergeModal
window.confirmMerge = confirmMerge
window.addMemberRow = addMemberRow
window.deleteMemory = deleteMemory
window.deprecateMemory = deprecateMemory
window.cleanupDuplicates = cleanupDuplicates
window.deleteSession = deleteSession
window.loadEnvVars = loadEnvVars
window.revealEnv = revealEnv
window.exportEnv = exportEnv
window.importEnv = importEnv
window.deleteEnv = deleteEnv
window.renderComponents = renderComponents
window.openComponentDetail = (id) => openComponentDetail(id, openDetail)
window.renderDesignSystems = renderDesignSystems
window.openDesignSystemDetail = (project) => openDesignSystemDetail(project, openDetail)
window.reviewScan = (project, scanId) => renderScanReview(project, scanId, openDetail)
window.applyScan = async (project, scanId) => {
  const res = await fetch(`/api/design-systems/${encodeURIComponent(project)}/apply-scan`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scanId, resolved: {} }),
  })
  if (res.ok) { closeDetail(); renderDesignSystems() }
  else alert('Apply failed')
}
window.dismissScan = async (scanId) => {
  if (!confirm('Dismiss this scan? The tokens won\'t be saved.')) return
  await fetch(`/api/design-systems/scans/${scanId}`, { method: 'DELETE' })
  renderDesignSystems()
}

// ── Team page ──
async function renderTeam() {
  const page = $('#page')
  page.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div class="section-title" style="margin:0">Team</div>
      <button id="btn-add-member" class="btn-primary">+ Add Member</button>
    </div>
    <div id="team-list"></div>`

  document.getElementById('btn-add-member').addEventListener('click', () => {
    document.getElementById('input-member-name').value = ''
    document.getElementById('input-member-email').value = ''
    document.getElementById('input-key-label').value = ''
    document.getElementById('modal-add-member').showModal()
  })

  await loadTeamList()
}

async function loadTeamList() {
  const res = await fetch('/api/admin/team')
  const { users } = await res.json()
  const el = document.getElementById('team-list')
  if (!el) return

  if (!users || users.length === 0) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No team members yet. Click "+ Add Member" to invite someone.</p>'
    return
  }

  el.innerHTML = users.map(u => {
    const keys = JSON.parse(u.keys || '[]').filter(k => k.id)
    const initials = u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    const roleBadge = u.role === 'admin' ? 'badge-decision' : 'badge-pattern'
    return `<div class="card member-card">
      <div class="member-header">
        <div class="member-avatar">${initials}</div>
        <div style="flex:1">
          <div class="member-name">${escHtml(u.name)}</div>
          ${u.email ? `<div class="member-email">${escHtml(u.email)}</div>` : ''}
        </div>
        <span class="badge ${roleBadge}">${u.role}</span>
      </div>
      ${keys.length === 0
        ? '<p style="color:var(--text-muted);font-size:12px;margin:0">No active keys</p>'
        : keys.map(k => `
          <div class="key-row${k.revoked ? ' revoked' : ''}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:.4;flex-shrink:0"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
            <span class="key-label">${escHtml(k.label)}</span>
            <span class="key-meta">last used: ${k.last_used_at ? k.last_used_at.slice(0, 10) : 'never'}</span>
            ${!k.revoked
              ? `<button class="btn-danger" onclick="revokeKey('${k.id}')">Revoke</button>`
              : '<span style="font-size:11px;color:var(--text-muted)">(revoked)</span>'}
          </div>`).join('')}
    </div>`
  }).join('')
}

async function revokeKey(id) {
  if (!confirm('Revoke this key? This cannot be undone.')) return
  await fetch(`/api/admin/team/keys/${id}`, { method: 'DELETE' })
  await loadTeamList()
}

document.getElementById('btn-cancel-member')?.addEventListener('click', () => {
  document.getElementById('modal-add-member').close()
})

document.getElementById('btn-create-member')?.addEventListener('click', async () => {
  const name = document.getElementById('input-member-name').value.trim()
  const email = document.getElementById('input-member-email').value.trim()
  const label = document.getElementById('input-key-label').value.trim()
  if (!name) { alert('Name is required'); return }

  const res = await fetch('/api/admin/team/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email: email || undefined, label: label || undefined }),
  })
  const { key } = await res.json()

  document.getElementById('modal-add-member').close()
  document.getElementById('new-key-value').textContent = key
  document.getElementById('connection-snippet').textContent =
    `SKILLBRAIN_MCP_URL=https://memory.fl1.it/mcp\nCODEGRAPH_AUTH_TOKEN=${key}`
  document.getElementById('modal-show-key').showModal()
  await loadTeamList()
})

document.getElementById('btn-copy-key')?.addEventListener('click', async () => {
  const key = document.getElementById('new-key-value').textContent
  try { await navigator.clipboard.writeText(key) } catch { prompt('Copy this key:', key) }
})

document.getElementById('btn-close-key-modal')?.addEventListener('click', () => {
  document.getElementById('modal-show-key').close()
})

window.revokeKey = revokeKey

// ── Init ──
route()
