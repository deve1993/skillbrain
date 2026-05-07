import { api } from '../js/api.js'

// ── Helpers ──
const $ = (s) => document.querySelector(s)
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Accede allo state di studio.js (esposto su window)
function getActiveConvId() { return window.studioState?.activeConvId ?? null }

// ── Utility: chiudi qualsiasi modal overlay ──
window.closeModal = (id) => {
  const el = $(`#${id}`)
  if (el) el.style.display = 'none'
  // cancel any running Kling poll when its modal is closed
  if (id === 'kling-overlay' && window._klingPoll) {
    clearInterval(window._klingPoll); window._klingPoll = null
  }
}

// ── Init: carica statuses e renderizza deploy dropdown ──
async function initConnectors() {
  try {
    const statuses = await api.get('/api/studio/connectors/status')
    renderDeployDropdown(statuses)
  } catch {
    // deploy dropdown opzionale — non blocca l'app
  }
}

function renderDeployDropdown(statuses) {
  const dropdown = document.getElementById('deploy-dropdown')
  if (!dropdown) return

  const CONNECTOR_COLORS = {
    github:    '#6366f1', coolify: '#34d399', unsplash: '#f59e0b',
    kling:     '#ec4899', payload: '#8b5cf6', resend:   '#06b6d4',
    n8n:       '#f97316', plausible: '#a3e635', odoo: '#ef4444',
    nocodb:    '#22d3ee', smtp: '#94a3b8', gdrive: '#4ade80',
  }

  const connectors = [
    { name: 'github',   label: 'GitHub PR',        action: () => openGithubModal() },
    { name: 'coolify',  label: 'Deploy (Coolify)', action: () => openCoolifyModal() },
    { name: 'unsplash', label: 'Unsplash Images',  action: () => openUnsplashModal() },
    { name: 'kling',    label: 'Kling Video',      action: () => openKlingModal() },
    { name: 'payload',  label: 'Payload CMS',      action: () => openPayloadModal() },
    { name: 'resend',   label: 'Resend Email',     action: () => openResendModal() },
    { name: 'n8n',      label: 'n8n Workflow',     action: () => openN8nModal() },
    { name: 'plausible', label: 'Plausible',       action: () => openPlausibleModal() },
    { name: 'odoo',     label: 'Odoo Lead',        action: () => openOdooModal() },
    { name: 'nocodb',   label: 'NocoDB',           action: () => openNocoDbModal() },
    { name: 'smtp',     label: 'SMTP Email',       action: () => openSmtpModal() },
    { name: 'gdrive',   label: 'Google Drive',     action: () => openGDriveModal() },
  ]

  const configured = connectors.filter(c => {
    const status = statuses.find(s => s.name === c.name)
    return status?.configured ?? false
  })

  if (configured.length === 0) {
    dropdown.innerHTML = '<div class="deploy-empty">Nessun connector configurato.<br>Vai in My master.env per aggiungerli.</div>'
    return
  }

  dropdown.innerHTML = configured.map(c => {
    const color = CONNECTOR_COLORS[c.name] ?? '#888'
    return `<div class="deploy-item" data-connector="${c.name}">
      <span class="deploy-dot" style="background:${color}"></span>
      ${escHtml(c.label)}
    </div>`
  }).join('')

  dropdown.querySelectorAll('.deploy-item').forEach(item => {
    const conn = configured.find(c => c.name === item.dataset.connector)
    if (conn) {
      item.addEventListener('click', () => {
        dropdown.classList.remove('open')
        conn.action()
      })
    }
  })
}

// ── GitHub PR ──
function openGithubModal() {
  if (!getActiveConvId()) { window.showToast?.('No conversation selected', 'error'); return }
  $('#github-overlay').style.display = 'flex'
  $('#gh-status').textContent = ''
}

// ── Coolify ──
function openCoolifyModal() {
  if (!getActiveConvId()) { window.showToast?.('No conversation selected', 'error'); return }
  $('#coolify-overlay').style.display = 'flex'
  $('#coolify-status').textContent = ''
}

// ── Unsplash ──
function openUnsplashModal() {
  if (!getActiveConvId()) { window.showToast?.('No conversation selected', 'error'); return }
  $('#unsplash-overlay').style.display = 'flex'
  $('#unsplash-status').textContent = ''
}

// ── Kling ──
function openKlingModal() {
  if (!getActiveConvId()) { window.showToast?.('No conversation selected', 'error'); return }
  $('#kling-overlay').style.display = 'flex'
  $('#kling-status').textContent = ''
}

// Esponi globalmente
window.openGithubModal = openGithubModal
window.openCoolifyModal = openCoolifyModal
window.openUnsplashModal = openUnsplashModal
window.openKlingModal = openKlingModal

// ── Payload ──
function openPayloadModal() {
  if (!getActiveConvId()) { window.showToast?.('No conversation selected', 'error'); return }
  $('#payload-overlay').style.display = 'flex'
  $('#payload-status-msg').textContent = ''
}
window.openPayloadModal = openPayloadModal

// ── Resend ──
function openResendModal() {
  if (!getActiveConvId()) { window.showToast?.('No conversation selected', 'error'); return }
  $('#resend-overlay').style.display = 'flex'
  $('#resend-status').textContent = ''
}
window.openResendModal = openResendModal

// ── n8n ──
function openN8nModal() {
  if (!getActiveConvId()) { window.showToast?.('No conversation selected', 'error'); return }
  $('#n8n-overlay').style.display = 'flex'
  $('#n8n-status').textContent = ''
}
window.openN8nModal = openN8nModal

// ── Plausible ──
async function openPlausibleModal() {
  if (!getActiveConvId()) { window.showToast?.('No conversation selected', 'error'); return }
  $('#plausible-overlay').style.display = 'flex'
  $('#plausible-info').textContent = 'Loading config…'
  $('#btn-plausible-download')?.style && ($('#btn-plausible-download').style.display = 'none')

  try {
    const info = await api.get('/api/studio/connectors/plausible/preview')
    if (info.configured) {
      $('#plausible-info').innerHTML =
        `Site: <strong style="color:var(--accent)">${escHtml(info.siteId)}</strong><br>` +
        `Script: <code style="font-size:10px;color:var(--text-dim)">${escHtml(info.scriptSrc)}</code>`
      $('#btn-plausible-download')?.style && ($('#btn-plausible-download').style.display = 'block')
    } else {
      $('#plausible-info').textContent = `Not configured: ${info.error ?? 'set PLAUSIBLE_SITE_ID'}`
    }
  } catch (e) {
    $('#plausible-info').textContent = `Error: ${e.message}`
  }
}
window.openPlausibleModal = openPlausibleModal

// ── Open functions ──
function openOdooModal() {
  if (!getActiveConvId()) { window.showToast?.('No conversation selected', 'error'); return }
  $('#odoo-overlay').style.display = 'flex'
  $('#odoo-status').textContent = ''
  const state = window.studioState
  const conv = state?.convs?.find(c => c.id === state.activeConvId)
  if (conv) $('#odoo-name').value = conv.title
}
window.openOdooModal = openOdooModal

function openNocoDbModal() {
  $('#nocodb-overlay').style.display = 'flex'
  $('#nocodb-status').textContent = ''
}
window.openNocoDbModal = openNocoDbModal

function openSmtpModal() {
  if (!getActiveConvId()) { window.showToast?.('No conversation selected', 'error'); return }
  $('#smtp-overlay').style.display = 'flex'
  $('#smtp-status').textContent = ''
}
window.openSmtpModal = openSmtpModal

function openGDriveModal() {
  if (!getActiveConvId()) { window.showToast?.('No conversation selected', 'error'); return }
  $('#gdrive-overlay').style.display = 'flex'
  $('#gdrive-status').textContent = ''
}
window.openGDriveModal = openGDriveModal

document.addEventListener('DOMContentLoaded', () => {
  // ── GitHub submit ──
  $('#btn-gh-submit')?.addEventListener('click', async () => {
    const repo = $('#gh-repo')?.value?.trim()
    const base = $('#gh-base')?.value?.trim() || 'main'
    if (!repo) { $('#gh-status').textContent = 'Enter owner/repo'; return }

    const convId = getActiveConvId()
    if (!convId) return

    $('#gh-status').textContent = 'Creating PR…'
    try {
      const result = await api.post(
        `/api/studio/conversations/${convId}/connectors/github-pr`,
        { repo, baseBranch: base },
      )
      $('#gh-status').innerHTML =
        `✓ PR created: <a href="${escHtml(result.prUrl)}" target="_blank" style="color:var(--accent)">#${result.prNumber}</a>`
      window.showToast?.(`PR #${result.prNumber} created`, 'success')
    } catch (e) {
      $('#gh-status').textContent = `Error: ${e.message}`
    }
  })

  // ── Coolify submit ──
  $('#btn-coolify-submit')?.addEventListener('click', async () => {
    const appUuid = $('#coolify-uuid')?.value?.trim()
    if (!appUuid) { $('#coolify-status').textContent = 'Enter App UUID'; return }

    const convId = getActiveConvId()
    if (!convId) return

    $('#coolify-status').textContent = 'Deploying…'
    try {
      const result = await api.post(
        `/api/studio/conversations/${convId}/connectors/coolify-deploy`,
        { appUuid },
      )
      $('#coolify-status').innerHTML =
        `✓ ${escHtml(result.message)} — <a href="${escHtml(result.resourceUrl)}" target="_blank" style="color:var(--accent)">View deployment</a>`
      window.showToast?.('Coolify deploy triggered', 'success')
    } catch (e) {
      $('#coolify-status').textContent = `Error: ${e.message}`
    }
  })

  // ── Unsplash search ──
  $('#btn-unsplash-search')?.addEventListener('click', async () => {
    const q = $('#unsplash-query')?.value?.trim()
    if (!q) return
    $('#unsplash-status').textContent = 'Searching…'
    $('#unsplash-results').innerHTML = ''
    try {
      const photos = await api.get(`/api/studio/connectors/unsplash/search?q=${encodeURIComponent(q)}`)
      if (!photos.length) { $('#unsplash-status').textContent = 'No results'; return }
      $('#unsplash-status').textContent = `${photos.length} results — click to copy URL`
      for (const p of photos) {
        const img = document.createElement('div')
        img.style.cssText =
          'cursor:pointer;position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:4px;border:1px solid var(--border)'
        img.innerHTML = `<img src="${escHtml(p.urls.small)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`
        img.title = p.description ?? p.user.name
        img.onclick = async () => {
          await navigator.clipboard.writeText(p.urls.regular)
          api.post('/api/studio/connectors/unsplash/track', { downloadLocation: p.links.download_location }).catch(() => {})
          window.showToast?.('URL copied to clipboard', 'success')
        }
        $('#unsplash-results').appendChild(img)
      }
    } catch (e) {
      $('#unsplash-status').textContent = `Error: ${e.message}`
    }
  })

  // Enter key on unsplash query triggers search
  $('#unsplash-query')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-unsplash-search')?.click()
  })

  // ── Kling submit ──
  $('#btn-kling-submit')?.addEventListener('click', async () => {
    const prompt = $('#kling-prompt')?.value?.trim()
    if (!prompt) { $('#kling-status').textContent = 'Enter a prompt'; return }

    const convId = getActiveConvId()
    if (!convId) return

    const duration = $('#kling-duration')?.value
    const aspectRatio = $('#kling-ratio')?.value

    $('#kling-status').textContent = 'Submitting task…'
    try {
      const task = await api.post(
        `/api/studio/conversations/${convId}/connectors/kling-video`,
        { prompt, duration, aspectRatio },
      )
      $('#kling-status').textContent = `Task ${task.taskId} — status: ${task.status}. Polling…`
      window.showToast?.(`Kling task submitted: ${task.taskId}`, 'success')

      // Poll ogni 10s fino a succeed/failed (max 12 tentativi = 2min)
      let attempts = 0
      window._klingPoll = setInterval(async () => {
        attempts++
        try {
          const t = await api.get(`/api/studio/connectors/kling-video/${task.taskId}`)
          $('#kling-status').textContent = `Status: ${t.status}`
          if (t.status === 'succeed' && t.videoUrl) {
            clearInterval(window._klingPoll); window._klingPoll = null
            $('#kling-status').innerHTML =
              `✓ Done — <a href="${escHtml(t.videoUrl)}" target="_blank" style="color:var(--accent)">Download video</a>`
            window.showToast?.('Kling video ready', 'success')
          } else if (t.status === 'failed') {
            clearInterval(window._klingPoll); window._klingPoll = null
            $('#kling-status').textContent = 'Generation failed'
          } else if (attempts >= 12) {
            clearInterval(window._klingPoll); window._klingPoll = null
            $('#kling-status').textContent = 'Timed out — check Kling dashboard'
          }
        } catch { clearInterval(window._klingPoll); window._klingPoll = null }
      }, 10_000)
    } catch (e) {
      $('#kling-status').textContent = `Error: ${e.message}`
    }
  })

  // ── Payload submit ──
  $('#btn-payload-submit')?.addEventListener('click', async () => {
    const convId = getActiveConvId()
    if (!convId) return
    const collection = $('#payload-collection')?.value?.trim() || undefined
    const slug       = $('#payload-slug')?.value?.trim() || undefined
    const status     = $('#payload-publish-status')?.value ?? 'draft'

    $('#payload-status-msg').textContent = 'Publishing…'
    try {
      const result = await api.post(
        `/api/studio/conversations/${convId}/connectors/payload-publish`,
        { collection, slug, status },
      )
      $('#payload-status-msg').innerHTML =
        `✓ Published — <a href="${escHtml(result.adminUrl)}" target="_blank" style="color:var(--accent)">Open in CMS</a>`
      window.showToast?.(`Published to Payload: ${result.collection}/${result.id}`, 'success')
    } catch (e) {
      $('#payload-status-msg').textContent = `Error: ${e.message}`
    }
  })

  // ── Resend submit ──
  $('#btn-resend-submit')?.addEventListener('click', async () => {
    const convId = getActiveConvId()
    if (!convId) return
    const to         = $('#resend-to')?.value?.trim()
    const previewUrl = $('#resend-preview-url')?.value?.trim() || undefined
    if (!to) { $('#resend-status').textContent = 'Enter recipient email'; return }

    $('#resend-status').textContent = 'Sending…'
    try {
      const result = await api.post(
        `/api/studio/conversations/${convId}/connectors/resend-email`,
        { to, previewUrl },
      )
      $('#resend-status').textContent = `✓ Email sent (ID: ${result.id})`
      window.showToast?.(`Email sent to ${result.to}`, 'success')
    } catch (e) {
      $('#resend-status').textContent = `Error: ${e.message}`
    }
  })

  // ── n8n submit ──
  $('#btn-n8n-submit')?.addEventListener('click', async () => {
    const convId = getActiveConvId()
    if (!convId) return
    const path = $('#n8n-path')?.value?.trim()
    if (!path) { $('#n8n-status').textContent = 'Enter webhook path'; return }

    $('#n8n-status').textContent = 'Triggering…'
    try {
      const result = await api.post(
        `/api/studio/conversations/${convId}/connectors/n8n-trigger`,
        { webhookPath: path },
      )
      $('#n8n-status').textContent =
        `✓ Triggered — status: ${result.status}${result.executionId ? ` (exec: ${result.executionId})` : ''}`
      window.showToast?.('n8n workflow triggered', 'success')
    } catch (e) {
      $('#n8n-status').textContent = `Error: ${e.message}`
    }
  })

  // ── Plausible inject ──
  $('#btn-plausible-inject')?.addEventListener('click', async () => {
    const convId = getActiveConvId()
    if (!convId) return
    try {
      const result = await api.post(
        `/api/studio/conversations/${convId}/connectors/plausible-inject`, {},
      )
      if (result.injected) {
        await navigator.clipboard.writeText(result.html)
        window.showToast?.(`HTML with Plausible (${result.siteId}) copied to clipboard`, 'success')
        closeModal('plausible-overlay')
      }
    } catch (e) {
      window.showToast?.(`Error: ${e.message}`, 'error')
    }
  })

  // ── Plausible download ──
  $('#btn-plausible-download')?.addEventListener('click', () => {
    const convId = getActiveConvId()
    if (!convId) return
    window.open(`/api/studio/conversations/${convId}/export/html?analytics=plausible`, '_blank')
  })

  // ── Odoo ──
  $('#btn-odoo-submit')?.addEventListener('click', async () => {
    const name = $('#odoo-name')?.value?.trim()
    if (!name) { $('#odoo-status').textContent = 'Name is required'; return }
    $('#odoo-status').textContent = 'Creating lead…'
    try {
      const result = await api.post('/api/studio/connectors/odoo-lead', {
        name,
        email:       $('#odoo-email')?.value?.trim()   || undefined,
        phone:       $('#odoo-phone')?.value?.trim()   || undefined,
        partnerName: $('#odoo-company')?.value?.trim() || undefined,
        description: $('#odoo-desc')?.value?.trim()    || undefined,
      })
      $('#odoo-status').innerHTML =
        `✓ Lead #${result.id} — <a href="${escHtml(result.adminUrl)}" target="_blank" style="color:var(--accent)">Open in Odoo</a>`
      window.showToast?.(`Lead created: ${result.name}`, 'success')
    } catch (e) { $('#odoo-status').textContent = `Error: ${e.message}` }
  })

  // ── NocoDB ──
  $('#btn-nocodb-submit')?.addEventListener('click', async () => {
    const rawRow  = $('#nocodb-row')?.value?.trim()
    const tableId = $('#nocodb-table')?.value?.trim() || undefined
    if (!rawRow) { $('#nocodb-status').textContent = 'Enter row JSON'; return }
    let row
    try { row = JSON.parse(rawRow) } catch {
      $('#nocodb-status').textContent = 'Invalid JSON'; return
    }
    $('#nocodb-status').textContent = 'Inserting…'
    try {
      const result = await api.post('/api/studio/connectors/nocodb-row', { tableId, row })
      $('#nocodb-status').textContent = `✓ Row inserted (id: ${result.id})`
      window.showToast?.('NocoDB row inserted', 'success')
    } catch (e) { $('#nocodb-status').textContent = `Error: ${e.message}` }
  })

  // ── SMTP ──
  $('#btn-smtp-submit')?.addEventListener('click', async () => {
    const convId = getActiveConvId()
    if (!convId) return
    const to      = $('#smtp-to')?.value?.trim()
    const subject = $('#smtp-subject')?.value?.trim()
    if (!to || !subject) { $('#smtp-status').textContent = 'To and Subject required'; return }
    $('#smtp-status').textContent = 'Sending…'
    try {
      const result = await api.post(
        `/api/studio/conversations/${convId}/connectors/smtp-email`,
        {
          to, subject,
          bodyHtml:       $('#smtp-body')?.value?.trim() || undefined,
          attachArtifact: $('#smtp-attach')?.checked ?? false,
        },
      )
      $('#smtp-status').textContent = `✓ Sent (${result.messageId})`
      window.showToast?.(`Email sent to ${result.to}`, 'success')
    } catch (e) { $('#smtp-status').textContent = `Error: ${e.message}` }
  })

  // ── Google Drive ──
  $('#btn-gdrive-submit')?.addEventListener('click', async () => {
    const convId = getActiveConvId()
    if (!convId) return
    const folderId = $('#gdrive-folder')?.value?.trim() || undefined
    $('#gdrive-status').textContent = 'Uploading…'
    try {
      const result = await api.post(
        `/api/studio/conversations/${convId}/connectors/drive-upload`,
        { folderId },
      )
      $('#gdrive-status').innerHTML =
        `✓ Uploaded — <a href="${escHtml(result.webViewLink)}" target="_blank" style="color:var(--accent)">${escHtml(result.name)}</a>`
      window.showToast?.(`Uploaded to Drive: ${result.name}`, 'success')
    } catch (e) { $('#gdrive-status').textContent = `Error: ${e.message}` }
  })

  initConnectors()
})
