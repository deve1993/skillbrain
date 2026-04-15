// SkillBrain Hub — Client-side SPA

const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]
const API = ''

// ── State ──
let currentPage = 'home'
let skillsCache = null
let memoriesCache = null

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

// ── Helpers ──
function formatUptime(s) {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s/60)}m`
  const h = Math.floor(s/3600)
  const m = Math.floor((s%3600)/60)
  return `${h}h ${m}m`
}

function badge(type) {
  const cls = `badge-${type.toLowerCase().replace(/\s/g,'')}`
  return `<span class="badge ${cls}">${type}</span>`
}

function confBar(val) {
  const pct = val * 10
  const cls = val >= 7 ? 'conf-high' : val >= 4 ? 'conf-mid' : 'conf-low'
  return `<div class="conf-bar"><div class="conf-track"><div class="conf-fill ${cls}" style="width:${pct}%"></div></div><span>${val}</span></div>`
}

function tagsHtml(tags) {
  if (!tags?.length) return ''
  return `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
}

function escHtml(s) {
  return s?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || ''
}

function simpleMarkdown(md) {
  return escHtml(md)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/\|(.+)\|/g, (m) => {
      const cells = m.split('|').filter(c => c.trim())
      return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>'
    })
}

// ── HOME ──
async function renderHome() {
  const [health, data] = await Promise.all([
    fetch(`${API}/api/health`).then(r => r.json()),
    fetch(`${API}/api/data`).then(r => r.json()),
  ])

  let skillTotal = 0
  try {
    const sr = await fetch(`${API}/api/skills?limit=1`).then(r => r.json())
    skillTotal = sr.total || 0
  } catch {}

  const mg = data.memoryGraph || {}
  const sessions = mg.recentSessions || []

  $('#page').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val">${health.memories || 0}</div><div class="stat-label">Memories</div></div>
      <div class="stat-card"><div class="stat-val">${skillTotal}</div><div class="stat-label">Skills</div></div>
      <div class="stat-card"><div class="stat-val">${health.memoryEdges || 0}</div><div class="stat-label">Edges</div></div>
      <div class="stat-card"><div class="stat-val">${health.activeSessions || 0}</div><div class="stat-label">MCP Sessions</div></div>
      <div class="stat-card"><div class="stat-val">${formatUptime(health.uptime || 0)}</div><div class="stat-label">Uptime</div></div>
      <div class="stat-card"><div class="stat-val">${health.repos || 0}</div><div class="stat-label">Repos</div></div>
    </div>

    <div class="card">
      <div class="card-title">Memory Graph <span class="count">${health.memories} active</span></div>
      ${Object.entries(mg.byType || {}).map(([t, c]) => `
        <div class="row">
          <span class="row-label">${badge(t)} ${t}</span>
          <span class="row-val">${c}</span>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <div class="card-title">Recent Memories <span class="count">top 5</span></div>
      ${(mg.topMemories || []).slice(0, 5).map(m => `
        <div class="row" onclick="openMemoryDetail('${m.id}')">
          <span class="row-label">${badge(m.type)} ${m.context?.slice(0, 80) || ''}</span>
          <span class="row-val">${confBar(m.confidence)}</span>
        </div>
      `).join('')}
    </div>

    ${sessions.length ? `
    <div class="card">
      <div class="card-title">Recent Sessions <span class="count">${sessions.length}</span></div>
      ${sessions.map(s => `
        <div class="row">
          <span class="row-label"><strong>${s.session}</strong> &mdash; ${s.summary || 'no summary'}</span>
          <span class="row-val" style="font-size:11px;color:var(--text-muted)">${s.started?.split('T')[0] || ''}</span>
        </div>
      `).join('')}
    </div>` : ''}
  `

  $('#server-status').textContent = `${formatUptime(health.uptime)} uptime`
}

// ── SKILLS ──
async function renderSkills(typeFilter) {
  const url = typeFilter ? `${API}/api/skills?type=${typeFilter}` : `${API}/api/skills`
  const data = await fetch(url).then(r => r.json())
  skillsCache = data.skills || []

  const types = ['domain', 'agent', 'command', 'lifecycle', 'process']
  const categories = [...new Set(skillsCache.map(s => s.category))].sort()

  $('#page').innerHTML = `
    <div class="section-title">Skills Browser <span class="count" style="font-size:12px;font-weight:400;color:var(--text-muted)">${data.total} total</span></div>

    <div class="filters">
      <button class="filter-btn ${!typeFilter ? 'active' : ''}" onclick="renderSkills()">All</button>
      ${types.map(t => `<button class="filter-btn ${typeFilter === t ? 'active' : ''}" onclick="renderSkills('${t}')">${t}</button>`).join('')}
    </div>

    <div class="item-list">
      ${skillsCache.map(s => `
        <div class="item" onclick="openSkillDetail('${s.name}')">
          <div class="item-header">
            <span class="item-name">${badge(s.type)} ${s.name}</span>
            <span class="item-meta">${s.lines} lines &middot; ${s.category}</span>
          </div>
          <div class="item-desc">${escHtml(s.description)}</div>
          ${tagsHtml(s.tags)}
        </div>
      `).join('')}
    </div>
  `
}

async function searchSkills(q) {
  const data = await fetch(`${API}/api/skills?search=${encodeURIComponent(q)}`).then(r => r.json())
  const skills = data.skills || []

  $('#page').innerHTML = `
    <div class="section-title">Search: "${q}" <span class="count">${skills.length} results</span></div>
    <div class="item-list">
      ${skills.map(s => `
        <div class="item" onclick="openSkillDetail('${s.name}')">
          <div class="item-header">
            <span class="item-name">${badge(s.type)} ${s.name}</span>
            <span class="item-meta">${s.lines} lines</span>
          </div>
          <div class="item-desc">${escHtml(s.description)}</div>
        </div>
      `).join('')}
    </div>
  `
}

async function openSkillDetail(name) {
  const skill = await fetch(`${API}/api/skills/${encodeURIComponent(name)}`).then(r => r.json())
  if (skill.error) { openDetail(name, `<p style="color:var(--red)">${skill.error}</p>`); return }

  openDetail(skill.name, `
    <div style="margin-bottom:12px">
      ${badge(skill.type)} <span style="color:var(--text-muted)">${skill.category} &middot; ${skill.lines} lines</span>
    </div>
    ${tagsHtml(skill.tags)}
    <div style="margin-top:16px">${simpleMarkdown(skill.content)}</div>
  `)
}

// ── MEMORIES ──
async function renderMemories(typeFilter) {
  const url = typeFilter ? `${API}/api/memories?type=${typeFilter}` : `${API}/api/memories`
  const data = await fetch(url).then(r => r.json())
  memoriesCache = data.memories || []

  const types = ['Pattern', 'BugFix', 'AntiPattern', 'Fact', 'Decision', 'Preference', 'Goal', 'Todo']

  $('#page').innerHTML = `
    <div class="section-title">Memory Explorer <span class="count" style="font-size:12px;font-weight:400;color:var(--text-muted)">${data.total} total</span></div>

    <div class="filters">
      <button class="filter-btn ${!typeFilter ? 'active' : ''}" onclick="renderMemories()">All</button>
      ${types.map(t => `<button class="filter-btn ${typeFilter === t ? 'active' : ''}" onclick="renderMemories('${t}')">${t}</button>`).join('')}
    </div>

    <div class="item-list">
      ${memoriesCache.map(m => `
        <div class="item" onclick="openMemoryDetail('${m.id}')">
          <div class="item-header">
            <span class="item-name">${badge(m.type)} ${m.id}</span>
            <span class="item-meta">${confBar(m.confidence)}</span>
          </div>
          <div class="item-desc">${escHtml(m.context)}</div>
          <div style="margin-top:4px;font-size:11px;color:var(--text-muted)">${m.skill || ''}</div>
          ${tagsHtml(m.tags)}
        </div>
      `).join('')}
    </div>
  `
}

async function searchMemories(q) {
  const data = await fetch(`${API}/api/memories?search=${encodeURIComponent(q)}`).then(r => r.json())
  const memories = data.memories || []

  $('#page').innerHTML = `
    <div class="section-title">Search: "${q}" <span class="count">${memories.length} results</span></div>
    <div class="item-list">
      ${memories.map(m => `
        <div class="item" onclick="openMemoryDetail('${m.id}')">
          <div class="item-header">
            <span class="item-name">${badge(m.type)} ${m.id}</span>
            <span class="item-meta">${confBar(m.confidence)}</span>
          </div>
          <div class="item-desc">${escHtml(m.context)}</div>
        </div>
      `).join('')}
    </div>
  `
}

async function openMemoryDetail(id) {
  const m = await fetch(`${API}/api/memories/${encodeURIComponent(id)}`).then(r => r.json())
  if (m.error) { openDetail(id, `<p style="color:var(--red)">${m.error}</p>`); return }

  const edges = m.edges || []

  openDetail(m.id, `
    <div style="margin-bottom:12px">
      ${badge(m.type)} ${confBar(m.confidence)}
      <span style="color:var(--text-muted);font-size:11px;margin-left:8px">${m.skill || ''} &middot; ${m.scope}</span>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="card-title">Context</div>
      <p>${escHtml(m.context)}</p>
    </div>

    <div class="card">
      <div class="card-title">Problem</div>
      <p>${escHtml(m.problem)}</p>
    </div>

    <div class="card">
      <div class="card-title">Solution</div>
      <p>${escHtml(m.solution)}</p>
    </div>

    <div class="card">
      <div class="card-title">Reason</div>
      <p>${escHtml(m.reason)}</p>
    </div>

    ${tagsHtml(m.tags)}

    ${edges.length ? `
    <div class="card" style="margin-top:12px">
      <div class="card-title">Edges <span class="count">${edges.length}</span></div>
      ${edges.map(e => `
        <div class="row">
          <span class="row-label">${badge(e.type)} ${e.sourceId === m.id ? e.targetId : e.sourceId}</span>
          <span class="row-val" style="font-size:11px">${e.reason || ''}</span>
        </div>
      `).join('')}
    </div>` : ''}

    <div style="margin-top:12px;font-size:11px;color:var(--text-muted)">
      Created: ${m.createdAt?.split('T')[0] || '?'} &middot;
      Updated: ${m.updatedAt?.split('T')[0] || '?'} &middot;
      Sessions since validation: ${m.sessionsSinceValidation || 0}
    </div>
  `)
}

// ── SESSIONS ──
async function renderSessions() {
  const data = await fetch(`${API}/api/sessions`).then(r => r.json())
  const sessions = data.sessions || []

  $('#page').innerHTML = `
    <div class="section-title">Session History <span class="count" style="font-size:12px;font-weight:400;color:var(--text-muted)">${sessions.length} sessions</span></div>

    ${sessions.length === 0 ? '<p style="color:var(--text-muted);font-size:13px">No sessions recorded yet. Sessions are logged when using session_start/session_end MCP tools.</p>' : ''}

    <div class="timeline">
      ${sessions.map(s => `
        <div class="timeline-item">
          <div class="timeline-name">${s.sessionName}</div>
          <div class="timeline-date">${s.startedAt?.replace('T',' ').slice(0,16) || '?'}${s.endedAt ? ' — ' + s.endedAt.replace('T',' ').slice(11,16) : ' (running)'}</div>
          <div class="timeline-summary">${s.summary || 'No summary'}</div>
          <div class="timeline-stats">+${s.memoriesCreated || 0} memories &middot; ${s.memoriesValidated || 0} validated${s.project ? ' &middot; ' + s.project : ''}</div>
        </div>
      `).join('')}
    </div>
  `
}

// ── GLOBAL SEARCH ──
async function searchGlobal(q) {
  const [skills, memories] = await Promise.all([
    fetch(`${API}/api/skills?search=${encodeURIComponent(q)}&limit=5`).then(r => r.json()),
    fetch(`${API}/api/memories?search=${encodeURIComponent(q)}&limit=5`).then(r => r.json()),
  ])

  $('#page').innerHTML = `
    <div class="section-title">Search: "${q}"</div>

    ${(skills.skills || []).length ? `
    <div class="card">
      <div class="card-title">Skills <span class="count">${skills.skills.length}</span></div>
      ${skills.skills.map(s => `
        <div class="row" onclick="location.hash='#/skills'; setTimeout(() => openSkillDetail('${s.name}'), 100)">
          <span class="row-label">${badge(s.type)} ${s.name}</span>
          <span class="row-val" style="font-size:11px">${s.category}</span>
        </div>
      `).join('')}
    </div>` : ''}

    ${(memories.memories || []).length ? `
    <div class="card">
      <div class="card-title">Memories <span class="count">${memories.memories.length}</span></div>
      ${memories.memories.map(m => `
        <div class="row" onclick="location.hash='#/memories'; setTimeout(() => openMemoryDetail('${m.id}'), 100)">
          <span class="row-label">${badge(m.type)} ${(m.context || '').slice(0, 80)}</span>
          <span class="row-val">${confBar(m.confidence)}</span>
        </div>
      `).join('')}
    </div>` : ''}

    ${!(skills.skills || []).length && !(memories.memories || []).length ? '<p style="color:var(--text-muted)">No results found.</p>' : ''}
  `
}

// ── PROJECTS ──
async function renderProjects() {
  const data = await fetch(`${API}/api/projects`).then(r => r.json())
  const projects = data.projects || []

  const statusColors = {
    'in-progress': 'var(--blue)', 'completed': 'var(--green)',
    'paused': 'var(--yellow)', 'blocked': 'var(--red)', 'unknown': 'var(--text-muted)'
  }

  $('#page').innerHTML = `
    <div class="section-title">Projects <span class="count" style="font-size:12px;font-weight:400;color:var(--text-muted)">${projects.length} projects</span></div>

    ${projects.length === 0 ? '<p style="color:var(--text-muted);font-size:13px">No projects yet. Projects are auto-created when you use <code>session_start</code> with a project name.</p>' : ''}

    <div class="item-list">
      ${projects.map(p => {
        const status = p.lastSession?.status || 'unknown'
        const statusColor = statusColors[status] || 'var(--text-muted)'
        const date = p.lastSession?.date?.split('T')[0] || 'never'
        return `
        <div class="item" onclick="openProjectDetail('${p.name}')">
          <div class="item-header">
            <span class="item-name">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:8px"></span>
              ${p.name}
            </span>
            <span class="item-meta">${p.totalSessions} sessions &middot; ${p.totalMemories} memories</span>
          </div>
          <div style="display:flex;gap:16px;margin-top:6px;font-size:12px">
            <span style="color:var(--text-muted)">Status: <strong style="color:${statusColor}">${status}</strong></span>
            <span style="color:var(--text-muted)">Last: ${date}</span>
            ${p.lastBranch ? `<span style="color:var(--text-muted)">Branch: <code>${p.lastBranch}</code></span>` : ''}
          </div>
          ${p.lastSession?.task ? `<div class="item-desc" style="margin-top:4px">Task: ${escHtml(p.lastSession.task)}</div>` : ''}
          ${p.lastSession?.nextSteps ? `<div style="margin-top:4px;font-size:12px;color:var(--green)">Next: ${escHtml(p.lastSession.nextSteps)}</div>` : ''}
          ${p.blockers ? `<div style="margin-top:4px;font-size:12px;color:var(--red)">Blocker: ${escHtml(p.blockers)}</div>` : ''}
          ${Object.keys(p.memoriesByType || {}).length ? `
            <div class="tags" style="margin-top:6px">
              ${Object.entries(p.memoriesByType).map(([t,c]) => `<span class="tag">${t}: ${c}</span>`).join('')}
            </div>
          ` : ''}
        </div>`
      }).join('')}
    </div>
  `
}

async function openProjectDetail(name) {
  const data = await fetch(`${API}/api/projects/${encodeURIComponent(name)}`).then(r => r.json())
  if (data.error) { openDetail(name, `<p style="color:var(--red)">${data.error}</p>`); return }

  const sessions = data.sessions || []
  const memories = data.memories || []
  const last = sessions[0]

  let html = ''

  // Status header
  if (last) {
    const statusColors = {'in-progress':'var(--blue)','completed':'var(--green)','paused':'var(--yellow)','blocked':'var(--red)'}
    const sc = statusColors[last.status] || 'var(--text-muted)'
    html += `<div style="margin-bottom:16px;padding:12px;background:rgba(167,139,250,.05);border:1px solid var(--border);border-radius:8px">
      <div style="font-size:13px;margin-bottom:4px">Status: <strong style="color:${sc}">${last.status}</strong></div>
      ${last.taskDescription ? `<div style="font-size:12px;color:var(--text-dim)">Task: ${escHtml(last.taskDescription)}</div>` : ''}
      ${last.nextSteps ? `<div style="font-size:12px;color:var(--green);margin-top:4px">Next: ${escHtml(last.nextSteps)}</div>` : ''}
      ${last.blockers ? `<div style="font-size:12px;color:var(--red);margin-top:4px">Blocker: ${escHtml(last.blockers)}</div>` : ''}
      ${last.branch ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Branch: <code>${last.branch}</code></div>` : ''}
    </div>`
  }

  // Sessions timeline
  if (sessions.length) {
    html += `<div class="card"><div class="card-title">Sessions <span class="count">${sessions.length}</span></div>
    <div class="timeline">`
    for (const s of sessions) {
      const date = s.startedAt?.replace('T',' ').slice(0,16) || '?'
      html += `<div class="timeline-item">
        <div class="timeline-name">${s.sessionName} <span style="font-size:11px;color:var(--text-muted)">[${s.status}]</span></div>
        <div class="timeline-date">${date}</div>
        <div class="timeline-summary">${s.summary || s.taskDescription || 'No summary'}</div>
        <div class="timeline-stats">+${s.memoriesCreated || 0} memories${s.branch ? ' &middot; ' + s.branch : ''}</div>
      </div>`
    }
    html += '</div></div>'
  }

  // Memories
  if (memories.length) {
    html += `<div class="card"><div class="card-title">Memories <span class="count">${memories.length}</span></div>`
    for (const m of memories) {
      html += `<div class="row" onclick="event.stopPropagation();openMemoryDetail('${m.id}')">
        <span class="row-label">${badge(m.type)} ${(m.context || '').slice(0, 80)}</span>
        <span class="row-val">${confBar(m.confidence)}</span>
      </div>`
    }
    html += '</div>'
  }

  openDetail(name, html)
}

// ── WORK LOG ──
async function renderWorkLog() {
  const data = await fetch(`${API}/api/worklog`).then(r => r.json())
  const projects = data.projects || {}
  const projectNames = Object.keys(projects)

  const typeBadges = {
    feature: 'badge-pattern', fix: 'badge-bugfix', setup: 'badge-fact',
    deploy: 'badge-decision', refactor: 'badge-preference', design: 'badge-goal',
    docs: 'badge-todo', other: 'badge-process'
  }

  const statusDots = {
    'completed': 'var(--green)', 'paused': 'var(--yellow)',
    'blocked': 'var(--red)', 'in-progress': 'var(--blue)'
  }

  let totalEntries = 0
  projectNames.forEach(p => totalEntries += projects[p].totalEntries)

  $('#page').innerHTML = `
    <div class="section-title">Work Log <span class="count" style="font-size:12px;font-weight:400;color:var(--text-muted)">${totalEntries} entries across ${projectNames.length} projects</span></div>

    ${projectNames.length === 0 ? `
      <div class="card" style="text-align:center;padding:32px">
        <p style="color:var(--text-muted);font-size:14px;margin-bottom:8px">No deliverables recorded yet.</p>
        <p style="color:var(--text-muted);font-size:12px">When sessions are closed with <code>deliverables</code> and <code>workType</code>, they appear here automatically.</p>
      </div>
    ` : ''}

    ${projectNames.map(projName => {
      const proj = projects[projName]
      return `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title" style="font-size:16px">${projName} <span class="count">${proj.totalEntries} entries</span></div>

        <div class="timeline">
          ${proj.entries.map(e => {
            const dotColor = statusDots[e.status] || 'var(--text-muted)'
            const badgeCls = typeBadges[e.type] || 'badge-process'
            return `
            <div class="timeline-item">
              <div class="timeline-name">
                <span class="badge ${badgeCls}">${e.type}</span>
                ${escHtml(e.deliverable)}
              </div>
              <div class="timeline-date">
                ${e.date}
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};margin-left:8px;vertical-align:middle"></span>
                <span style="color:var(--text-muted)">${e.status}</span>
              </div>
              <div class="timeline-stats">
                ${e.commits ? e.commits + ' commits' : ''}
                ${e.files ? ' &middot; ' + e.files + ' files' : ''}
                ${e.branch ? ' &middot; ' + e.branch : ''}
              </div>
              ${e.nextSteps ? `<div style="margin-top:4px;font-size:12px;color:var(--green)">Next: ${escHtml(e.nextSteps)}</div>` : ''}
            </div>`
          }).join('')}
        </div>
      </div>`
    }).join('')}
  `
}

// ── Make functions global for onclick handlers ──
window.renderSkills = renderSkills
window.renderMemories = renderMemories
window.openSkillDetail = openSkillDetail
window.openMemoryDetail = openMemoryDetail
window.openProjectDetail = openProjectDetail
window.renderProjects = renderProjects

// ── Init ──
route()
