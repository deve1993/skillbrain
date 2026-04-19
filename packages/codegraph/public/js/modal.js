// SkillBrain Hub — Edit Project modal module

import { api } from './api.js'

// Local helper (not exported — only needed inside this module)
function escHtml(s) {
  return s?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || ''
}

// ── Field builders ──

export function editField(key, label, value, placeholder, type = 'text') {
  const inputStyle = 'width:100%;padding:8px 12px;background:#111118;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none'
  if (type === 'textarea') {
    return `<div>
      <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">${label}</label>
      <textarea name="${key}" placeholder="${escHtml(placeholder)}" rows="2" style="${inputStyle};resize:vertical;font-family:inherit">${escHtml(value || '')}</textarea>
    </div>`
  }
  return `<div>
    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">${label}</label>
    <input type="text" name="${key}" value="${escHtml(value || '')}" placeholder="${escHtml(placeholder)}" style="${inputStyle}">
  </div>`
}

export function editSelect(key, label, value, options) {
  return `<div>
    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">${label}</label>
    <select name="${key}" style="width:100%;padding:8px 12px;background:#111118;border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none">
      <option value="">—</option>
      ${options.map((o) => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}
    </select>
  </div>`
}

export function memberRow(m, i) {
  const inputStyle = 'padding:6px 10px;background:#111118;border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:12px;outline:none'
  return `<div class="member-row" style="display:flex;gap:6px;align-items:center">
    <input type="text" placeholder="Nome" value="${escHtml(m.name || '')}" data-field="name" style="${inputStyle};flex:1">
    <input type="text" placeholder="Ruolo (dev, designer)" value="${escHtml(m.role || '')}" data-field="role" style="${inputStyle};flex:1">
    <input type="email" placeholder="Email" value="${escHtml(m.email || '')}" data-field="email" style="${inputStyle};flex:1">
    <button type="button" onclick="this.closest('.member-row').remove()" style="padding:4px 8px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:var(--red);font-size:11px;border-radius:4px;cursor:pointer">×</button>
  </div>`
}

// ── Modal open / close ──

export async function openEditProjectModal(name) {
  const meta = await api.get(`/api/projects-meta/${encodeURIComponent(name)}`).catch(() => null) || { name }

  let overlay = document.getElementById('edit-modal')
  if (overlay) overlay.remove()
  overlay = document.createElement('div')
  overlay.id = 'edit-modal'
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:flex;justify-content:center;align-items:center;padding:20px'

  const members = meta.teamMembers || []

  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px;width:min(640px,90vw);max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--border)">
        <h2 style="font-size:18px;color:var(--accent);margin:0">Edit Project: ${escHtml(name)}</h2>
        <button onclick="closeEditModal()" style="background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer;padding:0 8px">&times;</button>
      </div>

      <form id="edit-form" onsubmit="return saveProject(event,'${name}')" style="display:flex;flex-direction:column;gap:14px">

        <div class="form-section">
          <h3 style="font-size:13px;color:var(--accent);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">Identity</h3>
          ${editField('displayName', 'Display Name', meta.displayName, 'es. Terrae e Mare')}
          ${editField('clientName', 'Cliente', meta.clientName, 'es. Trattoria Mario')}
          ${editField('description', 'Descrizione', meta.description, 'Breve descrizione progetto', 'textarea')}
          ${editSelect('category', 'Categoria', meta.category, ['landing','ecommerce','app','dashboard','corporate-site','blog','portfolio','other'])}
          ${editSelect('status', 'Status', meta.status, ['active','paused','archived','completed'])}
        </div>

        <div class="form-section">
          <h3 style="font-size:13px;color:var(--accent);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">Team</h3>
          ${editField('teamLead', 'Team Lead', meta.teamLead, 'es. Daniel')}
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Team Members</label>
            <div id="team-members-list" style="display:flex;flex-direction:column;gap:6px">
              ${members.map((m, i) => memberRow(m, i)).join('')}
            </div>
            <button type="button" onclick="addMemberRow()" style="margin-top:6px;padding:4px 10px;background:rgba(99,102,241,.1);border:1px solid var(--accent2);color:var(--accent);font-size:11px;border-radius:4px;cursor:pointer">+ Add member</button>
          </div>
        </div>

        <div class="form-section">
          <h3 style="font-size:13px;color:var(--accent);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">Links</h3>
          ${editField('liveUrl', 'Live URL', meta.liveUrl, 'https://...')}
          ${editField('repoUrl', 'Repository', meta.repoUrl, 'https://github.com/...')}
          ${editField('domainPrimary', 'Domain primario', meta.domainPrimary, 'example.it')}
        </div>

        <div class="form-section">
          <h3 style="font-size:13px;color:var(--accent);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">Admin / Infra</h3>
          ${editField('dbType', 'Database Type', meta.dbType, 'MongoDB / Postgres / Supabase')}
          ${editField('dbReference', 'Database Reference', meta.dbReference, 'es. Atlas cluster pixarts-prod')}
          ${editField('dbAdminUrl', 'Database Admin URL', meta.dbAdminUrl, 'https://...')}
          ${editField('cmsType', 'CMS', meta.cmsType, 'Payload / Sanity / Strapi')}
          ${editField('cmsAdminUrl', 'CMS Admin URL', meta.cmsAdminUrl, 'https://site.it/admin')}
          ${editField('deployPlatform', 'Deploy Platform', meta.deployPlatform, 'Coolify / Vercel / Netlify')}
        </div>

        <div class="form-section">
          <h3 style="font-size:13px;color:var(--accent);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">Notes</h3>
          ${editField('notes', 'Notes', meta.notes, 'Note interne', 'textarea')}
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:12px;border-top:1px solid var(--border)">
          <button type="button" onclick="closeEditModal()" style="padding:8px 16px;background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:6px;cursor:pointer">Cancel</button>
          <button type="submit" style="padding:8px 20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;border-radius:6px;font-weight:600;cursor:pointer">Save</button>
        </div>
      </form>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeEditModal() })
}

export function closeEditModal() {
  const m = document.getElementById('edit-modal')
  if (m) m.remove()
}

export async function saveProject(event, name, onSaved) {
  event.preventDefault()
  const form = document.getElementById('edit-form')
  const fd = new FormData(form)
  const fields = {}
  for (const [k, v] of fd.entries()) {
    if (v !== '') fields[k] = v
  }
  // Collect team members
  const rows = document.querySelectorAll('#team-members-list .member-row')
  const members = []
  rows.forEach((r) => {
    const m = {}
    r.querySelectorAll('input').forEach((i) => {
      const f = i.dataset.field
      if (i.value.trim()) m[f] = i.value.trim()
    })
    if (m.name) members.push(m)
  })
  fields.teamMembers = members

  try {
    await api.put(`/api/projects-meta/${encodeURIComponent(name)}`, fields)
    closeEditModal()
    if (typeof onSaved === 'function') onSaved(name)
    else if (typeof window.openProjectDetail === 'function') window.openProjectDetail(name)
  } catch {
    alert('Save failed')
  }
  return false
}
