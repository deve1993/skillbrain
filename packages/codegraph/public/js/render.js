// SkillBrain Hub — Rendering / DOM-building module

import { api } from './api.js'

// ── Pure helpers ──

export function escHtml(s) {
  return s?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || ''
}

export function formatUptime(s) {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s/60)}m`
  const h = Math.floor(s/3600)
  const m = Math.floor((s%3600)/60)
  return `${h}h ${m}m`
}

export function badge(type) {
  const cls = `badge-${type.toLowerCase().replace(/\s/g,'')}`
  return `<span class="badge ${cls}">${type}</span>`
}

export function confBar(val) {
  const pct = val * 10
  const cls = val >= 7 ? 'conf-high' : val >= 4 ? 'conf-mid' : 'conf-low'
  return `<div class="conf-bar"><div class="conf-track"><div class="conf-fill ${cls}" style="width:${pct}%"></div></div><span>${val}</span></div>`
}

export function tagsHtml(tags) {
  if (!tags?.length) return ''
  return `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
}

export function simpleMarkdown(md) {
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

// ── Home ──

export async function renderHome() {
  const [health, data] = await Promise.all([
    api.get('/api/health'),
    api.get('/api/data'),
  ])

  let skillTotal = 0
  try {
    const sr = await api.get('/api/skills?limit=1')
    skillTotal = sr.total || 0
  } catch {}

  const mg = data.memoryGraph || {}
  const sessions = mg.recentSessions || []

  document.getElementById('page').innerHTML = `
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

  document.getElementById('server-status').textContent = `${formatUptime(health.uptime)} uptime`
}

// ── Skills ──

export async function renderSkills(typeFilter) {
  const url = typeFilter ? `/api/skills?type=${typeFilter}` : `/api/skills`
  const data = await api.get(url)
  window.skillsCache = data.skills || []

  const types = ['domain', 'agent', 'command', 'lifecycle', 'process']

  document.getElementById('page').innerHTML = `
    <div class="section-title">Skills Browser <span class="count" style="font-size:12px;font-weight:400;color:var(--text-muted)">${data.total} total</span></div>

    <div class="filters">
      <button class="filter-btn ${!typeFilter ? 'active' : ''}" onclick="renderSkills()">All</button>
      ${types.map(t => `<button class="filter-btn ${typeFilter === t ? 'active' : ''}" onclick="renderSkills('${t}')">${t}</button>`).join('')}
    </div>

    <div class="item-list">
      ${window.skillsCache.map(s => `
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

export async function searchSkills(q) {
  const data = await api.get(`/api/skills?search=${encodeURIComponent(q)}`)
  const skills = data.skills || []

  document.getElementById('page').innerHTML = `
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

export async function openSkillDetail(name, openDetailFn) {
  const skill = await api.get(`/api/skills/${encodeURIComponent(name)}`)
  if (skill.error) { openDetailFn(name, `<p style="color:var(--red)">${skill.error}</p>`); return }

  openDetailFn(skill.name, `
    <div style="margin-bottom:12px">
      ${badge(skill.type)} <span style="color:var(--text-muted)">${skill.category} &middot; ${skill.lines} lines</span>
    </div>
    ${tagsHtml(skill.tags)}
    <div style="margin-top:16px">${simpleMarkdown(skill.content)}</div>
  `)
}

// ── Memories ──

export async function renderMemories(typeFilter) {
  const url = typeFilter ? `/api/memories?type=${typeFilter}` : `/api/memories`
  const data = await api.get(url)
  window.memoriesCache = data.memories || []

  const types = ['Pattern', 'BugFix', 'AntiPattern', 'Fact', 'Decision', 'Preference', 'Goal', 'Todo']

  document.getElementById('page').innerHTML = `
    <div class="section-title">Memory Explorer <span class="count" style="font-size:12px;font-weight:400;color:var(--text-muted)">${data.total} total</span></div>

    <div class="filters">
      <button class="filter-btn ${!typeFilter ? 'active' : ''}" onclick="renderMemories()">All</button>
      ${types.map(t => `<button class="filter-btn ${typeFilter === t ? 'active' : ''}" onclick="renderMemories('${t}')">${t}</button>`).join('')}
    </div>

    <div class="item-list">
      ${window.memoriesCache.map(m => `
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

export async function searchMemories(q) {
  const data = await api.get(`/api/memories?search=${encodeURIComponent(q)}`)
  const memories = data.memories || []

  document.getElementById('page').innerHTML = `
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

export async function openMemoryDetail(id, openDetailFn) {
  const m = await api.get(`/api/memories/${encodeURIComponent(id)}`)
  if (m.error) { openDetailFn(id, `<p style="color:var(--red)">${m.error}</p>`); return }

  const edges = m.edges || []

  openDetailFn(m.id, `
    <div style="margin-bottom:12px">
      ${badge(m.type)} ${confBar(m.confidence)}
      <span style="color:var(--text-muted);font-size:11px;margin-left:8px">${m.skill || ''} &middot; ${m.scope}</span>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button onclick="deprecateMemory('${m.id}')" style="padding:4px 12px;border-radius:6px;background:rgba(245,158,11,.1);border:1px solid var(--yellow);color:var(--yellow);font-size:11px;cursor:pointer">Deprecate</button>
      <button onclick="deleteMemory('${m.id}')" style="padding:4px 12px;border-radius:6px;background:rgba(248,113,113,.1);border:1px solid var(--red);color:var(--red);font-size:11px;cursor:pointer">Delete</button>
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

// ── Sessions ──

export async function renderSessions() {
  const data = await api.get('/api/sessions')
  const sessions = data.sessions || []

  document.getElementById('page').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="section-title" style="margin-bottom:0">Session History <span class="count" style="font-size:12px;font-weight:400;color:var(--text-muted)">${sessions.length} sessions</span></div>
      <button onclick="cleanupDuplicates()" style="padding:6px 12px;border-radius:6px;background:rgba(245,158,11,.1);border:1px solid var(--yellow);color:var(--yellow);font-size:12px;cursor:pointer">Cleanup Duplicates</button>
    </div>

    ${sessions.length === 0 ? '<p style="color:var(--text-muted);font-size:13px">No sessions recorded yet.</p>' : ''}

    <div class="timeline">
      ${sessions.map(s => `
        <div class="timeline-item">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div class="timeline-name">${s.sessionName}</div>
            <button onclick="event.stopPropagation();deleteSession('${s.id}')" style="padding:2px 8px;border-radius:4px;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.3);color:var(--red);font-size:10px;cursor:pointer">Delete</button>
          </div>
          <div class="timeline-date">${s.startedAt?.replace('T',' ').slice(0,16) || '?'}${s.endedAt ? ' — ' + s.endedAt.replace('T',' ').slice(11,16) : ' (running)'}</div>
          <div class="timeline-summary">${s.summary || 'No summary'}</div>
          <div class="timeline-stats">+${s.memoriesCreated || 0} memories${s.project ? ' &middot; ' + s.project : ''}${s.status ? ' &middot; ' + s.status : ''}</div>
        </div>
      `).join('')}
    </div>
  `
}

// ── Projects ──

export async function renderProjects() {
  const data = await api.get('/api/projects')
  const projects = data.projects || []

  const statusColors = {
    'in-progress': 'var(--blue)', 'completed': 'var(--green)',
    'paused': 'var(--yellow)', 'blocked': 'var(--red)', 'unknown': 'var(--text-muted)'
  }

  document.getElementById('page').innerHTML = `
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

export async function renderProjectDetail(name, openDetailFn) {
  const [activity, meta] = await Promise.all([
    api.get(`/api/projects/${encodeURIComponent(name)}`).catch(() => ({})),
    api.get(`/api/projects-meta/${encodeURIComponent(name)}`).catch(() => null),
  ])

  const sessions = activity.sessions || []
  const memories = activity.memories || []
  const last = sessions[0]

  const html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div id="proj-tabs" style="display:flex;gap:4px;border-bottom:1px solid var(--border);flex:1">
        <button class="proj-tab active" data-tab="overview" onclick="switchProjectTab('overview','${name}')" style="padding:8px 14px;background:none;border:none;color:var(--accent);border-bottom:2px solid var(--accent);font-size:13px;cursor:pointer">Overview</button>
        <button class="proj-tab" data-tab="admin" onclick="switchProjectTab('admin','${name}')" style="padding:8px 14px;background:none;border:none;color:var(--text-muted);border-bottom:2px solid transparent;font-size:13px;cursor:pointer">Admin</button>
        <button class="proj-tab" data-tab="env" onclick="switchProjectTab('env','${name}')" style="padding:8px 14px;background:none;border:none;color:var(--text-muted);border-bottom:2px solid transparent;font-size:13px;cursor:pointer">Env Vars</button>
        <button class="proj-tab" data-tab="activity" onclick="switchProjectTab('activity','${name}')" style="padding:8px 14px;background:none;border:none;color:var(--text-muted);border-bottom:2px solid transparent;font-size:13px;cursor:pointer">Activity</button>
      </div>
      <button onclick="openEditProjectModal('${name}')" style="padding:6px 12px;border-radius:6px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;font-size:12px;font-weight:600;cursor:pointer;margin-left:8px">Edit</button>
    </div>
    <div id="proj-tab-content"></div>
  `
  openDetailFn(name, html)

  // Store data for tab switching
  window._projData = { name, activity, meta, sessions, memories, last }
  renderProjectTab('overview', name)
}

export function renderProjectTab(tab, name) {
  const { meta, last, sessions, memories } = window._projData || {}
  const container = document.getElementById('proj-tab-content')
  if (!container) return

  const M = meta || {}
  const statusColors = {'in-progress':'var(--blue)','completed':'var(--green)','paused':'var(--yellow)','blocked':'var(--red)','active':'var(--green)','archived':'var(--text-muted)'}

  if (tab === 'overview') {
    const displayName = M.displayName || name
    const sc = statusColors[M.status || (last?.status)] || 'var(--text-muted)'
    container.innerHTML = `
      <div class="card">
        <div style="font-size:18px;font-weight:600;margin-bottom:4px">${escHtml(displayName)}</div>
        <div style="color:var(--text-muted);font-size:12px;margin-bottom:12px">
          ${M.clientName ? `Client: <strong>${escHtml(M.clientName)}</strong> &middot; ` : ''}
          ${M.category ? `${escHtml(M.category)} &middot; ` : ''}
          <span style="color:${sc}">${M.status || (last?.status || 'unknown')}</span>
        </div>
        ${M.description ? `<div style="color:var(--text-dim);font-size:13px;margin-bottom:12px">${escHtml(M.description)}</div>` : ''}
        ${M.stack?.length ? `<div class="tags">${M.stack.map((s) => `<span class="tag">${escHtml(s)}</span>`).join('')}</div>` : ''}
      </div>

      ${M.teamLead || (M.teamMembers && M.teamMembers.length) ? `
      <div class="card">
        <div class="card-title">Team</div>
        ${M.teamLead ? `<div class="row"><span class="row-label">Lead</span><span class="row-val"><strong>${escHtml(M.teamLead)}</strong></span></div>` : ''}
        ${(M.teamMembers || []).map((m) => `
          <div class="row">
            <span class="row-label">${escHtml(m.name)}</span>
            <span class="row-val" style="font-size:12px;color:var(--text-muted)">${escHtml(m.role || '')}${m.email ? ' · ' + escHtml(m.email) : ''}</span>
          </div>
        `).join('')}
      </div>` : ''}

      ${M.repoUrl || M.liveUrl ? `
      <div class="card">
        <div class="card-title">Links</div>
        ${M.liveUrl ? `<div class="row"><span class="row-label">Live</span><a href="${escHtml(M.liveUrl)}" target="_blank" style="color:var(--accent)">${escHtml(M.liveUrl)}</a></div>` : ''}
        ${M.repoUrl ? `<div class="row"><span class="row-label">Repo</span><a href="${escHtml(M.repoUrl)}" target="_blank" style="color:var(--accent)">${escHtml(M.repoUrl)}</a></div>` : ''}
        ${M.mainBranch ? `<div class="row"><span class="row-label">Branch</span><span class="row-val"><code>${escHtml(M.mainBranch)}</code></span></div>` : ''}
      </div>` : ''}

      ${last ? `
      <div class="card">
        <div class="card-title">Last Activity</div>
        <div class="row"><span class="row-label">Date</span><span class="row-val">${last.startedAt?.split('T')[0] || '?'}</span></div>
        ${last.taskDescription ? `<div class="row"><span class="row-label">Task</span><span class="row-val">${escHtml(last.taskDescription)}</span></div>` : ''}
        ${last.nextSteps ? `<div style="margin-top:8px;padding:8px;background:rgba(52,211,153,.05);border:1px solid rgba(52,211,153,.2);border-radius:6px;font-size:12px;color:var(--green)">Next: ${escHtml(last.nextSteps)}</div>` : ''}
        ${last.blockers ? `<div style="margin-top:6px;padding:8px;background:rgba(248,113,113,.05);border:1px solid rgba(248,113,113,.2);border-radius:6px;font-size:12px;color:var(--red)">Blocker: ${escHtml(last.blockers)}</div>` : ''}
      </div>` : ''}

      ${!meta ? `
      <div class="card" style="border-color:var(--yellow)">
        <div style="color:var(--yellow);font-size:13px;margin-bottom:8px">Metadata not scanned yet</div>
        <div style="color:var(--text-muted);font-size:12px">Run <code>project_scan</code> from Claude Code to auto-detect stack, repo, CMS, DB, etc.</div>
      </div>` : ''}
    `
  }

  if (tab === 'admin') {
    container.innerHTML = `
      ${M.dbType || M.dbReference || M.dbAdminUrl ? `
      <div class="card">
        <div class="card-title">Database</div>
        ${M.dbType ? `<div class="row"><span class="row-label">Type</span><span class="row-val">${escHtml(M.dbType)}</span></div>` : ''}
        ${M.dbReference ? `<div class="row"><span class="row-label">Reference</span><span class="row-val">${escHtml(M.dbReference)}</span></div>` : ''}
        ${M.dbAdminUrl ? `<div class="row"><span class="row-label">Admin</span><a href="${escHtml(M.dbAdminUrl)}" target="_blank" style="color:var(--accent)">${escHtml(M.dbAdminUrl)}</a></div>` : ''}
      </div>` : ''}

      ${M.cmsType || M.cmsAdminUrl ? `
      <div class="card">
        <div class="card-title">CMS</div>
        ${M.cmsType ? `<div class="row"><span class="row-label">Type</span><span class="row-val">${escHtml(M.cmsType)}</span></div>` : ''}
        ${M.cmsAdminUrl ? `<div class="row"><span class="row-label">Admin</span><a href="${escHtml(M.cmsAdminUrl)}" target="_blank" style="color:var(--accent)">${escHtml(M.cmsAdminUrl)}</a></div>` : ''}
      </div>` : ''}

      ${M.deployPlatform ? `
      <div class="card">
        <div class="card-title">Deploy</div>
        <div class="row"><span class="row-label">Platform</span><span class="row-val">${escHtml(M.deployPlatform)}</span></div>
        ${M.lastDeploy ? `<div class="row"><span class="row-label">Last deploy</span><span class="row-val">${escHtml(M.lastDeploy)}</span></div>` : ''}
        <div class="row"><span class="row-label">CI/CD</span><span class="row-val">${M.hasCi ? '✅ GitHub Actions' : '—'}</span></div>
      </div>` : ''}

      ${M.domainPrimary || (M.domainsExtra && M.domainsExtra.length) ? `
      <div class="card">
        <div class="card-title">Domains</div>
        ${M.domainPrimary ? `<div class="row"><span class="row-label">Primary</span><span class="row-val">${escHtml(M.domainPrimary)}</span></div>` : ''}
        ${(M.domainsExtra || []).map((d) => `<div class="row"><span class="row-label">Extra</span><span class="row-val">${escHtml(d)}</span></div>`).join('')}
      </div>` : ''}

      ${M.integrations && Object.keys(M.integrations).length ? `
      <div class="card">
        <div class="card-title">Integrations</div>
        ${Object.entries(M.integrations).map(([k, v]) => `<div class="row"><span class="row-label">${escHtml(k)}</span><span class="row-val">${escHtml(String(v))}</span></div>`).join('')}
      </div>` : ''}

      ${M.legalCookieBanner || M.legalPrivacyUrl ? `
      <div class="card">
        <div class="card-title">Legal</div>
        ${M.legalCookieBanner ? `<div class="row"><span class="row-label">Cookie banner</span><span class="row-val">${escHtml(M.legalCookieBanner)}</span></div>` : ''}
        ${M.legalPrivacyUrl ? `<div class="row"><span class="row-label">Privacy</span><a href="${escHtml(M.legalPrivacyUrl)}" target="_blank" style="color:var(--accent)">${escHtml(M.legalPrivacyUrl)}</a></div>` : ''}
        ${M.legalTermsUrl ? `<div class="row"><span class="row-label">Terms</span><a href="${escHtml(M.legalTermsUrl)}" target="_blank" style="color:var(--accent)">${escHtml(M.legalTermsUrl)}</a></div>` : ''}
      </div>` : ''}

      ${!meta ? `<p style="color:var(--text-muted);font-size:13px">Scan this project first to populate admin info.</p>` : ''}
    `
  }

  if (tab === 'env') {
    loadEnvVars(name)
    container.innerHTML = `<div id="env-content"><p style="color:var(--text-muted);font-size:13px">Loading env vars...</p></div>`
  }

  if (tab === 'activity') {
    let html = ''
    if (sessions?.length) {
      html += `<div class="card"><div class="card-title">Sessions <span class="count">${sessions.length}</span></div><div class="timeline">`
      for (const s of sessions) {
        const date = s.startedAt?.replace('T', ' ').slice(0, 16) || '?'
        html += `<div class="timeline-item">
          <div class="timeline-name">${escHtml(s.sessionName)} <span style="font-size:11px;color:var(--text-muted)">[${s.status}]</span></div>
          <div class="timeline-date">${date}</div>
          <div class="timeline-summary">${escHtml(s.summary || s.taskDescription || 'No summary')}</div>
        </div>`
      }
      html += '</div></div>'
    }
    if (memories?.length) {
      html += `<div class="card"><div class="card-title">Memories <span class="count">${memories.length}</span></div>`
      for (const m of memories) {
        html += `<div class="row" onclick="event.stopPropagation();openMemoryDetail('${m.id}')">
          <span class="row-label">${badge(m.type)} ${escHtml((m.context || '').slice(0, 80))}</span>
          <span class="row-val">${confBar(m.confidence)}</span>
        </div>`
      }
      html += '</div>'
    }
    container.innerHTML = html || '<p style="color:var(--text-muted);font-size:13px">No activity yet.</p>'
  }
}

// ── Env Vars ──

export async function loadEnvVars(name) {
  const container = document.getElementById('env-content')
  if (!container) return
  try {
    const { vars } = await api.get(`/api/projects-meta/${encodeURIComponent(name)}/env`)

    container.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="importEnv('${name}')" style="padding:6px 12px;border-radius:6px;background:rgba(99,102,241,.1);border:1px solid var(--accent2);color:var(--accent);font-size:12px;cursor:pointer">Import .env</button>
        <button onclick="exportEnv('${name}')" style="padding:6px 12px;border-radius:6px;background:rgba(52,211,153,.1);border:1px solid var(--green);color:var(--green);font-size:12px;cursor:pointer">Copy all as .env</button>
      </div>
      ${vars?.length ? `
      <div class="card">
        <div class="card-title">Env Vars <span class="count">${vars.length}</span></div>
        ${vars.map(v => `
          <div class="row">
            <span class="row-label"><code style="color:${v.isSecret ? 'var(--yellow)' : 'var(--green)'}">${escHtml(v.varName)}</code>${v.isSecret ? '' : ' <span style="font-size:10px;color:var(--text-muted)">(public)</span>'}</span>
            <span>
              <button onclick="revealEnv('${name}','${v.varName}')" style="padding:2px 8px;border-radius:4px;background:none;border:1px solid var(--border);color:var(--text-muted);font-size:11px;cursor:pointer;margin-right:4px">Reveal</button>
              <button onclick="deleteEnv('${name}','${v.varName}')" style="padding:2px 8px;border-radius:4px;background:none;border:1px solid rgba(248,113,113,.3);color:var(--red);font-size:11px;cursor:pointer">Delete</button>
            </span>
          </div>
        `).join('')}
      </div>
      ` : '<p style="color:var(--text-muted);font-size:13px">No env vars saved yet. Click "Import .env" to paste and save.</p>'}
    `
  } catch (e) {
    container.innerHTML = `<p style="color:var(--red)">Error loading env vars</p>`
  }
}

// ── Global search ──

export async function searchGlobal(q, openDetailFn) {
  const [skills, memories] = await Promise.all([
    api.get(`/api/skills?search=${encodeURIComponent(q)}&limit=5`),
    api.get(`/api/memories?search=${encodeURIComponent(q)}&limit=5`),
  ])

  document.getElementById('page').innerHTML = `
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

// ── Components ──

const SECTION_TYPE_COLORS = {
  hero: '#6366f1', navbar: '#8b5cf6', footer: '#a78bfa',
  cta: '#f59e0b', pricing: '#10b981', features: '#3b82f6',
  testimonials: '#06b6d4', faq: '#84cc16', comparison: '#f97316',
  process: '#ec4899', gallery: '#14b8a6', demo: '#64748b',
  form: '#ef4444', card: '#8b5cf6', other: '#6b7280',
}

export async function renderComponents(typeFilter) {
  const url = typeFilter ? `/api/components?type=${typeFilter}&limit=200` : `/api/components?limit=200`
  const data = await api.get(url)
  const components = data.components || []

  const types = ['hero','navbar','footer','cta','pricing','features','testimonials','faq','comparison','process','gallery','demo','form','card','other']

  // Group by section_type
  const byType = {}
  for (const c of components) {
    if (!byType[c.sectionType]) byType[c.sectionType] = []
    byType[c.sectionType].push(c)
  }

  document.getElementById('page').innerHTML = `
    <div class="section-title">Component Catalog <span class="count" style="font-size:12px;font-weight:400;color:var(--text-muted)">${components.length} components</span></div>

    <div class="filters">
      <button class="filter-btn ${!typeFilter ? 'active' : ''}" onclick="renderComponents()">All</button>
      ${types.filter(t => byType[t]?.length).map(t => `<button class="filter-btn ${typeFilter === t ? 'active' : ''}" onclick="renderComponents('${t}')">${t} <span style="opacity:.6">${byType[t]?.length || 0}</span></button>`).join('')}
    </div>

    ${components.length === 0 ? `
      <div class="card" style="text-align:center;padding:32px">
        <p style="color:var(--text-muted);font-size:14px;margin-bottom:8px">No components cataloged yet.</p>
        <p style="color:var(--text-muted);font-size:12px">Use <code>component_add</code> from Claude Code to catalog UI components as you build them.</p>
      </div>
    ` : ''}

    ${Object.entries(byType).filter(([t]) => !typeFilter || t === typeFilter).map(([type, comps]) => `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title" style="display:flex;align-items:center;gap:8px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${SECTION_TYPE_COLORS[type] || '#6b7280'}"></span>
          ${type.toUpperCase()}
          <span class="count">${comps.length}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
          ${comps.map(c => `
            <div style="padding:12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:border-color .15s" onmouseenter="this.style.borderColor='var(--accent)'" onmouseleave="this.style.borderColor='var(--border)'" onclick="openComponentDetail('${c.id}')">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                <span style="font-weight:600;font-size:13px">${escHtml(c.name)}</span>
                <span style="font-size:10px;color:var(--text-muted);background:var(--surface);padding:2px 6px;border-radius:4px;white-space:nowrap">${escHtml(c.project)}</span>
              </div>
              ${c.description ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;line-height:1.4">${escHtml(c.description.slice(0, 100))}</div>` : ''}
              ${c.filePath ? `<div style="font-size:10px;color:var(--text-dim);font-family:monospace;margin-bottom:6px">${escHtml(c.filePath)}</div>` : ''}
              ${c.tags?.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${c.tags.map(t => `<span class="tag" style="font-size:10px;padding:1px 6px">${escHtml(t)}</span>`).join('')}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}
  `
}

export async function openComponentDetail(id, openDetailFn) {
  const c = await api.get(`/api/components/${encodeURIComponent(id)}`)
  if (!c || c.error) { openDetailFn?.(id, `<p style="color:var(--red)">Component not found</p>`); return }

  openDetailFn?.(c.name, `
    <div style="margin-bottom:12px">
      <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${SECTION_TYPE_COLORS[c.sectionType] || '#6b7280'}22;color:${SECTION_TYPE_COLORS[c.sectionType] || '#6b7280'};border:1px solid ${SECTION_TYPE_COLORS[c.sectionType] || '#6b7280'}44">${c.sectionType.toUpperCase()}</span>
      <span style="margin-left:8px;font-size:12px;color:var(--text-muted)">Project: <strong>${escHtml(c.project)}</strong></span>
    </div>
    ${c.description ? `<div class="card"><div class="card-title">Description</div><p style="font-size:13px">${escHtml(c.description)}</p></div>` : ''}
    ${c.filePath ? `<div class="card"><div class="card-title">File</div><code style="font-size:12px">${escHtml(c.filePath)}</code></div>` : ''}
    ${c.tags?.length ? `<div style="margin-bottom:12px">${c.tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
    ${c.propsSchema && Object.keys(c.propsSchema).length ? `<div class="card"><div class="card-title">Props</div><pre style="font-size:11px;overflow:auto">${escHtml(JSON.stringify(c.propsSchema, null, 2))}</pre></div>` : ''}
    ${c.designTokens && Object.keys(c.designTokens).length ? `<div class="card"><div class="card-title">Design Tokens</div><pre style="font-size:11px;overflow:auto">${escHtml(JSON.stringify(c.designTokens, null, 2))}</pre></div>` : ''}
    ${c.codeSnippet ? `<div class="card"><div class="card-title">Code Preview</div><pre style="font-size:11px;overflow:auto;max-height:300px">${escHtml(c.codeSnippet)}</pre></div>` : ''}
    <div style="margin-top:8px;font-size:11px;color:var(--text-muted)">Added: ${c.createdAt?.split('T')[0] || '?'}</div>
  `)
}

// ── Design Systems ──

export async function renderDesignSystems() {
  const data = await api.get('/api/design-systems')
  const systems = data.designSystems || []

  document.getElementById('page').innerHTML = `
    <div class="section-title">Design Systems <span class="count" style="font-size:12px;font-weight:400;color:var(--text-muted)">${systems.length} projects</span></div>

    ${systems.length === 0 ? `
      <div class="card" style="text-align:center;padding:32px">
        <p style="color:var(--text-muted);font-size:14px;margin-bottom:8px">No design systems saved yet.</p>
        <p style="color:var(--text-muted);font-size:12px">Use <code>design_system_set</code> from Claude Code to store colors, fonts, and tokens per client project.</p>
      </div>
    ` : ''}

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">
      ${systems.map(ds => {
        const colorEntries = Object.entries(ds.colors || {}).slice(0, 8)
        const fontVals = Object.values(ds.fonts || {}).filter(v => typeof v === 'string').slice(0, 3)
        return `
        <div class="card" style="cursor:pointer" onclick="openDesignSystemDetail('${escHtml(ds.project)}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-weight:700;font-size:15px">${escHtml(ds.project)}</div>
              ${ds.clientName ? `<div style="font-size:11px;color:var(--text-muted)">${escHtml(ds.clientName)}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              ${ds.darkMode ? '<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:rgba(99,102,241,.15);color:var(--accent)">dark mode</span>' : ''}
              <span style="font-size:10px;color:var(--text-muted)">${ds.colorFormat}</span>
            </div>
          </div>
          ${colorEntries.length ? `
          <div style="margin-bottom:10px">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Colors</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${colorEntries.map(([k, v]) => `
                <div style="display:flex;align-items:center;gap:4px" title="${escHtml(k)}: ${escHtml(v)}">
                  <div style="width:18px;height:18px;border-radius:4px;background:${escHtml(v)};border:1px solid rgba(255,255,255,.1);flex-shrink:0"></div>
                  <span style="font-size:10px;color:var(--text-muted)">${escHtml(k)}</span>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
          ${fontVals.length ? `
          <div>
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">Fonts</div>
            <div style="font-size:12px;color:var(--text-dim)">${fontVals.map(f => escHtml(f)).join(' · ')}</div>
          </div>` : ''}
          <div style="margin-top:10px;font-size:10px;color:var(--text-muted)">Updated: ${ds.updatedAt?.split('T')[0] || '?'}</div>
        </div>`
      }).join('')}
    </div>
  `
}

export async function openDesignSystemDetail(project, openDetailFn) {
  const ds = await api.get(`/api/design-systems/${encodeURIComponent(project)}`)
  if (!ds || ds.error) { openDetailFn?.(project, `<p style="color:var(--red)">Design system not found</p>`); return }

  const colorEntries = Object.entries(ds.colors || {})
  const fontEntries = Object.entries(ds.fonts || {})
  const spacingEntries = Object.entries(ds.spacing || {})
  const radiusEntries = Object.entries(ds.radius || {})

  openDetailFn?.(ds.project, `
    <div style="margin-bottom:12px;font-size:12px;color:var(--text-muted)">
      ${ds.clientName ? `Client: <strong>${escHtml(ds.clientName)}</strong> &middot; ` : ''}
      Format: ${ds.colorFormat} &middot; Dark mode: ${ds.darkMode ? 'yes' : 'no'}
    </div>

    ${colorEntries.length ? `
    <div class="card">
      <div class="card-title">Colors <span class="count">${colorEntries.length}</span></div>
      ${colorEntries.map(([k, v]) => `
        <div class="row">
          <span class="row-label" style="display:flex;align-items:center;gap:8px">
            <span style="width:20px;height:20px;border-radius:4px;background:${escHtml(v)};border:1px solid rgba(255,255,255,.1);display:inline-block;flex-shrink:0"></span>
            <code>${escHtml(k)}</code>
          </span>
          <span class="row-val"><code>${escHtml(v)}</code></span>
        </div>
      `).join('')}
    </div>` : ''}

    ${fontEntries.length ? `
    <div class="card">
      <div class="card-title">Fonts</div>
      ${fontEntries.map(([k, v]) => `
        <div class="row"><span class="row-label"><code>${escHtml(k)}</code></span><span class="row-val">${escHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</span></div>
      `).join('')}
    </div>` : ''}

    ${spacingEntries.length ? `
    <div class="card">
      <div class="card-title">Spacing</div>
      ${spacingEntries.map(([k, v]) => `
        <div class="row"><span class="row-label"><code>${escHtml(k)}</code></span><span class="row-val">${escHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</span></div>
      `).join('')}
    </div>` : ''}

    ${radiusEntries.length ? `
    <div class="card">
      <div class="card-title">Border Radius</div>
      ${radiusEntries.map(([k, v]) => `
        <div class="row"><span class="row-label"><code>${escHtml(k)}</code></span><span class="row-val"><code>${escHtml(v)}</code></span></div>
      `).join('')}
    </div>` : ''}

    ${ds.notes ? `<div class="card"><div class="card-title">Notes</div><p style="font-size:13px">${escHtml(ds.notes)}</p></div>` : ''}
    ${ds.tailwindConfig ? `<div class="card"><div class="card-title">Tailwind Config</div><pre style="font-size:11px;overflow:auto;max-height:300px">${escHtml(ds.tailwindConfig)}</pre></div>` : ''}
  `)
}

// ── Work Log ──

export async function renderWorkLog() {
  const data = await api.get('/api/worklog')
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

  document.getElementById('page').innerHTML = `
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
