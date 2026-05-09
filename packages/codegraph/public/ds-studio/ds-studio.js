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
  palette: {},
  semanticColors: {},
  shadows: {},
  typography: { families: {}, scale: {}, weights: {} },
  effects: {},
  components: {},
  assets: { logoUrl: '', logoWordmark: '', iconLibrary: '' },
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
    if (ds.palette && typeof ds.palette === 'object') tokens.palette = ds.palette
    if (ds.semanticColors && typeof ds.semanticColors === 'object') tokens.semanticColors = ds.semanticColors
    if (ds.shadows && typeof ds.shadows === 'object') tokens.shadows = ds.shadows
    if (ds.typography && typeof ds.typography === 'object') tokens.typography = { families: {}, scale: {}, weights: {}, ...ds.typography }
    if (ds.effects && typeof ds.effects === 'object') tokens.effects = ds.effects
    if (ds.components && typeof ds.components === 'object') tokens.components = ds.components
    if (ds.assets && typeof ds.assets === 'object') tokens.assets = { logoUrl: '', logoWordmark: '', iconLibrary: '', ...ds.assets }
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
    palette: {},
    semanticColors: {},
    shadows: {},
    typography: { families: {}, scale: {}, weights: {} },
    effects: {},
    components: {},
    assets: { logoUrl: '', logoWordmark: '', iconLibrary: '' },
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
  renderPalette()
  renderSemanticColors()
  renderShadows()
  renderTypography()
  renderEffects()
  renderComponents()
  renderAssets()
  updatePreview()
}

function renderColors() {
  document.getElementById('colors-list').innerHTML = Object.entries(tokens.colors).map(([name, val]) => `
    <div class="color-row">
      <input type="color" value="${val}" oninput="setColor('${name}',this.value)">
      <span class="color-name">${name}</span>
      <input class="color-hex" type="text" value="${val}" oninput="setColorHex('${name}',this.value)">
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

function renderPalette() {
  const palette = tokens.palette ?? {}
  document.getElementById('palette-list').innerHTML = Object.entries(palette).map(([group, shades]) => {
    const shadesHtml = Object.entries(shades ?? {}).map(([shade, val]) => `
      <div class="shade-cell">
        <input type="color" value="${val}" oninput="setPaletteShade('${group}','${shade}',this.value)" title="${group}-${shade}">
        <span>${shade}</span>
      </div>
    `).join('')
    return `
      <div class="shade-group">
        <div class="shade-group-name">
          ${group}
          <button class="del-group-btn" onclick="delPaletteGroup('${group}')" title="Remove group">×</button>
        </div>
        <div class="shade-grid">${shadesHtml}</div>
      </div>
    `
  }).join('')
}

function renderSemanticColors() {
  const sem = tokens.semanticColors ?? {}
  document.getElementById('semantic-list').innerHTML = Object.entries(sem).map(([cat, roles]) => {
    const rolesHtml = Object.entries(roles ?? {}).map(([role, val]) => `
      <div class="color-row">
        <input type="color" value="${val}" oninput="setSemColor('${cat}','${role}',this.value)">
        <span class="color-name">${role}</span>
        <input class="color-hex" type="text" value="${val}" oninput="setSemColor('${cat}','${role}',this.value)">
        <button class="del-btn" onclick="delSemRole('${cat}','${role}')">×</button>
      </div>
    `).join('')
    return `
      <div class="sem-category">
        <div class="sem-cat-name">${cat}</div>
        ${rolesHtml}
      </div>
    `
  }).join('')
}

function renderShadows() {
  const shadows = tokens.shadows ?? {}
  document.getElementById('shadows-list').innerHTML = Object.entries(shadows).map(([name, val]) => `
    <div class="shadow-row">
      <span class="shadow-name">${name}</span>
      <input class="shadow-value" type="text" value="${val}" oninput="setShadow('${name}',this.value)" placeholder="0 4px 6px rgba(0,0,0,.1)">
      <div class="shadow-preview" style="box-shadow:${val}"></div>
      <button class="del-btn" onclick="delShadow('${name}')">×</button>
    </div>
  `).join('')
}

function renderTypography() {
  const typo = tokens.typography ?? {}
  renderGrid('typo-families-grid', typo.families ?? {}, 'setTypoFamily')
  renderGrid('typo-weights-grid', typo.weights ?? {}, 'setTypoWeight')
  const scale = typo.scale ?? {}
  document.getElementById('typo-scale-list').innerHTML = Object.entries(scale).map(([step, vals]) => `
    <div class="scale-row">
      <span class="scale-step">${step}</span>
      <input type="text" value="${vals?.size ?? ''}" placeholder="size" oninput="setScaleSize('${step}',this.value)">
      <input type="text" value="${vals?.leading ?? ''}" placeholder="leading" oninput="setScaleLeading('${step}',this.value)">
    </div>
  `).join('')
}

const EFFECT_PRESETS = ['none', 'soft', 'medium', 'intense', 'purple', 'blue', 'rainbow']

function renderEffects() {
  const effects = tokens.effects ?? {}
  document.getElementById('effects-list').innerHTML = Object.entries(effects).map(([name, ef]) => {
    const opts = EFFECT_PRESETS.map(p => `<option value="${p}"${ef?.preset === p ? ' selected' : ''}>${p}</option>`).join('')
    return `
      <div class="effect-row">
        <div class="effect-name">${name}</div>
        <select onchange="setEffectPreset('${name}',this.value)">${opts}</select>
        <textarea class="text-input" placeholder="Custom CSS (optional)" oninput="setEffectCss('${name}',this.value)">${ef?.customCss ?? ''}</textarea>
      </div>
    `
  }).join('')
}

function renderComponents() {
  const comps = tokens.components ?? {}
  document.getElementById('components-list').innerHTML = Object.entries(comps).map(([comp, toks]) => {
    const tokHtml = Object.entries(toks ?? {}).map(([k, v]) => `
      <div class="token-row">
        <label>${k}</label>
        <input type="text" value="${v}" oninput="setCompToken('${comp}','${k}',this.value)">
      </div>
    `).join('')
    return `
      <div class="comp-group">
        <div class="comp-group-name">${comp}</div>
        <div class="token-grid">${tokHtml}</div>
      </div>
    `
  }).join('')
}

function renderAssets() {
  const a = tokens.assets ?? {}
  document.getElementById('asset-logoUrl').value = a.logoUrl ?? ''
  document.getElementById('asset-logoWordmark').value = a.logoWordmark ?? ''
  document.getElementById('asset-iconLibrary').value = a.iconLibrary ?? ''
}

// ── Token setters ──
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

window.setPaletteShade = (group, shade, val) => {
  tokens.palette[group] ??= {}
  tokens.palette[group][shade] = val
  updatePreview()
}
window.delPaletteGroup = (group) => { delete tokens.palette[group]; renderPalette(); updatePreview() }
window.addPaletteGroup = () => {
  const name = prompt('Group name (e.g. brand):')
  if (!name?.trim()) return
  const shades = ['50','100','200','300','400','500','600','700','800','900']
  tokens.palette[name.trim()] = Object.fromEntries(shades.map(s => [s, '#888888']))
  renderPalette()
}

window.setSemColor = (cat, role, val) => {
  tokens.semanticColors[cat] ??= {}
  tokens.semanticColors[cat][role] = val
  updatePreview()
}
window.delSemRole = (cat, role) => {
  delete tokens.semanticColors[cat]?.[role]
  renderSemanticColors()
  updatePreview()
}

window.setShadow = (name, val) => { tokens.shadows[name] = val; renderShadows(); updatePreview() }
window.delShadow = (name) => { delete tokens.shadows[name]; renderShadows(); updatePreview() }
window.addShadow = () => {
  const k = prompt('Shadow name (e.g. card):')
  if (k?.trim()) { tokens.shadows[k.trim()] = '0 4px 6px rgba(0,0,0,0.1)'; renderShadows() }
}

window.setTypoFamily = (k, v) => { tokens.typography.families ??= {}; tokens.typography.families[k] = v; updatePreview() }
window.setTypoWeight = (k, v) => { tokens.typography.weights ??= {}; tokens.typography.weights[k] = v }
window.setScaleSize = (step, v) => {
  tokens.typography.scale ??= {}
  tokens.typography.scale[step] ??= { size: '' }
  tokens.typography.scale[step].size = v
}
window.setScaleLeading = (step, v) => {
  tokens.typography.scale ??= {}
  tokens.typography.scale[step] ??= { size: '' }
  tokens.typography.scale[step].leading = v
}

window.setEffectPreset = (name, val) => { tokens.effects[name] ??= {}; tokens.effects[name].preset = val }
window.setEffectCss = (name, val) => { tokens.effects[name] ??= {}; tokens.effects[name].customCss = val }

window.setCompToken = (comp, k, v) => { tokens.components[comp] ??= {}; tokens.components[comp][k] = v }

// Assets are collected from DOM on save (static inputs)
function collectAssets() {
  return {
    logoUrl: document.getElementById('asset-logoUrl').value.trim(),
    logoWordmark: document.getElementById('asset-logoWordmark').value.trim(),
    iconLibrary: document.getElementById('asset-iconLibrary').value.trim(),
  }
}

// ── Preview ──
function buildPreviewHtml() {
  const pal = tokens.palette ?? {}
  const paletteVars = Object.entries(pal).flatMap(([g, shades]) =>
    Object.entries(shades ?? {}).map(([s, v]) => `--c-${g}-${s}: ${v};`)
  )
  const vars = [
    ...Object.entries(tokens.colors).map(([k, v]) => `--c-${k}: ${v};`),
    ...Object.entries(tokens.fonts).map(([k, v]) => `--f-${k}: ${v};`),
    ...Object.entries(tokens.spacing).map(([k, v]) => `--s-${k}: ${v};`),
    ...Object.entries(tokens.radius).map(([k, v]) => `--r-${k}: ${v};`),
    ...Object.entries(tokens.shadows ?? {}).map(([k, v]) => `--shadow-${k}: ${v};`),
    ...paletteVars,
  ].join(' ')

  const shadowCards = Object.entries(tokens.shadows ?? {}).slice(0, 4).map(([name, val]) =>
    `<div style="display:inline-block;padding:8px 16px;background:#fff;border-radius:6px;box-shadow:${val};font-size:11px;color:#666">${name}</div>`
  ).join('')

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
    .shadow-demo { display:flex; gap:12px; flex-wrap:wrap; padding:8px 0 }
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
    ${shadowCards ? `<div class="shadow-demo">${shadowCards}</div>` : ''}
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
  if (result.palette && typeof result.palette === 'object') tokens.palette = result.palette
  if (result.semanticColors && typeof result.semanticColors === 'object') tokens.semanticColors = result.semanticColors
  if (result.shadows && typeof result.shadows === 'object') tokens.shadows = result.shadows
  if (result.typography && typeof result.typography === 'object') {
    tokens.typography = { families: {}, scale: {}, weights: {}, ...result.typography }
  }
  if (result.effects && typeof result.effects === 'object') tokens.effects = result.effects
  if (result.components && typeof result.components === 'object') tokens.components = result.components
  if (result.assets && typeof result.assets === 'object') tokens.assets = { ...tokens.assets, ...result.assets }
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
    if (result.colors && Object.keys(result.colors).length) tokens.colors = { ...tokens.colors, ...result.colors }
    if (result.fonts && Object.keys(result.fonts).length) tokens.fonts = { ...tokens.fonts, ...result.fonts }
    if (result.spacing && Object.keys(result.spacing).length) tokens.spacing = { ...tokens.spacing, ...result.spacing }
    if (result.radius && Object.keys(result.radius).length) tokens.radius = { ...tokens.radius, ...result.radius }
    if (result.palette && typeof result.palette === 'object') tokens.palette = { ...tokens.palette, ...result.palette }
    if (result.semanticColors && typeof result.semanticColors === 'object') tokens.semanticColors = { ...tokens.semanticColors, ...result.semanticColors }
    if (result.shadows && typeof result.shadows === 'object') tokens.shadows = { ...tokens.shadows, ...result.shadows }
    if (result.typography && typeof result.typography === 'object') {
      tokens.typography = {
        families: { ...tokens.typography.families, ...result.typography.families },
        scale: { ...tokens.typography.scale, ...result.typography.scale },
        weights: { ...tokens.typography.weights, ...result.typography.weights },
      }
    }
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
    const assets = collectAssets()
    const res = await fetch('/api/design-systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project,
        colors: tokens.colors,
        fonts: tokens.fonts,
        spacing: tokens.spacing,
        radius: tokens.radius,
        palette: tokens.palette,
        semanticColors: tokens.semanticColors,
        shadows: tokens.shadows,
        typography: tokens.typography,
        effects: tokens.effects,
        components: tokens.components,
        assets,
        darkMode: tokens.darkMode,
        colorFormat: 'hex',
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    tokens.assets = assets
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
