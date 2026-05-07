import { api } from '../js/api.js'

// ── State ──
const state = {
  convs: [],          // Conv[]
  activeConvId: null,
  activeConv: null,
  activeJobId: null,
  sseConn: null,
  artifactHtml: null, // current rendered artifact
  currentBlobUrl: null, // track current blob URL for cleanup
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

// ── Pipeline constants ──
const PIPELINE_STEPS = [
  { id: 'brief',     label: 'Brief analizzato' },
  { id: 'context',   label: 'Contesto SkillBrain caricato' },
  { id: 'skill',     label: 'Skill applicata' },
  { id: 'html',      label: 'Generazione HTML…' },
  { id: 'critique',  label: 'Critique' },
  { id: 'done',      label: 'Completato' },
]

let pipelineEl = null

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
  if (state.currentBlobUrl) {
    URL.revokeObjectURL(state.currentBlobUrl)
    state.currentBlobUrl = null
  }

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
    if (state.currentBlobUrl) URL.revokeObjectURL(state.currentBlobUrl)
    state.currentBlobUrl = url
    iframe.src = url
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
function clearChatEmptyState() {
  const empty = $('#chat-empty')
  if (empty) empty.remove()
}

function appendChatMessage(role, text) {
  clearChatEmptyState()
  const area = $('#chat-area')
  if (!area) return

  const msg = document.createElement('div')
  msg.className = `msg msg-${role}`
  msg.innerHTML = `
    <div class="msg-av ${role}">${role === 'user' ? 'U' : 'AI'}</div>
    <div class="msg-bubble ${role}-b">${esc(text)}</div>
  `
  area.appendChild(msg)
  area.scrollTop = area.scrollHeight
}

function renderChatFromMessages(messages) {
  const area = $('#chat-area')
  if (!area) return
  area.innerHTML = ''

  const visible = messages.filter(m => m.role === 'user' || m.role === 'assistant')
  if (visible.length === 0) {
    area.innerHTML = '<div class="chat-empty" id="chat-empty"><div class="chat-empty-icon">💬</div><div style="font-size:11px">La chat apparirà qui dopo la generazione</div></div>'
    return
  }

  for (const m of visible) {
    const role = m.role === 'user' ? 'user' : 'ai'
    const msg = document.createElement('div')
    msg.className = `msg msg-${role}`
    msg.innerHTML = `
      <div class="msg-av ${role}">${role === 'user' ? 'U' : 'AI'}</div>
      <div class="msg-bubble ${role}-b">${esc(m.content?.slice(0, 300) ?? '')}</div>
    `
    area.appendChild(msg)
  }
  area.scrollTop = area.scrollHeight
}

function renderCritique(json) {
  const bar = $('#critique-bar')
  const scoreEl = $('#critique-score')
  const detail = $('#critique-detail')
  if (!bar || !scoreEl || !detail) return

  let data
  try { data = typeof json === 'string' ? JSON.parse(json) : json } catch { return }

  if (data.overall != null) scoreEl.textContent = `${data.overall} / 10`
  bar.classList.add('visible')

  const dims = data.dimensions ?? []
  detail.innerHTML = dims.map(d => `
    <div class="critique-row">
      <div class="c-check ${d.pass ? 'pass' : 'fail'}">${d.pass ? '✓' : '✗'}</div>
      <span style="flex:1">${esc(d.label ?? d.name ?? '')}</span>
      <span style="font-size:10px;color:var(--text-muted)">${esc(String(d.comment ?? d.score ?? ''))}</span>
    </div>
  `).join('')
}
function clearChat() {
  const area = $('#chat-area')
  if (!area) return
  area.innerHTML = '<div class="chat-empty" id="chat-empty"><div class="chat-empty-icon">💬</div><div style="font-size:11px">La chat apparirà qui dopo la generazione</div></div>'
}

// ══════════════════════════════════
// PIPELINE
// ══════════════════════════════════

function createPipelineBlock() {
  const el = document.createElement('div')
  el.className = 'pipeline-block'
  el.id = 'pipeline-block'
  PIPELINE_STEPS.forEach(step => {
    const row = document.createElement('div')
    row.className = 'pipe-step'
    row.id = `pipe-${step.id}`
    row.innerHTML = `
      <div class="pipe-icon pending" id="pipe-icon-${step.id}">○</div>
      <span class="pipe-label pending" id="pipe-label-${step.id}">${esc(step.label)}</span>
    `
    el.appendChild(row)
  })
  return el
}

function setPipelineStep(stepId, status, extra = '') {
  const icon  = $(`#pipe-icon-${stepId}`)
  const label = $(`#pipe-label-${stepId}`)
  if (!icon || !label) return

  icon.className = `pipe-icon ${status}`
  icon.textContent = status === 'done' ? '✓' : status === 'error' ? '✕' : status === 'active' ? '' : '○'

  label.className = `pipe-label ${status}`

  const existing = $(`#pipe-${stepId} .pipe-skill`)
  if (existing) existing.remove()

  if (extra) {
    const badge = document.createElement('span')
    badge.className = 'pipe-skill'
    badge.textContent = extra
    $(`#pipe-${stepId}`)?.appendChild(badge)
  }
}

function collapsePipeline() {
  const block = $('#pipeline-block')
  if (!block) return
  const skillName = state.pickers.skills.find(s => s.id === state.selected.skillId)?.name ?? ''
  const conv = state.activeConv
  const critiqueJson = conv?.critiqueJson ?? null
  let score = '—'
  if (critiqueJson) {
    try {
      const c = typeof critiqueJson === 'string' ? JSON.parse(critiqueJson) : critiqueJson
      if (c.overall != null) score = `${c.overall}/10`
    } catch { /* ignore */ }
  }
  const summary = document.createElement('div')
  summary.className = 'pipeline-summary'
  summary.textContent = `✓ Completato${skillName ? ` con ${skillName}` : ''} · ${score}`
  block.replaceWith(summary)
  pipelineEl = null
}

// ══════════════════════════════════
// GENERATION FLOW
// ══════════════════════════════════

async function generate() {
  if (!state.activeConvId) { toast('Seleziona o crea una conversazione', 'error'); return }
  if (state.previewState === 'generating') return

  const btn = $('#btn-generate')
  if (btn) { btn.disabled = true }

  const promptText = $('#prompt-textarea')?.value?.trim() ?? ''
  if (promptText) {
    appendChatMessage('user', promptText)
    if ($('#prompt-textarea')) $('#prompt-textarea').value = ''
    autoGrow()
  }

  if (promptText && state.activeConvId) {
    try {
      await api.post(`/api/studio/conversations/${state.activeConvId}/messages`, {
        role: 'user', content: promptText,
      })
    } catch { /* non-blocking */ }
  }

  clearChatEmptyState()
  pipelineEl = createPipelineBlock()
  $('#chat-area')?.appendChild(pipelineEl)
  setPipelineStep('brief', 'done')
  setPipelineStep('context', 'active')

  state.previewState = 'generating'
  state.artifactHtml = null
  applyPreviewState()
  updateToolbarButtons()
  updatePromptPlaceholder()

  try {
    const brief = state.selected.briefData
    const res = await api.post(
      `/api/studio/conversations/${state.activeConvId}/generate`,
      {
        agentModel:    state.selected.agentModel,
        critiqueModel: state.selected.critiqueModel,
        skillId:       state.selected.skillId    || undefined,
        dsId:          state.selected.dsId       || undefined,
        directionId:   state.selected.directionId || undefined,
        brief:         brief                      || undefined,
      }
    )
    state.activeJobId = res.jobId
    connectSSE(res.jobId)
  } catch (e) {
    toast(`Generate failed: ${e.message}`, 'error')
    onGenerationError(e.message)
  }
}

function connectSSE(jobId) {
  if (state.sseConn) { state.sseConn.close(); state.sseConn = null }
  const sse = new EventSource(`/api/studio/jobs/${jobId}/stream`)
  state.sseConn = sse
  sse.onmessage = (e) => {
    if (state.sseConn !== sse) return  // stale connection — ignore
    try { handleSseEvent(JSON.parse(e.data)) } catch { /* ignore parse errors */ }
  }
  sse.onerror = () => {
    if (state.sseConn !== sse) return  // stale connection — ignore
    onGenerationError('SSE disconnected')
    state.sseConn = null
  }
}

function handleSseEvent(event) {
  switch (event.type) {
    case 'start': {
      setPipelineStep('context', 'done')
      const skillName = state.pickers.skills.find(s => s.id === state.selected.skillId)?.name ?? null
      setPipelineStep('skill', 'done', skillName ?? '')
      setPipelineStep('html', 'active')
      break
    }
    case 'status':
      if (event.job?.status === 'running') {
        setPipelineStep('context', 'done')
      }
      break

    case 'chunk':
      // text chunk — no UI update needed
      break

    case 'artifact':
      state.artifactHtml = event.html
      setPipelineStep('html', 'done')
      setPipelineStep('critique', 'active')
      break

    case 'critique':
      setPipelineStep('critique', 'done')
      setPipelineStep('done', 'active')
      renderCritique(event.json)
      break

    case 'slop':
      if (event.html) { state.artifactHtml = event.html }
      if (event.json) renderCritique(event.json)
      toast(`⚠ Qualità bassa rilevata — generazione completata comunque`, 'info')
      onGenerationDone()
      break

    case 'done':
      onGenerationDone()
      break

    case 'error': {
      const msg = (event.message ?? '').includes('ANTHROPIC_API_KEY')
        ? 'ANTHROPIC_API_KEY non configurata sul server'
        : `Errore: ${event.message}`
      onGenerationError(msg)
      break
    }
  }
}

function onGenerationDone() {
  if (state.sseConn) { state.sseConn.close(); state.sseConn = null }
  setPipelineStep('done', 'done')
  state.previewState = 'done'
  applyPreviewState()
  updateToolbarButtons()
  updateGenerateButton()
  updatePromptPlaceholder()
  appendChatMessage('ai', 'Generazione completata. Puoi iterare nel prompt qui sotto o esportare dal toolbar.')
  setTimeout(collapsePipeline, 2000)
}

function onGenerationError(msg) {
  if (state.sseConn) { state.sseConn.close(); state.sseConn = null }
  setPipelineStep('html', 'error')
  state.previewState = 'empty'
  applyPreviewState()
  updateToolbarButtons()
  updateGenerateButton()
  toast(msg, 'error')
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
      if (state.currentBlobUrl) URL.revokeObjectURL(state.currentBlobUrl)
      const blob = new Blob([state.artifactHtml], { type: 'text/html' })
      state.currentBlobUrl = URL.createObjectURL(blob)
      iframe.src = state.currentBlobUrl
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

init()
