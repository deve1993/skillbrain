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
  try {
    await api.delete(`/api/studio/conversations/${convId}`)
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
// STUBS (implemented in later tasks)
// ══════════════════════════════════
function renderConfigBar() { /* Task 3 */ }
function openSheet(mode) { /* Task 3 */ }
function closeSheet() { /* Task 3 */ }
function applyPreviewState() { /* Task 4 */ }
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
