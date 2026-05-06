// Custom tooltip ("nuvoletta") for any element with a `title` attribute.
// Removes the native title to avoid double display, parses an optional `(KEY)`
// suffix as a keyboard hint, and shows a small floating bubble after a short
// delay. Updates position on scroll/resize.

const SHOW_DELAY_MS = 250
const HIDE_DELAY_MS = 80

let tipEl = null
let showTimer = null
let hideTimer = null
let currentTarget = null

function ensureBubble() {
  if (tipEl) return tipEl
  tipEl = document.createElement('div')
  tipEl.className = 'wb-tooltip'
  tipEl.style.display = 'none'
  document.body.appendChild(tipEl)
  return tipEl
}

function buildContent(text) {
  // Parse trailing "(KEY)" e.g. "Sticky note (S)" → text="Sticky note", kbd="S"
  const m = text.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (!m) return `<span class="t">${escape(text)}</span>`
  const label = m[1].trim()
  const keys = m[2].trim().split(/\s*[+/]\s*/).map((k) => `<kbd>${escape(k)}</kbd>`).join(' ')
  return `<span class="t">${escape(label)}</span><span class="k">${keys}</span>`
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[c])
}

function position(target) {
  if (!tipEl) return
  const r = target.getBoundingClientRect()
  const tipR = tipEl.getBoundingClientRect()
  // Default: below the element, centered
  let top = r.bottom + 8
  let left = r.left + r.width / 2 - tipR.width / 2
  let arrow = 'top'  // arrow on top of bubble (pointing up to target above)
  // If would clip the bottom, place above
  if (top + tipR.height > window.innerHeight - 8) {
    top = r.top - tipR.height - 8
    arrow = 'bottom'
  }
  // Clamp horizontally
  left = Math.max(8, Math.min(window.innerWidth - tipR.width - 8, left))
  tipEl.style.top = top + 'px'
  tipEl.style.left = left + 'px'
  tipEl.dataset.arrow = arrow
}

function show(target, text) {
  if (!text) return
  ensureBubble()
  tipEl.innerHTML = buildContent(text)
  tipEl.style.display = 'flex'
  position(target)
  // Re-position after layout settles (innerHTML sized)
  requestAnimationFrame(() => position(target))
}

function hide() {
  if (tipEl) tipEl.style.display = 'none'
}

function isTooltipTarget(el) {
  if (!el || el === document || el === window) return null
  // Skip if inside a textarea/input — let users focus normally
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return null
  // Walk up to find an element with title, data-tip, or previously-stripped data-native-title
  let cur = el
  for (let i = 0; i < 8 && cur && cur !== document.body; i++) {
    const text = cur.dataset?.tip
      || cur.getAttribute?.('title')
      || cur.dataset?.nativeTitle
    if (text) return { el: cur, text }
    cur = cur.parentElement
  }
  return null
}

function stripNativeTitlesIn(root) {
  for (const el of root.querySelectorAll('[title]')) {
    if (!el.dataset.nativeTitle) el.dataset.nativeTitle = el.getAttribute('title')
    el.removeAttribute('title')
  }
}

export function initTooltips() {
  // Strip ALL existing titles upfront so the native browser tooltip never appears.
  // Save original to dataset.nativeTitle so the fallback in isTooltipTarget keeps working.
  stripNativeTitlesIn(document)
  // Watch for newly added elements (panels, modals, dynamic toolbars) and strip their titles too.
  const obs = new MutationObserver((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (node.nodeType !== 1) continue
        if (node.hasAttribute && node.hasAttribute('title')) {
          if (!node.dataset.nativeTitle) node.dataset.nativeTitle = node.getAttribute('title')
          node.removeAttribute('title')
        }
        if (node.querySelectorAll) stripNativeTitlesIn(node)
      }
    }
  })
  obs.observe(document.body, { childList: true, subtree: true })

  document.addEventListener('mouseover', (e) => {
    const found = isTooltipTarget(e.target)
    if (!found) return
    if (currentTarget === found.el) return
    // Defer: only show after delay
    clearTimeout(hideTimer); hideTimer = null
    clearTimeout(showTimer)
    currentTarget = found.el
    showTimer = setTimeout(() => show(found.el, found.text), SHOW_DELAY_MS)
  })
  document.addEventListener('mouseout', (e) => {
    const found = isTooltipTarget(e.target)
    if (!found) return
    clearTimeout(showTimer); showTimer = null
    hideTimer = setTimeout(() => {
      hide()
      currentTarget = null
    }, HIDE_DELAY_MS)
  })
  // Hide on scroll/resize/escape
  window.addEventListener('scroll', hide, true)
  window.addEventListener('resize', hide)
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide() })
  // Hide on mousedown (user is acting now)
  window.addEventListener('mousedown', hide, true)
}
