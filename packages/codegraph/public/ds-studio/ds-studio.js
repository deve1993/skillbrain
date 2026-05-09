// ── API helpers ──
const api = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, body) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()),
}

// ── State ──
let tokens = {
  colors: {
    primary: '#6366f1', secondary: '#8b5cf6', accent: '#a78bfa',
    background: '#08080d', surface: '#0e0e16', text: '#d0d0d0',
    textMuted: '#777', border: '#1a1a2a', error: '#f87171',
    success: '#34d399', warning: '#f59e0b',
  },
  fonts: { sans: 'Inter', mono: 'JetBrains Mono', heading: 'Inter', baseSize: '16px', lineHeight: '1.5' },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px' },
  radius: { sm: '4px', md: '8px', lg: '16px', full: '9999px' },
  darkMode: true,
}
let importMode = null

// ── Init ──
async function init() {
  await loadDsList()
  renderAll()
}

async function loadDsList() {
  try {
    const data = await api.get('/api/design-systems')
    const sel = document.getElementById('ds-select')
    // Keep "— New DS —" first option
    while (sel.options.length > 1) sel.remove(1)
    for (const ds of data.designSystems ?? []) {
      const opt = document.createElement('option')
      opt.value = ds.project
      opt.textContent = ds.project + (ds.clientName ? ` — ${ds.clientName}` : '')
      sel.appendChild(opt)
    }
    sel.onchange = () => loadDs(sel.value)
  } catch { /* server may be starting up */ }
}

async function loadDs(project) {
  if (!project) return
  try {
    const ds = await api.get(`/api/design-systems/${encodeURIComponent(project)}`)
    if (ds.error) return
    document.getElementById('project-input').value = project
    if (ds.colors && Object.keys(ds.colors).length) tokens.colors = ds.colors
    if (ds.fonts && Object.keys(ds.fonts).length) tokens.fonts = ds.fonts
    if (ds.spacing && Object.keys(ds.spacing).length) tokens.spacing = ds.spacing
    if (ds.radius && Object.keys(ds.radius).length) tokens.radius = ds.radius
    tokens.darkMode = ds.darkMode ?? false
    document.getElementById('dark-mode-toggle').checked = tokens.darkMode
    renderAll()
  } catch { /* ignore */ }
}

window.newDs = function() {
  document.getElementById('ds-select').value = ''
  document.getElementById('project-input').value = ''
  tokens = {
    colors: { primary: '#6366f1', background: '#ffffff', surface: '#f8fafc', text: '#0f172a', border: '#e2e8f0' },
    fonts: { sans: 'Inter', baseSize: '16px', lineHeight: '1.5' },
    spacing: { sm: '8px', md: '16px', lg: '24px' },
    radius: { sm: '4px', md: '8px', lg: '16px' },
    darkMode: false,
  }
  renderAll()
  setStatus('')
}

// ── Render ──
function renderAll() {
  renderColors()
  renderFonts()
  renderSpacing()
  renderRadius()
  updatePreview()
}

function renderColors() {
  document.getElementById('colors-list').innerHTML = Object.entries(tokens.colors).map(([name, val]) => `
    <div class="color-row">
      <input type="color" value="${val}" data-name="${name}" oninput="setColor('${name}',this.value)">
      <span class="color-name">${name}</span>
      <input class="color-hex" type="text" value="${val}" data-name="${name}" oninput="setColorHex('${name}',this.value)">
      <button class="del-btn" onclick="delColor('${name}')" title="Remove">×</button>
    </div>
  `).join('')
}

function renderGrid(containerId, obj, onchange) {
  document.getElementById(containerId).innerHTML = Object.entries(obj).map(([k, v]) => `
    <div class="token-row">
      <label>${k}</label>
      <input type="text" value="${v}" oninput="${onchange}('${k}',this.value)">
    </div>
  `).join('')
}

function renderFonts() { renderGrid('fonts-grid', tokens.fonts, 'setFont') }
function renderSpacing() { renderGrid('spacing-grid', tokens.spacing, 'setSpacing') }
function renderRadius() { renderGrid('radius-grid', tokens.radius, 'setRadius') }

// ── Token setters (must be on window for oninput= handlers) ──
window.setColor = (name, val) => { tokens.colors[name] = val; updatePreview() }
window.setColorHex = (name, val) => { tokens.colors[name] = val; updatePreview() }
window.delColor = (name) => { delete tokens.colors[name]; renderColors(); updatePreview() }
window.addColor = () => {
  const k = prompt('Color name (e.g. brand):')
  if (k && k.trim()) { tokens.colors[k.trim()] = '#000000'; renderColors(); updatePreview() }
}
window.toggleDarkMode = () => { tokens.darkMode = document.getElementById('dark-mode-toggle').checked; updatePreview() }
window.setFont = (k, v) => { tokens.fonts[k] = v; updatePreview() }
window.setSpacing = (k, v) => { tokens.spacing[k] = v; updatePreview() }
window.setRadius = (k, v) => { tokens.radius[k] = v; updatePreview() }

// ── Preview ──
function buildPreviewHtml() {
  const vars = [
    ...Object.entries(tokens.colors).map(([k, v]) => `--c-${k}: ${v};`),
    ...Object.entries(tokens.fonts).map(([k, v]) => `--f-${k}: ${v};`),
    ...Object.entries(tokens.spacing).map(([k, v]) => `--s-${k}: ${v};`),
    ...Object.entries(tokens.radius).map(([k, v]) => `--r-${k}: ${v};`),
  ].join(' ')

  return `<!DOCTYPE html><html><head><style>
    :root { ${vars} }
    * { margin:0; padding:0; box-sizing:border-box }
    body { font-family: var(--f-sans, var(--f-heading, sans-serif)); background: var(--c-background, #fff); color: var(--c-text, #111); padding: 20px; display:flex; flex-direction:column; gap:16px }
    h1 { font-size:22px; font-weight:700 }
    p { font-size:13px; color: var(--c-textMuted, #666); line-height: var(--f-lineHeight, 1.5) }
    .card { background: var(--c-surface, #f8f8f8); border: 1px solid var(--c-border, #e0e0e0); border-radius: var(--r-md, 8px); padding: var(--s-md, 16px) }
    .btn { display:inline-block; background: var(--c-primary, #6366f1); color:#fff; border:none; border-radius: var(--r-sm, 4px); padding: var(--s-sm,8px) var(--s-md,16px); font-size:13px; cursor:pointer; margin-right:8px }
    .btn-sec { background:transparent; border:1px solid var(--c-primary, #6366f1); color: var(--c-primary, #6366f1) }
    .badge { display:inline-block; background: var(--c-accent, #a78bfa); color:#fff; border-radius: var(--r-full, 9999px); padding:2px 10px; font-size:11px }
    .palette { display:flex; gap:6px; flex-wrap:wrap }
    .swatch { width:28px; height:28px; border-radius: var(--r-sm, 4px) }
  </style></head><body>
    <h1>Design System Preview</h1>
    <p>The quick brown fox jumps over the lazy dog — typography specimen.</p>
    <div class="card">
      <p style="margin-bottom:10px;font-weight:500">Component Card</p>
      <button class="btn">Primary Action</button>
      <button class="btn btn-sec">Secondary</button>
      <span class="badge" style="margin-left:8px">Badge</span>
    </div>
    <div class="palette">
      ${Object.entries(tokens.colors).slice(0, 12).map(([k, v]) => `<div class="swatch" style="background:${v}" title="${k}: ${v}"></div>`).join('')}
    </div>
  </body></html>`
}

function updatePreview() {
  document.getElementById('preview-frame').srcdoc = buildPreviewHtml()
}

// ── AI Generation ──
window.generate = async function() {
  const brief = document.getElementById('brief').value.trim()
  if (!brief) { setStatus('Enter a brief first', 'err'); return }

  const btn = document.getElementById('gen-btn')
  btn.disabled = true
  btn.textContent = '⏳ Generating…'
  setStatus('Connecting to AI…')

  try {
    const { jobId, error } = await api.post('/api/studio/ds/generate', { brief })
    if (error || !jobId) throw new Error(error ?? 'No job ID returned')

    const sse = new EventSource(`/api/studio/ds/stream/${jobId}`)
    let accumulated = ''

    sse.onmessage = (e) => {
      let evt
      try { evt = JSON.parse(e.data) } catch { return }

      if (evt.type === 'chunk') {
        accumulated += evt.text ?? ''
        setStatus('Generating…')
      }
      if (evt.type === 'done') {
        sse.close()
        const result = evt.result ?? tryParseJson(accumulated)
        if (result) {
          applyTokens(result)
          setStatus('Generated! Review tokens and save.', 'ok')
        } else {
          setStatus('Generated but no valid JSON returned. Try again.', 'err')
        }
        btn.disabled = false
        btn.textContent = '▸ Generate Design System'
      }
      if (evt.type === 'error') {
        sse.close()
        setStatus('Error: ' + (evt.message ?? 'Unknown error'), 'err')
        btn.disabled = false
        btn.textContent = '▸ Generate Design System'
      }
    }
    sse.onerror = () => {
      sse.close()
      setStatus('Connection lost', 'err')
      btn.disabled = false
      btn.textContent = '▸ Generate Design System'
    }
  } catch (err) {
    setStatus('Error: ' + err.message, 'err')
    btn.disabled = false
    btn.textContent = '▸ Generate Design System'
  }
}

function tryParseJson(text) {
  try {
    const m = text.match(/\{[\s\S]*\}/)
    return m ? JSON.parse(m[0]) : null
  } catch { return null }
}

function applyTokens(result) {
  if (result.colors && typeof result.colors === 'object') tokens.colors = result.colors
  if (result.fonts && typeof result.fonts === 'object') tokens.fonts = result.fonts
  if (result.spacing && typeof result.spacing === 'object') tokens.spacing = result.spacing
  if (result.radius && typeof result.radius === 'object') tokens.radius = result.radius
  if (typeof result.darkMode === 'boolean') {
    tokens.darkMode = result.darkMode
    document.getElementById('dark-mode-toggle').checked = result.darkMode
  }
  renderAll()
}

// ── Import ──
window.openImport = function(mode) {
  importMode = mode
  const labels = { json: 'Import JSON Design Tokens', css: 'Import CSS Variables', tailwind: 'Import Tailwind Config', figma: 'Import from Figma' }
  document.getElementById('import-title').textContent = labels[mode] ?? 'Import'
  document.getElementById('import-text').value = ''
  document.getElementById('import-text').placeholder = mode === 'figma' ? 'Optional: paste variables JSON' : `Paste ${mode} content here…`
  document.getElementById('import-figma-url').style.display = mode === 'figma' ? 'block' : 'none'
  document.getElementById('import-figma-token').style.display = mode === 'figma' ? 'block' : 'none'
  document.getElementById('import-overlay').classList.add('open')
}
window.closeImport = () => document.getElementById('import-overlay').classList.remove('open')

window.runImport = async function() {
  const text = document.getElementById('import-text').value.trim()
  try {
    let result
    if (importMode === 'figma') {
      const fileUrl = document.getElementById('import-figma-url').value.trim()
      if (!fileUrl) { alert('Figma URL required'); return }
      const accessToken = document.getElementById('import-figma-token').value.trim() || undefined
      result = await api.post('/api/studio/ds/import/figma', { fileUrl, accessToken })
    } else if (importMode === 'json') {
      result = await api.post('/api/studio/ds/import/json', { tokens: text })
    } else if (importMode === 'css') {
      result = await api.post('/api/studio/ds/import/css', { css: text })
    } else if (importMode === 'tailwind') {
      result = await api.post('/api/studio/ds/import/tailwind', { config: text })
    }
    if (!result || result.error) { alert('Import error: ' + (result?.error ?? 'Unknown')); return }
    // Merge imported tokens (don't overwrite if empty)
    if (result.colors && Object.keys(result.colors).length) tokens.colors = { ...tokens.colors, ...result.colors }
    if (result.fonts && Object.keys(result.fonts).length) tokens.fonts = { ...tokens.fonts, ...result.fonts }
    if (result.spacing && Object.keys(result.spacing).length) tokens.spacing = { ...tokens.spacing, ...result.spacing }
    if (result.radius && Object.keys(result.radius).length) tokens.radius = { ...tokens.radius, ...result.radius }
    renderAll()
    setStatus('Imported! Review and save.', 'ok')
    closeImport()
  } catch (err) {
    alert('Import failed: ' + err.message)
  }
}

// ── Export ──
window.exportDs = async function(format) {
  const project = document.getElementById('project-input').value.trim()
  if (!project) { setStatus('Save DS first (enter a project name)', 'err'); return }
  try {
    const res = await fetch(`/api/design-systems/${encodeURIComponent(project)}/export/${format}`)
    if (!res.ok) { setStatus('Export failed: ' + res.statusText, 'err'); return }
    const text = await res.text()
    try {
      await navigator.clipboard.writeText(text)
      setStatus(`${format} copied to clipboard!`, 'ok')
    } catch {
      prompt(`${format} export (copy below):`, text)
    }
  } catch (err) {
    setStatus('Export error: ' + err.message, 'err')
  }
}

// ── Save ──
window.saveDs = async function() {
  const project = document.getElementById('project-input').value.trim()
  if (!project) { setStatus('Enter a project name first', 'err'); return }
  const btn = document.getElementById('save-btn')
  btn.disabled = true
  try {
    const res = await fetch('/api/design-systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project,
        colors: tokens.colors,
        fonts: tokens.fonts,
        spacing: tokens.spacing,
        radius: tokens.radius,
        darkMode: tokens.darkMode,
        colorFormat: 'hex',
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    await loadDsList()
    document.getElementById('ds-select').value = project
    setStatus('Saved!', 'ok')
  } catch (err) {
    setStatus('Save failed: ' + err.message, 'err')
  } finally {
    btn.disabled = false
  }
}

// ── Status ──
function setStatus(msg, type) {
  const el = document.getElementById('status')
  el.textContent = msg
  el.className = type === 'ok' ? 'status-ok' : type === 'err' ? 'status-err' : ''
}

// ── Start ──
init()
