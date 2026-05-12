// Synapse — Edit Project modal module

import { api } from './api.js'

// Local helper (not exported — only needed inside this module)
function escHtml(s) {
  return s?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || ''
}

// Attribute-safe escape (also escapes quotes, for use in HTML attributes and inline JS strings)
function escAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;width:min(680px,92vw);max-height:92vh;display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        <h2 style="font-size:16px;color:var(--accent);margin:0">Edit Project: ${escHtml(name)}</h2>
        <button onclick="closeEditModal()" aria-label="Close" style="background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer;padding:0 8px">&times;</button>
      </div>

      <div class="edit-modal-tabs" role="tablist" aria-label="Project fields">
        <button type="button" role="tab" aria-selected="true" class="edit-modal-tab active" data-tab="identity" onclick="switchEditTab('identity')">Identity<span class="req">*</span></button>
        <button type="button" role="tab" aria-selected="false" class="edit-modal-tab" data-tab="team" onclick="switchEditTab('team')">Team</button>
        <button type="button" role="tab" aria-selected="false" class="edit-modal-tab" data-tab="links" onclick="switchEditTab('links')">Links</button>
        <button type="button" role="tab" aria-selected="false" class="edit-modal-tab" data-tab="infra" onclick="switchEditTab('infra')">Infra</button>
        <button type="button" role="tab" aria-selected="false" class="edit-modal-tab" data-tab="notes" onclick="switchEditTab('notes')">Notes</button>
      </div>

      <form id="edit-form" onsubmit="return saveProject(event,'${escHtml(name)}')" style="flex:1;min-height:0;display:flex;flex-direction:column">

        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;padding-right:4px">
          <div class="edit-tab-content active" data-content="identity">
            ${editField('displayName', 'Display Name', meta.displayName, 'es. Terrae e Mare')}
            ${editField('clientName', 'Cliente', meta.clientName, 'es. Trattoria Mario')}
            ${editField('description', 'Descrizione', meta.description, 'Breve descrizione progetto', 'textarea')}
            ${editSelect('category', 'Categoria', meta.category, ['landing','ecommerce','app','dashboard','corporate-site','blog','portfolio','other'])}
            ${editSelect('status', 'Status', meta.status, ['active','paused','archived','completed'])}
            ${renderStackTagInput(meta.stack || [])}
          </div>

          <div class="edit-tab-content" data-content="team">
            ${editField('teamLead', 'Team Lead', meta.teamLead, 'es. Daniel')}
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Team Members</label>
              <div id="team-members-list" style="display:flex;flex-direction:column;gap:6px">
                ${members.map((m, i) => memberRow(m, i)).join('')}
              </div>
              <button type="button" onclick="addMemberRow()" style="margin-top:6px;padding:4px 10px;background:rgba(99,102,241,.1);border:1px solid var(--accent2);color:var(--accent);font-size:11px;border-radius:4px;cursor:pointer">+ Add member</button>
            </div>
          </div>

          <div class="edit-tab-content" data-content="links">
            ${editField('liveUrl', 'Live URL', meta.liveUrl, 'https://...')}
            ${editField('repoUrl', 'Repository', meta.repoUrl, 'https://github.com/...')}
            ${editField('mainBranch', 'Main branch', meta.mainBranch, 'main')}
            ${editField('domainPrimary', 'Domain primario', meta.domainPrimary, 'example.it')}
          </div>

          <div class="edit-tab-content" data-content="infra">
            ${editField('dbType', 'Database Type', meta.dbType, 'MongoDB / Postgres / Supabase')}
            ${editField('dbReference', 'Database Reference', meta.dbReference, 'es. Atlas cluster pixarts-prod')}
            ${editField('dbAdminUrl', 'Database Admin URL', meta.dbAdminUrl, 'https://...')}
            ${editField('cmsType', 'CMS', meta.cmsType, 'Payload / Sanity / Strapi')}
            ${editField('cmsAdminUrl', 'CMS Admin URL', meta.cmsAdminUrl, 'https://site.it/admin')}
            ${editField('deployPlatform', 'Deploy Platform', meta.deployPlatform, 'Coolify / Vercel / Netlify')}
          </div>

          <div class="edit-tab-content" data-content="notes">
            ${editField('notes', 'Notes', meta.notes, 'Note interne', 'textarea')}
          </div>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:14px;margin-top:0;border-top:1px solid var(--border);flex-shrink:0">
          <button type="button" onclick="closeEditModal()" style="padding:8px 16px;background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:6px;cursor:pointer">Cancel</button>
          <button type="submit" style="padding:8px 20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;color:#fff;border-radius:6px;font-weight:600;cursor:pointer">Save</button>
        </div>
      </form>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeEditModal() })
  initStackTagInput()
}

export function switchEditTab(tab) {
  document.querySelectorAll('.edit-modal-tab').forEach(b => {
    const active = b.dataset.tab === tab
    b.classList.toggle('active', active)
    b.setAttribute('aria-selected', active ? 'true' : 'false')
  })
  document.querySelectorAll('.edit-tab-content').forEach(c => {
    c.classList.toggle('active', c.dataset.content === tab)
  })
}

// Interactive chip-based tag input for the Stack field
function renderStackTagInput(stack) {
  const tags = Array.isArray(stack) ? stack : []
  return `<div>
    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Stack</label>
    <div class="tag-input-wrap" id="stack-tag-wrap" data-tags='${escAttr(JSON.stringify(tags))}'>
      ${tags.map(t => renderTagChip(t)).join('')}
      <input type="text" class="tag-input" id="stack-tag-input" placeholder="Add tech (press Enter)" autocomplete="off" aria-label="Add stack technology">
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Press Enter to add, Backspace on empty input to remove the last tag.</div>
  </div>`
}

function renderTagChip(tag) {
  return `<span class="tag-chip" data-tag="${escAttr(tag)}">${escHtml(tag)}<button type="button" tabindex="-1" onclick="removeStackTag('${escAttr(tag)}')" aria-label="Remove ${escAttr(tag)}">×</button></span>`
}

function initStackTagInput() {
  const wrap = document.getElementById('stack-tag-wrap')
  const inp = document.getElementById('stack-tag-input')
  if (!wrap || !inp) return
  // Focus the input when clicking anywhere in the wrap (so the wrap feels like one big input)
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) inp.focus()
  })
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const v = inp.value.trim()
      if (!v) return
      addStackTag(v)
      inp.value = ''
    } else if (e.key === 'Backspace' && inp.value === '') {
      const chips = wrap.querySelectorAll('.tag-chip')
      if (chips.length === 0) return
      const last = chips[chips.length - 1]
      const tag = last.dataset.tag
      removeStackTag(tag)
    }
  })
}

function addStackTag(tag) {
  const wrap = document.getElementById('stack-tag-wrap')
  if (!wrap) return
  let tags
  try { tags = JSON.parse(wrap.dataset.tags || '[]') } catch { tags = [] }
  if (tags.includes(tag)) return  // dedupe
  tags.push(tag)
  wrap.dataset.tags = JSON.stringify(tags)
  // Insert chip before the input
  const inp = document.getElementById('stack-tag-input')
  const tmp = document.createElement('div')
  tmp.innerHTML = renderTagChip(tag)
  if (inp && tmp.firstElementChild) {
    wrap.insertBefore(tmp.firstElementChild, inp)
  }
}

export function removeStackTag(tag) {
  const wrap = document.getElementById('stack-tag-wrap')
  if (!wrap) return
  let tags
  try { tags = JSON.parse(wrap.dataset.tags || '[]') } catch { tags = [] }
  const idx = tags.indexOf(tag)
  if (idx < 0) return
  tags.splice(idx, 1)
  wrap.dataset.tags = JSON.stringify(tags)
  // Remove the chip — match by data-tag attribute via querySelectorAll (CSS escape needed)
  for (const chip of wrap.querySelectorAll('.tag-chip')) {
    if (chip.dataset.tag === tag) { chip.remove(); break }
  }
  // Refocus the input so the user can keep typing
  document.getElementById('stack-tag-input')?.focus()
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
  // Stack comes from the tag-input widget; falls back to the legacy stackRaw CSV if the widget is absent.
  const stackWrap = document.getElementById('stack-tag-wrap')
  if (stackWrap) {
    try { fields.stack = JSON.parse(stackWrap.dataset.tags || '[]') } catch { fields.stack = [] }
  } else if (fields.stackRaw !== undefined) {
    fields.stack = fields.stackRaw.split(',').map(s => s.trim()).filter(Boolean)
  }
  delete fields.stackRaw
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

// ── Merge Projects dialog ──

export async function showMergeDialog(primaryName) {
  let projects = []
  try {
    const data = await api.get('/api/projects-meta')
    projects = (data.projects || []).filter((p) => p.name !== primaryName)
  } catch {
    alert('Failed to load projects list')
    return
  }

  let overlay = document.getElementById('merge-modal')
  if (overlay) overlay.remove()
  overlay = document.createElement('div')
  overlay.id = 'merge-modal'
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;justify-content:center;align-items:center;padding:20px'

  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px;width:min(520px,90vw);max-height:80vh;display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
        <h2 style="font-size:16px;color:var(--accent);margin:0">Merge into <strong>${escHtml(primaryName)}</strong></h2>
        <button onclick="closeMergeModal()" style="background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer;padding:0 8px">&times;</button>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin:0 0 14px">Select the duplicate projects to absorb. Their sessions, memories, and env vars will be moved to <strong style="color:var(--text)">${escHtml(primaryName)}</strong>, then deleted.</p>
      <div id="merge-list" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:6px">
        ${projects.length === 0
          ? '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No other projects found.</div>'
          : projects.map((p) => `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;background:rgba(255,255,255,.03);border:1px solid var(--border);cursor:pointer">
            <input type="checkbox" value="${escHtml(p.name)}" style="width:14px;height:14px;accent-color:var(--accent)">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.name)}</div>
              ${p.displayName && p.displayName !== p.name ? `<div style="font-size:11px;color:var(--text-muted)">${escHtml(p.displayName)}</div>` : ''}
            </div>
          </label>`).join('')}
      </div>
      <div id="merge-result" style="display:none;margin-top:12px;padding:10px;border-radius:6px;font-size:12px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
        <button onclick="closeMergeModal()" style="padding:8px 16px;background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:6px;cursor:pointer">Cancel</button>
        <button id="merge-confirm-btn" onclick="confirmMerge('${escHtml(primaryName)}')" style="padding:8px 20px;background:linear-gradient(135deg,#f59e0b,#ef4444);border:none;color:#fff;border-radius:6px;font-weight:600;cursor:pointer">Merge selected</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMergeModal() })
}

export function closeMergeModal() {
  const m = document.getElementById('merge-modal')
  if (m) m.remove()
}

export async function confirmMerge(primaryName) {
  const checks = [...document.querySelectorAll('#merge-list input[type=checkbox]:checked')]
  const aliases = checks.map((c) => c.value)
  if (aliases.length === 0) {
    alert('Select at least one project to merge.')
    return
  }

  const btn = document.getElementById('merge-confirm-btn')
  if (btn) { btn.disabled = true; btn.textContent = 'Merging...' }

  try {
    const result = await api.post('/api/projects-meta/merge', { primary: primaryName, aliases })
    const resultEl = document.getElementById('merge-result')
    if (resultEl) {
      resultEl.style.display = 'block'
      resultEl.style.background = 'rgba(52,211,153,.08)'
      resultEl.style.border = '1px solid rgba(52,211,153,.25)'
      resultEl.style.color = 'var(--green)'
      resultEl.innerHTML = `✅ Merged ${aliases.length} project${aliases.length > 1 ? 's' : ''} into <strong>${escHtml(primaryName)}</strong><br>Sessions: +${result.movedSessions} &middot; Memories: +${result.movedMemories} &middot; Env vars: +${result.movedEnvVars}`
    }
    if (btn) { btn.textContent = 'Done'; btn.style.background = 'var(--green)' }
    setTimeout(() => {
      closeMergeModal()
      if (typeof window.renderProjects === 'function') window.renderProjects()
    }, 2000)
  } catch (err) {
    const resultEl = document.getElementById('merge-result')
    if (resultEl) {
      resultEl.style.display = 'block'
      resultEl.style.background = 'rgba(248,113,113,.08)'
      resultEl.style.border = '1px solid rgba(248,113,113,.25)'
      resultEl.style.color = 'var(--red)'
      resultEl.textContent = `Error: ${err.message || 'Merge failed'}`
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Merge selected' }
  }
}

// ── Merge Design Systems dialog ──

export async function showDsMergeDialog(primaryProject) {
  let designSystems = []
  try {
    const data = await api.get('/api/design-systems')
    designSystems = (data.designSystems || []).filter((ds) => ds.project !== primaryProject)
  } catch {
    alert('Failed to load design systems list')
    return
  }

  let overlay = document.getElementById('ds-merge-modal')
  if (overlay) overlay.remove()
  overlay = document.createElement('div')
  overlay.id = 'ds-merge-modal'
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;display:flex;justify-content:center;align-items:center;padding:20px'

  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px;width:min(520px,90vw);max-height:80vh;display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
        <h2 style="font-size:16px;color:var(--accent);margin:0">Merge design system into <strong>${escHtml(primaryProject)}</strong></h2>
        <button onclick="closeDsMergeModal()" style="background:none;border:none;color:var(--text-muted);font-size:24px;cursor:pointer;padding:0 8px">&times;</button>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin:0 0 14px">Scegli il design system duplicato da assorbire. I suoi token saranno uniti in <strong style="color:var(--text)">${escHtml(primaryProject)}</strong> (che ha la priorità sui conflitti), poi il duplicato verrà cancellato.</p>
      <div id="ds-merge-list" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:6px">
        ${designSystems.length === 0
          ? '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Nessun altro design system trovato.</div>'
          : designSystems.map((ds) => `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;background:rgba(255,255,255,.03);border:1px solid var(--border);cursor:pointer">
            <input type="radio" name="ds-alias" value="${escHtml(ds.project)}" style="width:14px;height:14px;accent-color:var(--accent)">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500">${escHtml(ds.project)}</div>
              ${ds.clientName ? `<div style="font-size:11px;color:var(--text-muted)">${escHtml(ds.clientName)}</div>` : ''}
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${Object.keys(ds.colors || {}).length} colors &middot; ${Object.keys(ds.fonts || {}).length} fonts</div>
            </div>
          </label>`).join('')}
      </div>
      <div id="ds-merge-result" style="display:none;margin-top:12px;padding:10px;border-radius:6px;font-size:12px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
        <button onclick="closeDsMergeModal()" style="padding:8px 16px;background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:6px;cursor:pointer">Annulla</button>
        <button id="ds-merge-confirm-btn" onclick="confirmDsMerge('${escHtml(primaryProject)}')" style="padding:8px 20px;background:linear-gradient(135deg,#f59e0b,#ef4444);border:none;color:#fff;border-radius:6px;font-weight:600;cursor:pointer">Merge</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDsMergeModal() })
}

export function closeDsMergeModal() {
  const m = document.getElementById('ds-merge-modal')
  if (m) m.remove()
}

export async function confirmDsMerge(primaryProject) {
  const radio = document.querySelector('#ds-merge-list input[type=radio]:checked')
  if (!radio) { alert('Seleziona un design system da assorbire.'); return }
  const alias = radio.value

  const btn = document.getElementById('ds-merge-confirm-btn')
  if (btn) { btn.disabled = true; btn.textContent = 'Merging...' }

  try {
    await api.post('/api/design-systems/merge', { primary: primaryProject, alias })
    const resultEl = document.getElementById('ds-merge-result')
    if (resultEl) {
      resultEl.style.display = 'block'
      resultEl.style.background = 'rgba(52,211,153,.08)'
      resultEl.style.border = '1px solid rgba(52,211,153,.25)'
      resultEl.style.color = 'var(--green)'
      resultEl.innerHTML = `✅ Design system <strong>${escHtml(alias)}</strong> unito in <strong>${escHtml(primaryProject)}</strong>`
    }
    if (btn) { btn.textContent = 'Done'; btn.style.background = 'var(--green)' }
    setTimeout(() => {
      closeDsMergeModal()
      if (typeof window.renderDesignSystems === 'function') window.renderDesignSystems()
    }, 1800)
  } catch (err) {
    const resultEl = document.getElementById('ds-merge-result')
    if (resultEl) {
      resultEl.style.display = 'block'
      resultEl.style.background = 'rgba(248,113,113,.08)'
      resultEl.style.border = '1px solid rgba(248,113,113,.25)'
      resultEl.style.color = 'var(--red)'
      resultEl.textContent = `Errore: ${err.message || 'Merge fallito'}`
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Merge' }
  }
}
