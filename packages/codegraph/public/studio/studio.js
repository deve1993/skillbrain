import { api } from '../js/api.js'

// ── State ──
const state = {
  convs: [],          // Conv[]
  activeConvId: null,
  activeConv: null,
  activeJobId: null,
  sseConn: null,
  artifactHtml: null, // current rendered artifact
  pickers: { skills: [], ds: [], directions: [] },
  selected: {
    skillId: null, dsId: null, directionId: null,
    agentModel: 'claude-sonnet-4-6',
    critiqueModel: 'claude-haiku-4-5-20251001',
    briefData: null,
  },
  // 'empty' | 'generating' | 'done' | 'error'
  previewState: 'empty',
}

// Exposed for connectors.js
window.studioState = state

// ── DOM helpers ──
const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]
const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

// ── Toast ──
function toast(msg, type = 'info') {
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 3000)
}

// Make toast available globally for connectors.js
window.showToast = toast

// ── Relative time ──
function relTime(iso) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ══════════════════════════════════
// TABS
// ══════════════════════════════════

async function loadConvs() {
  try {
    const result = await api.get('/api/studio/conversations')
    state.convs = Array.isArray(result) ? result : (result.conversations ?? [])
    renderTabs()
    if (state.convs.length > 0 && !state.activeConvId) {
      await selectConv(state.convs[0].id)
    }
  } catch (e) {
    toast(`Failed to load conversations: ${e.message}`, 'error')
  }
}

function renderTabs() {
  const bar = $('#tab-bar')
  if (!bar) return

  bar.innerHTML = ''

  for (const conv of state.convs) {
    const dotClass = conv.status === 'generating' ? 'generating'
      : (conv.id === state.activeConvId && state.previewState === 'done') ? 'done'
      : 'idle'

    const tab = document.createElement('div')
    tab.className = `s-tab${conv.id === state.activeConvId ? ' active' : ''}`
    tab.dataset.convId = conv.id
    tab.innerHTML = `
      <span class="tab-dot ${dotClass}"></span>
      <span class="tab-name">${esc(conv.title.slice(0, 22))}</span>
      <span class="tab-close" data-close="${conv.id}">✕</span>
    `
    tab.addEventListener('click', (e) => {
      if (e.target.dataset.close) { deleteConv(e.target.dataset.close); return }
      selectConv(conv.id)
    })
    bar.appendChild(tab)
  }

  // New tab button
  const newBtn = document.createElement('div')
  newBtn.className = 'tab-new'
  newBtn.textContent = '+'
  newBtn.title = 'New conversation'
  newBtn.addEventListener('click', createConv)
  bar.appendChild(newBtn)
}

async function selectConv(convId) {
  if (state.sseConn) { state.sseConn.close(); state.sseConn = null }

  const previousConvId = state.activeConvId
  state.activeConvId = convId
  state.activeConv = null
  state.artifactHtml = null
  state.previewState = 'empty'

  try {
    const [convResult, msgsResult] = await Promise.all([
      api.get(`/api/studio/conversations/${convId}`),
      api.get(`/api/studio/conversations/${convId}/messages`),
    ])
    state.activeConv = convResult.conversation ?? convResult
    const messages = Array.isArray(msgsResult) ? msgsResult : (msgsResult.messages ?? [])

    // Sync selected pickers from conversation
    state.selected.skillId = state.activeConv.skillId ?? null
    state.selected.dsId = state.activeConv.dsId ?? null
    state.selected.directionId = state.activeConv.directionId ?? null

    // Find last artifact
    const artifactMsg = [...messages].reverse().find(m => m.role === 'artifact')
    if (artifactMsg?.content) {
      state.artifactHtml = artifactMsg.content
      state.previewState = 'done'
    }

    renderTabs()
    renderConfigBar()
    renderChatFromMessages(messages)
    applyPreviewState()
    updateToolbarButtons()
    updateGenerateButton()
    updatePromptPlaceholder()
  } catch (e) {
    state.activeConvId = previousConvId
    toast(`Failed to load conversation: ${e.message}`, 'error')
  }
}
async function createConv() {
  const title = `New ${new Date().toLocaleTimeString('it', { hour: '2-digit', minute: '2-digit' })}`
  try {
    const result = await api.post('/api/studio/conversations', { title })
    const conv = result.conversation ?? result
    state.convs.unshift(conv)
    await selectConv(conv.id)
    // Auto-open brief sheet for guidance (user can dismiss)
    openSheet('brief')
  } catch (e) {
    toast(`Create failed: ${e.message}`, 'error')
  }
}

async function deleteConv(convId) {
  if (!confirm('Delete this conversation?')) return
  if (!state.convs.find(c => c.id === convId)) return
  try {
    await api.del(`/api/studio/conversations/${convId}`)
    state.convs = state.convs.filter(c => c.id !== convId)
    if (state.activeConvId === convId) {
      state.activeConvId = null
      state.activeConv = null
      state.artifactHtml = null
      state.previewState = 'empty'
      if (state.convs.length > 0) {
        await selectConv(state.convs[0].id)
      } else {
        renderTabs()
        renderConfigBar()
        clearChat()
        applyPreviewState()
        updateToolbarButtons()
        updateGenerateButton()
      }
    } else {
      renderTabs()
    }
  } catch (e) {
    toast(`Delete failed: ${e.message}`, 'error')
  }
}

// ══════════════════════════════════
// PICKERS
// ══════════════════════════════════

async function loadPickers() {
  try {
    const [sr, dr, dir] = await Promise.all([
      api.get('/api/studio/skills'),
      api.get('/api/studio/design-systems'),
      api.get('/api/studio/directions'),
    ])
    state.pickers.skills = Array.isArray(sr) ? sr : (sr.skills ?? [])
    state.pickers.ds = Array.isArray(dr) ? dr : (dr.designSystems ?? [])
    state.pickers.directions = Array.isArray(dir) ? dir : (dir.directions ?? [])
  } catch (e) {
    toast(`Failed to load pickers: ${e.message}`, 'error')
  }
}

// ══════════════════════════════════
// CONFIG BAR
// ══════════════════════════════════

function renderConfigBar() {
  const bar = $('#config-bar')
  if (!bar) return
  bar.innerHTML = ''

  const chips = []
  if (state.selected.skillId) {
    const s = state.pickers.skills.find(x => x.id === state.selected.skillId)
    if (s) chips.push(s.name)
  }
  if (state.selected.dsId) {
    const d = state.pickers.ds.find(x => x.id === state.selected.dsId)
    if (d) chips.push(d.name)
  }
  if (state.selected.directionId) {
    const d = state.pickers.directions.find(x => x.id === state.selected.directionId)
    if (d) chips.push(d.name)
  }

  if (chips.length === 0) {
    const ph = document.createElement('span')
    ph.className = 'config-chip placeholder'
    ph.textContent = '+ Add skill / DS'
    ph.addEventListener('click', () => openSheet('edit'))
    bar.appendChild(ph)
  } else {
    chips.forEach(name => {
      const chip = document.createElement('span')
      chip.className = 'config-chip'
      chip.textContent = name
      bar.appendChild(chip)
    })
    const editBtn = document.createElement('button')
    editBtn.className = 'config-edit-btn'
    editBtn.textContent = '✎ edit'
    editBtn.addEventListener('click', () => openSheet('edit'))
    bar.appendChild(editBtn)
  }
}

// ══════════════════════════════════
// SIDE SHEET
// ══════════════════════════════════

function openSheet(mode) {
  const sheet = $('#side-sheet')
  const title = $('#sheet-title')
  const body = $('#sheet-body')
  const footer = $('#sheet-footer')
  if (!sheet || !body) return

  if (mode === 'edit') {
    title.textContent = 'Configura'
    body.innerHTML = renderEditSheetBody()
    footer.style.display = 'flex'
    bindEditSheetPills(body)
    $('#sheet-apply').onclick = () => { saveEditSheet(body); closeSheet() }
  } else {
    // brief mode
    title.textContent = '⚙ Brief (opzionale)'
    body.innerHTML = renderBriefSheetBody()
    footer.style.display = 'flex'
    $('#sheet-apply').onclick = () => { saveBriefSheet(body); closeSheet() }
  }

  sheet.classList.add('open')
}

function bindEditSheetPills(body) {
  body.querySelectorAll('[data-skill]').forEach(btn => {
    btn.className = `sheet-pill${btn.dataset.skill === state.selected.skillId ? ' selected' : ''}`
    btn.onclick = () => {
      state.selected.skillId = btn.dataset.skill === state.selected.skillId ? null : btn.dataset.skill
      bindEditSheetPills(body); renderConfigBar()
    }
  })
  body.querySelectorAll('[data-ds]').forEach(btn => {
    btn.className = `sheet-pill${btn.dataset.ds === state.selected.dsId ? ' selected' : ''}`
    btn.onclick = () => {
      state.selected.dsId = btn.dataset.ds === state.selected.dsId ? null : btn.dataset.ds
      bindEditSheetPills(body); renderConfigBar()
    }
  })
  body.querySelectorAll('[data-dir]').forEach(btn => {
    btn.className = `sheet-pill${btn.dataset.dir === state.selected.directionId ? ' selected' : ''}`
    btn.onclick = () => {
      state.selected.directionId = btn.dataset.dir === state.selected.directionId ? null : btn.dataset.dir
      bindEditSheetPills(body); renderConfigBar()
    }
  })
}

function renderEditSheetBody() {
  const skillPills = state.pickers.skills.slice(0, 12).map(s =>
    `<button class="sheet-pill${s.id === state.selected.skillId ? ' selected' : ''}" data-skill="${esc(s.id)}">${esc(s.name)}</button>`
  ).join('')
  const dsPills = state.pickers.ds.slice(0, 12).map(d =>
    `<button class="sheet-pill${d.id === state.selected.dsId ? ' selected' : ''}" data-ds="${esc(d.id)}">${esc(d.name)}</button>`
  ).join('')
  const dirPills = state.pickers.directions.map(d =>
    `<button class="sheet-pill${d.id === state.selected.directionId ? ' selected' : ''}" data-dir="${esc(d.id)}">${esc(d.name)}</button>`
  ).join('')
  return `
    <div class="sheet-section">
      <div class="sheet-label">Skill</div>
      <div class="sheet-pills">${skillPills || '<span style="font-size:11px;color:var(--text-muted)">Nessuna skill disponibile</span>'}</div>
    </div>
    <div class="sheet-section">
      <div class="sheet-label">Design System</div>
      <div class="sheet-pills">${dsPills || '<span style="font-size:11px;color:var(--text-muted)">Nessun DS disponibile</span>'}</div>
    </div>
    <div class="sheet-section">
      <div class="sheet-label">Visual Direction</div>
      <div class="sheet-pills">${dirPills || '<span style="font-size:11px;color:var(--text-muted)">Nessuna direction disponibile</span>'}</div>
    </div>
    <div class="sheet-section">
      <div class="sheet-label">Modelli</div>
      <div class="sheet-model-row">
        <div>
          <div class="sheet-model-label">Generate</div>
          <select class="sheet-select" id="sel-agent">
            <option value="claude-opus-4-7"${state.selected.agentModel==='claude-opus-4-7'?' selected':''}>Opus 4.7</option>
            <option value="claude-sonnet-4-6"${state.selected.agentModel==='claude-sonnet-4-6'?' selected':''}>Sonnet 4.6</option>
            <option value="claude-haiku-4-5-20251001"${state.selected.agentModel==='claude-haiku-4-5-20251001'?' selected':''}>Haiku 4.5</option>
          </select>
        </div>
        <div>
          <div class="sheet-model-label">Critique</div>
          <select class="sheet-select" id="sel-critique">
            <option value="claude-haiku-4-5-20251001"${state.selected.critiqueModel==='claude-haiku-4-5-20251001'?' selected':''}>Haiku 4.5</option>
            <option value="claude-sonnet-4-6"${state.selected.critiqueModel==='claude-sonnet-4-6'?' selected':''}>Sonnet 4.6</option>
          </select>
        </div>
      </div>
    </div>
  `
}

function saveEditSheet(body) {
  state.selected.agentModel = body.querySelector('#sel-agent')?.value ?? state.selected.agentModel
  state.selected.critiqueModel = body.querySelector('#sel-critique')?.value ?? state.selected.critiqueModel
  renderConfigBar()
}

function renderBriefSheetBody() {
  const b = state.selected.briefData ?? {}
  return `
    <p style="font-size:11px;color:var(--text-muted);line-height:1.6">
      Fornisci contesto opzionale per guidare la generazione. Puoi saltare e scrivere direttamente nel prompt.
    </p>
    <div class="brief-fields">
      <div><label>Surface</label>
        <select class="sheet-select" id="brief-surface">
          <option value="">— skip —</option>
          <option value="landing"${b.surface==='landing'?' selected':''}>Landing page</option>
          <option value="dashboard"${b.surface==='dashboard'?' selected':''}>Dashboard</option>
          <option value="form"${b.surface==='form'?' selected':''}>Form / wizard</option>
          <option value="email"${b.surface==='email'?' selected':''}>Email template</option>
          <option value="component"${b.surface==='component'?' selected':''}>UI Component</option>
        </select>
      </div>
      <div><label>Audience</label>
        <input class="sheet-input" id="brief-audience" placeholder="es. SaaS founders, B2B" value="${esc(b.audience??'')}">
      </div>
      <div><label>Tone</label>
        <select class="sheet-select" id="brief-tone">
          <option value="">— skip —</option>
          <option value="professional"${b.tone==='professional'?' selected':''}>Professional</option>
          <option value="casual"${b.tone==='casual'?' selected':''}>Casual</option>
          <option value="bold"${b.tone==='bold'?' selected':''}>Bold / aggressive</option>
          <option value="minimal"${b.tone==='minimal'?' selected':''}>Minimal</option>
        </select>
      </div>
      <div><label>Brand / prodotto</label>
        <input class="sheet-input" id="brief-brand" placeholder="es. SkillBrain — AI memory platform" value="${esc(b.brand??'')}">
      </div>
      <div><label>Scale</label>
        <select class="sheet-select" id="brief-scale">
          <option value="">— skip —</option>
          <option value="mvp"${b.scale==='mvp'?' selected':''}>MVP / prototipo</option>
          <option value="full"${b.scale==='full'?' selected':''}>Completo</option>
        </select>
      </div>
    </div>
  `
}

function saveBriefSheet(body) {
  const surface  = body.querySelector('#brief-surface')?.value  || null
  const audience = body.querySelector('#brief-audience')?.value || null
  const tone     = body.querySelector('#brief-tone')?.value     || null
  const brand    = body.querySelector('#brief-brand')?.value    || null
  const scale    = body.querySelector('#brief-scale')?.value    || null
  state.selected.briefData = (surface || audience || tone || brand || scale)
    ? { surface, audience, tone, brand, scale }
    : null
}

function closeSheet() {
  $('#side-sheet')?.classList.remove('open')
}
function applyPreviewState() {
  const s = state.previewState
  const empty   = $('#preview-empty')
  const gen     = $('#preview-generating')
  const iframe  = $('#preview-iframe')
  if (!empty || !gen || !iframe) return

  empty.style.display   = s === 'empty'      ? 'flex'  : 'none'
  gen.style.display     = s === 'generating' ? 'flex'  : 'none'
  iframe.style.display  = s === 'done'       ? 'block' : 'none'

  if (s === 'done' && state.artifactHtml) {
    const blob = new Blob([state.artifactHtml], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    if (iframe.src !== url) {
      const prev = iframe.src
      iframe.src = url
      if (prev.startsWith('blob:')) URL.revokeObjectURL(prev)
    }
  }

  // Update tab dot
  renderTabs()
  updateToolbarButtons()
}
function updateToolbarButtons() { /* Task 8 */ }
function updateGenerateButton() {
  const btn = $('#btn-generate')
  if (!btn) return
  btn.disabled = !state.activeConvId || state.previewState === 'generating'
}
function updatePromptPlaceholder() {
  const ta = $('#prompt-textarea')
  if (!ta) return
  ta.placeholder = state.previewState === 'empty'
    ? 'Descrivi cosa generare…'
    : 'Itera sul risultato…'
}
function renderChatFromMessages(messages) { /* Task 6 */ }
function clearChat() {
  const area = $('#chat-area')
  if (!area) return
  area.innerHTML = '<div class="chat-empty" id="chat-empty"><div class="chat-empty-icon">💬</div><div style="font-size:11px">La chat apparirà qui dopo la generazione</div></div>'
}

// ══════════════════════════════════
// INIT
// ══════════════════════════════════
async function init() {
  await loadPickers()
  await loadConvs()
  $('#btn-generate')?.addEventListener('click', () => generate())
  $('#btn-send')?.addEventListener('click', () => handleSend())
  $('#btn-brief')?.addEventListener('click', () => openSheet('brief'))
  $('#sheet-close')?.addEventListener('click', closeSheet)
  $('#sheet-cancel')?.addEventListener('click', closeSheet)
  $('#btn-deploy')?.addEventListener('click', (e) => {
    e.stopPropagation()
    $('#deploy-dropdown')?.classList.toggle('open')
  })
  document.addEventListener('click', () => $('#deploy-dropdown')?.classList.remove('open'))
  $('#prompt-textarea')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  })
  $('#prompt-textarea')?.addEventListener('input', autoGrow)
  $('#critique-toggle')?.addEventListener('click', () => {
    const d = $('#critique-detail'); d?.classList.toggle('open')
    const t = $('#critique-toggle'); if (t) t.textContent = d?.classList.contains('open') ? '▴ chiudi' : '▾ dettaglio'
  })
  $('#btn-refresh')?.addEventListener('click', () => {
    if (state.previewState === 'done' && state.artifactHtml) {
      const iframe = $('#preview-iframe')
      if (!iframe) return
      const blob = new Blob([state.artifactHtml], { type: 'text/html' })
      iframe.src = URL.createObjectURL(blob)
    }
  })
  $('#btn-fullscreen')?.addEventListener('click', () => {
    const iframe = $('#preview-iframe')
    if (iframe?.requestFullscreen) iframe.requestFullscreen()
  })
  updateGenerateButton()
}

function autoGrow() {
  const ta = $('#prompt-textarea')
  if (!ta) return
  ta.style.height = 'auto'
  ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'
}

function handleSend() { /* Task 7 */ }
function generate() { /* Task 5 */ }

init()
