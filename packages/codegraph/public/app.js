// SkillBrain Hub — SPA orchestrator
// Routing, event listeners, and init only. All rendering is in js/render.js.
// All modal logic is in js/modal.js. All fetch logic is in js/api.js.

import { api } from './js/api.js'
import {
  openEditProjectModal, closeEditModal, saveProject,
  editField, editSelect, memberRow,
} from './js/modal.js'
import {
  renderHome, renderSkills, searchSkills, openSkillDetail,
  renderMemories, searchMemories, openMemoryDetail,
  renderSessions, renderProjects, renderProjectDetail,
  renderProjectTab, loadEnvVars, searchGlobal, renderWorkLog,
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

// ── Init ──
route()
