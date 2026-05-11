# Studio UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign SkillBrain Studio from a 3-column fixed layout to a tab-based IDE-style layout with large preview, pipeline generation feedback, and clean export/deploy toolbar.

**Architecture:** Full rewrite of `index.html` (structure + CSS) and `studio.js` (state machine + rendering). `connectors.js` receives minor updates for the Deploy dropdown. Backend (Express routes, MCP tools, SQLite store) is untouched — only the three frontend files change.

**Tech Stack:** Vanilla JS (ESM), CSS custom properties from `../style.css` (SkillBrain dark theme), native `EventSource` for SSE, `fetch` via `../js/api.js`. No build step — files are served as static assets from `packages/codegraph/public/`.

**Design spec:** `docs/superpowers/specs/2026-05-07-studio-ux-redesign-design.md`

**Server:** Already running at `http://localhost:3737`. After each HTML/CSS task, open the browser to verify visually. After each JS task, use the browser console to confirm no errors.

---

## File Map

| File | Change |
|------|--------|
| `packages/codegraph/public/studio/index.html` | Full rewrite — new layout, new CSS |
| `packages/codegraph/public/studio/studio.js` | Full rewrite — new state machine and rendering |
| `packages/codegraph/public/studio/connectors.js` | Patch — populate `Deploy ▾` dropdown instead of `#connector-bar` |

---

## API Reference

All calls use `api` from `../js/api.js` (wraps `fetch`, throws on non-2xx).

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/api/studio/conversations` | `{ conversations: Conv[] }` |
| POST | `/api/studio/conversations` | `Conv` |
| GET | `/api/studio/conversations/:id` | `Conv` |
| DELETE | `/api/studio/conversations/:id` | `{ ok: true }` |
| GET | `/api/studio/conversations/:id/messages` | `{ messages: Msg[] }` |
| POST | `/api/studio/conversations/:id/generate` | `{ jobId: string }` |
| GET | `/api/studio/conversations/:id/export/html` | HTML file |
| GET | `/api/studio/conversations/:id/export/md` | MD file |
| GET | `/api/studio/conversations/:id/export/bundle` | `{ artifactHtml, messages, … }` |
| POST | `/api/studio/import` | `Conv` |
| GET | `/api/studio/skills` | `{ skills: Skill[] }` |
| GET | `/api/studio/design-systems` | `{ designSystems: DS[] }` |
| GET | `/api/studio/directions` | `{ directions: Dir[] }` |

SSE endpoint: `EventSource('/api/studio/jobs/:jobId/stream')`
SSE event types: `start` · `status` · `chunk` · `artifact` (with `.html`) · `critique` (with `.json`) · `slop` · `done` · `error` (with `.message`)

`Conv` shape: `{ id, title, status, skillId, dsId, directionId, briefData, createdAt, updatedAt }`
`Skill/DS/Dir` shape: `{ id, name }`

---

## Task 1: New HTML structure + CSS

**Goal:** Replace the entire contents of `index.html` with the new 3-zone layout (header-tabs / main / bottom-bar). No JS logic yet — just the skeleton and styles. The page should render with correct layout but empty/static content.

**Files:**
- Rewrite: `packages/codegraph/public/studio/index.html`

- [ ] **Step 1: Replace index.html with new structure**

Write the complete file. Keep the existing `<script>` tags at the bottom pointing to `studio.js` and `connectors.js`. Keep the JSZip CDN script.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SkillBrain Studio</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="../style.css">
  <style>
    /* ── Reset ── */
    html, body { height: 100%; overflow: hidden; }
    body { flex-direction: column; min-height: unset; }

    /* ── Header ── */
    .s-header {
      height: 44px; background: var(--card); border-bottom: 1px solid var(--border);
      display: flex; align-items: center; padding: 0 14px; gap: 0; flex-shrink: 0; z-index: 10;
    }
    .s-logo {
      display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 800;
      background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      margin-right: 16px; flex-shrink: 0; white-space: nowrap;
    }
    .s-logo svg { width: 16px; height: 16px; stroke: #8b5cf6; flex-shrink: 0; }

    /* ── Tab bar ── */
    .tab-bar {
      display: flex; align-items: flex-end; height: 44px; flex: 1;
      overflow-x: auto; overflow-y: hidden; gap: 2px;
    }
    .tab-bar::-webkit-scrollbar { display: none; }
    .s-tab {
      display: flex; align-items: center; gap: 6px; padding: 0 12px;
      height: 36px; border-radius: 6px 6px 0 0; font-size: 11px; color: var(--text-muted);
      cursor: pointer; border: 1px solid transparent; border-bottom: none;
      transition: all .15s; flex-shrink: 0; user-select: none; white-space: nowrap;
      background: transparent;
    }
    .s-tab.active {
      background: var(--bg); border-color: var(--border); color: var(--text);
    }
    .s-tab:hover:not(.active) { color: var(--text-dim); }
    .tab-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .tab-dot.idle { background: transparent; border: 1px solid var(--text-muted); }
    .tab-dot.generating { background: var(--accent); animation: pulse 1.5s infinite; }
    .tab-dot.done { background: var(--green); }
    .tab-close {
      color: var(--text-muted); font-size: 10px; margin-left: 2px; line-height: 1;
      padding: 1px 2px; border-radius: 2px;
    }
    .tab-close:hover { color: var(--text); background: rgba(255,255,255,.08); }
    .tab-new {
      padding: 0 10px; color: var(--text-muted); font-size: 18px; line-height: 1;
      cursor: pointer; align-self: center; margin-left: 2px; flex-shrink: 0;
    }
    .tab-new:hover { color: var(--text); }

    /* ── Header actions ── */
    .h-actions { display: flex; align-items: center; gap: 8px; margin-left: 12px; flex-shrink: 0; }
    .btn-generate {
      display: flex; align-items: center; gap: 5px; padding: 6px 16px;
      background: linear-gradient(135deg, var(--accent2), var(--accent));
      border: none; border-radius: 6px; color: #fff; font-size: 11px; font-weight: 700;
      cursor: pointer; font-family: var(--font); transition: opacity .15s;
    }
    .btn-generate:hover { opacity: .88; }
    .btn-generate:disabled { opacity: .4; cursor: not-allowed; }

    /* ── Main ── */
    .s-main { display: flex; flex: 1; overflow: hidden; }

    /* ── Preview column ── */
    .preview-col { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

    .preview-toolbar {
      height: 36px; background: var(--card); border-bottom: 1px solid var(--border);
      display: flex; align-items: center; padding: 0 10px; gap: 5px; flex-shrink: 0;
    }
    .pt-label { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); font-weight: 600; }
    .pt-sep { width: 1px; height: 14px; background: var(--border); margin: 0 2px; flex-shrink: 0; }
    .pt-spacer { flex: 1; }
    .pt-btn {
      padding: 3px 8px; border-radius: 4px; background: transparent;
      border: 1px solid var(--border); color: var(--text-muted); font-size: 10px;
      cursor: pointer; font-family: var(--font); transition: all .15s;
    }
    .pt-btn:hover:not(:disabled) { border-color: var(--border-hover); color: var(--text); }
    .pt-btn:disabled { opacity: .35; cursor: not-allowed; }
    .pt-btn.export { border-color: rgba(139,92,246,.3); color: #a78bfa; background: rgba(139,92,246,.06); }
    .pt-btn.export:hover:not(:disabled) { background: rgba(139,92,246,.12); }
    .pt-btn.deploy { border-color: rgba(52,211,153,.3); color: #34d399; background: rgba(52,211,153,.06); position: relative; }
    .pt-btn.deploy:hover:not(:disabled) { background: rgba(52,211,153,.12); }

    /* Deploy dropdown */
    .deploy-dropdown {
      position: absolute; top: calc(100% + 6px); right: 0; z-index: 100;
      background: var(--card); border: 1px solid var(--border); border-radius: 8px;
      padding: 6px 0; min-width: 200px; box-shadow: 0 8px 24px rgba(0,0,0,.4);
      display: none;
    }
    .deploy-dropdown.open { display: block; }
    .deploy-item {
      display: flex; align-items: center; gap: 8px; padding: 7px 14px;
      font-size: 12px; color: var(--text-dim); cursor: pointer; transition: background .1s;
    }
    .deploy-item:hover { background: rgba(255,255,255,.04); color: var(--text); }
    .deploy-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .deploy-empty { padding: 10px 14px; font-size: 11px; color: var(--text-muted); }

    /* ── Preview body ── */
    .preview-body { flex: 1; overflow: hidden; position: relative; background: #090910; }

    .preview-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; gap: 10px; color: var(--text-muted);
    }
    .preview-empty svg { width: 44px; height: 44px; stroke: var(--text-muted); opacity: .25; }
    .preview-empty .pe-title { font-size: 13px; }
    .preview-empty .pe-sub { font-size: 11px; opacity: .5; }

    .preview-generating {
      display: none; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; gap: 12px;
    }
    .pulse-wrap { position: relative; width: 72px; height: 72px; display: flex; align-items: center; justify-content: center; }
    .pulse-ring {
      position: absolute; border-radius: 50%; border: 1px solid rgba(139,92,246,.25);
      animation: pulse-expand 2s ease-out infinite;
    }
    .pulse-ring:nth-child(1) { width: 72px; height: 72px; }
    .pulse-ring:nth-child(2) { width: 48px; height: 48px; animation-delay: .5s; }
    @keyframes pulse-expand { 0% { opacity: .7; transform: scale(1); } 100% { opacity: 0; transform: scale(1.25); } }
    .pulse-core {
      width: 28px; height: 28px; border-radius: 50%; background: rgba(139,92,246,.15);
      display: flex; align-items: center; justify-content: center; color: var(--accent); font-size: 13px;
    }
    .preview-gen-label { font-size: 12px; color: var(--accent); }
    .preview-gen-sub { font-size: 10px; color: var(--text-muted); }

    #preview-iframe { width: 100%; height: 100%; border: none; display: none; }

    /* ── Right panel ── */
    .right-panel {
      width: 280px; background: var(--card); border-left: 1px solid var(--border);
      display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
    }

    /* Config chips bar */
    .config-bar {
      padding: 7px 10px; border-bottom: 1px solid var(--border);
      display: flex; flex-wrap: wrap; gap: 4px; align-items: center; flex-shrink: 0; min-height: 38px;
    }
    .config-chip {
      padding: 2px 9px; border-radius: 10px; font-size: 10px; white-space: nowrap;
      background: rgba(167,139,250,.1); border: 1px solid rgba(167,139,250,.25); color: var(--accent);
    }
    .config-chip.placeholder {
      background: transparent; border: 1px dashed var(--border); color: var(--text-muted); cursor: pointer;
    }
    .config-chip.placeholder:hover { border-color: var(--accent); color: var(--accent); }
    .config-edit-btn {
      margin-left: auto; padding: 2px 8px; border-radius: 4px; font-size: 10px;
      background: transparent; border: 1px solid var(--border); color: var(--text-muted);
      cursor: pointer; font-family: var(--font); flex-shrink: 0;
    }
    .config-edit-btn:hover { border-color: var(--border-hover); color: var(--text-dim); }

    /* Chat area */
    .chat-area { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .chat-empty {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; padding: 20px; text-align: center; color: var(--text-muted);
    }
    .chat-empty-icon { font-size: 24px; opacity: .2; }

    /* Chat messages */
    .msg { display: flex; gap: 7px; }
    .msg.msg-ai { flex-direction: row; }
    .msg-av {
      width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; margin-top: 2px;
      display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700;
    }
    .msg-av.user { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
    .msg-av.ai   { background: linear-gradient(135deg, #059669, var(--green)); color: #fff; }
    .msg-bubble {
      border-radius: 0 8px 8px 8px; padding: 7px 10px; font-size: 11px; line-height: 1.5;
      color: var(--text-dim); max-width: 210px;
    }
    .msg-bubble.user-b { background: rgba(255,255,255,.04); border-radius: 0 8px 8px 8px; }
    .msg-bubble.ai-b   { background: rgba(52,211,153,.06); border-radius: 8px 0 8px 8px; }

    /* Pipeline block */
    .pipeline-block {
      background: rgba(139,92,246,.05); border: 1px solid rgba(139,92,246,.12);
      border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; gap: 5px;
      font-size: 10px; margin-top: 4px;
    }
    .pipe-step { display: flex; align-items: center; gap: 7px; }
    .pipe-icon {
      width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center;
      justify-content: center; font-size: 8px; flex-shrink: 0;
    }
    .pipe-icon.done    { background: rgba(52,211,153,.15); color: var(--green); }
    .pipe-icon.active  { border: 2px solid var(--accent); border-top-color: transparent; animation: spin .7s linear infinite; }
    .pipe-icon.pending { background: rgba(255,255,255,.04); color: var(--text-muted); }
    .pipe-icon.error   { background: rgba(248,113,113,.15); color: var(--red); }
    @keyframes spin { to { transform: rotate(360deg); } }
    .pipe-label { color: var(--text-dim); flex: 1; }
    .pipe-label.active  { color: var(--accent); font-weight: 600; }
    .pipe-label.done    { color: var(--text-muted); }
    .pipe-label.pending { color: var(--text-muted); opacity: .5; }
    .pipe-skill {
      font-size: 9px; color: var(--accent); background: rgba(139,92,246,.1);
      padding: 1px 5px; border-radius: 3px; white-space: nowrap;
    }
    .pipeline-summary {
      font-size: 10px; color: var(--text-muted); padding: 6px 10px;
      background: rgba(52,211,153,.05); border: 1px solid rgba(52,211,153,.1); border-radius: 6px;
    }

    /* Critique bar */
    .critique-bar {
      padding: 6px 10px; border-top: 1px solid var(--border);
      display: none; align-items: center; gap: 6px; flex-shrink: 0; font-size: 10px;
    }
    .critique-bar.visible { display: flex; }
    .critique-score {
      background: rgba(52,211,153,.1); border: 1px solid rgba(52,211,153,.2);
      color: var(--green); padding: 1px 7px; border-radius: 4px; font-size: 10px;
    }
    .critique-detail-toggle { margin-left: auto; color: var(--text-muted); cursor: pointer; font-size: 10px; }
    .critique-detail-toggle:hover { color: var(--text-dim); }
    .critique-detail {
      display: none; padding: 0 10px 8px; border-top: 1px solid var(--border);
      font-size: 10px; flex-shrink: 0;
    }
    .critique-detail.open { display: block; }
    .critique-row {
      display: flex; align-items: center; gap: 8px; padding: 4px 0;
      border-bottom: 1px solid rgba(255,255,255,.03); color: var(--text-dim);
    }
    .critique-row:last-child { border: none; }
    .c-check { width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; flex-shrink: 0; }
    .c-check.pass { background: rgba(52,211,153,.15); color: var(--green); }
    .c-check.fail { background: rgba(248,113,113,.15); color: var(--red); }

    /* ── Brief / Edit side sheet ── */
    .side-sheet {
      position: absolute; top: 0; right: 0; width: 280px; height: 100%;
      background: var(--card); border-left: 1px solid var(--border); z-index: 20;
      display: flex; flex-direction: column; transform: translateX(100%);
      transition: transform .2s ease; box-shadow: -4px 0 16px rgba(0,0,0,.3);
    }
    .side-sheet.open { transform: translateX(0); }
    .sheet-header {
      padding: 12px 14px; border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }
    .sheet-title { font-size: 13px; font-weight: 600; color: var(--text); flex: 1; }
    .sheet-close {
      background: transparent; border: none; color: var(--text-muted); font-size: 16px;
      cursor: pointer; padding: 2px 6px; border-radius: 4px;
    }
    .sheet-close:hover { color: var(--text); background: rgba(255,255,255,.06); }
    .sheet-body { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 14px; }
    .sheet-section { display: flex; flex-direction: column; gap: 6px; }
    .sheet-label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); font-weight: 600; }
    .sheet-pills { display: flex; flex-wrap: wrap; gap: 5px; }
    .sheet-pill {
      padding: 4px 11px; border-radius: 20px; background: rgba(255,255,255,.04);
      border: 1px solid var(--border); color: var(--text-dim); font-size: 11px; cursor: pointer;
      transition: all .15s; font-family: var(--font);
    }
    .sheet-pill:hover { border-color: var(--border-hover); color: var(--text); }
    .sheet-pill.selected { background: rgba(167,139,250,.12); border-color: var(--accent); color: var(--accent); }
    .sheet-select {
      width: 100%; background: rgba(255,255,255,.04); border: 1px solid var(--border);
      border-radius: 6px; padding: 7px 28px 7px 10px; color: var(--text); font-size: 12px;
      font-family: var(--font); outline: none; appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23777' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 8px center;
    }
    .sheet-select:focus { border-color: var(--accent); }
    .sheet-input {
      width: 100%; background: rgba(255,255,255,.04); border: 1px solid var(--border);
      border-radius: 6px; padding: 7px 10px; color: var(--text); font-size: 12px;
      font-family: var(--font); outline: none;
    }
    .sheet-input:focus { border-color: var(--accent); }
    .sheet-model-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .sheet-model-label { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); margin-bottom: 4px; }
    .sheet-footer {
      padding: 12px 14px; border-top: 1px solid var(--border);
      display: flex; gap: 8px; flex-shrink: 0;
    }
    .sheet-btn {
      flex: 1; padding: 7px; border-radius: 6px; font-size: 11px; font-weight: 600;
      cursor: pointer; font-family: var(--font); transition: opacity .15s;
    }
    .sheet-btn.primary { background: linear-gradient(135deg, var(--accent2), var(--accent)); border: none; color: #fff; }
    .sheet-btn.primary:hover { opacity: .88; }
    .sheet-btn.ghost { background: transparent; border: 1px solid var(--border); color: var(--text-dim); }
    .sheet-btn.ghost:hover { border-color: var(--border-hover); color: var(--text); }

    /* Brief fields */
    .brief-fields { display: flex; flex-direction: column; gap: 10px; }
    .brief-field label { font-size: 10px; color: var(--text-muted); display: block; margin-bottom: 4px; }

    /* ── Bottom bar ── */
    .bottom-bar {
      background: var(--card); border-top: 1px solid var(--border);
      padding: 8px 12px; display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
    }
    .brief-trigger {
      display: flex; align-items: center; gap: 4px; padding: 6px 10px;
      background: transparent; border: 1px solid var(--border); border-radius: 6px;
      color: var(--text-muted); font-size: 11px; cursor: pointer; font-family: var(--font);
      flex-shrink: 0; transition: all .15s; white-space: nowrap; align-self: flex-end;
    }
    .brief-trigger:hover { border-color: var(--border-hover); color: var(--text-dim); }
    .prompt-textarea {
      flex: 1; background: rgba(255,255,255,.03); border: 1px solid var(--border);
      border-radius: 6px; padding: 7px 11px; color: var(--text); font-size: 12px;
      font-family: var(--font); outline: none; resize: none; line-height: 1.5;
      min-height: 36px; max-height: 100px; overflow-y: auto;
    }
    .prompt-textarea:focus { border-color: rgba(167,139,250,.4); }
    .prompt-textarea::placeholder { color: var(--text-muted); }
    .send-btn {
      padding: 6px 14px; border-radius: 6px; background: rgba(167,139,250,.12);
      border: 1px solid rgba(167,139,250,.25); color: var(--accent); font-size: 11px;
      font-weight: 600; cursor: pointer; font-family: var(--font); flex-shrink: 0;
      transition: all .15s; align-self: flex-end;
    }
    .send-btn:hover { background: rgba(167,139,250,.2); }
    .send-btn:disabled { opacity: .4; cursor: not-allowed; }

    /* ── Toast ── */
    .toast {
      position: fixed; top: 14px; right: 14px; z-index: 9999; padding: 8px 14px;
      border-radius: 6px; font-size: 12px; font-weight: 600; animation: fadeIn .2s ease;
    }
    .toast.info    { background: rgba(167,139,250,.15); border: 1px solid rgba(167,139,250,.3); color: var(--accent); }
    .toast.success { background: rgba(52,211,153,.12); border: 1px solid rgba(52,211,153,.25); color: var(--green); }
    .toast.error   { background: rgba(248,113,113,.12); border: 1px solid rgba(248,113,113,.25); color: var(--red); }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
</head>
<body>

  <!-- ═══ HEADER ═══ -->
  <header class="s-header">
    <div class="s-logo">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
        <polyline points="2 17 12 22 22 17"/>
        <polyline points="2 12 12 17 22 12"/>
      </svg>
      Studio
    </div>
    <div class="tab-bar" id="tab-bar">
      <!-- tabs injected by JS -->
    </div>
    <div class="h-actions">
      <button class="btn-generate" id="btn-generate" disabled>⚡ Generate</button>
    </div>
  </header>

  <!-- ═══ MAIN ═══ -->
  <div class="s-main" style="position:relative">

    <!-- ─── Preview column ─── -->
    <div class="preview-col">

      <div class="preview-toolbar">
        <span class="pt-label">Preview</span>
        <div class="pt-spacer"></div>
        <button class="pt-btn" id="btn-refresh" disabled>↻ Refresh</button>
        <button class="pt-btn" id="btn-fullscreen" disabled>⤢</button>
        <div class="pt-sep"></div>
        <button class="pt-btn export" id="btn-export-html" disabled>HTML</button>
        <button class="pt-btn export" id="btn-export-zip" disabled>ZIP</button>
        <div class="pt-sep"></div>
        <div style="position:relative">
          <button class="pt-btn deploy" id="btn-deploy" disabled>Deploy ▾</button>
          <div class="deploy-dropdown" id="deploy-dropdown">
            <!-- populated by connectors.js -->
          </div>
        </div>
      </div>

      <div class="preview-body">
        <!-- Empty -->
        <div class="preview-empty" id="preview-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span class="pe-title">Preview — start a conversation</span>
          <span class="pe-sub">Generate a design to see it here</span>
        </div>
        <!-- Generating -->
        <div class="preview-generating" id="preview-generating">
          <div class="pulse-wrap">
            <div class="pulse-ring"></div>
            <div class="pulse-ring"></div>
            <div class="pulse-core">⬡</div>
          </div>
          <div class="preview-gen-label">Generazione in corso…</div>
          <div class="preview-gen-sub">Il preview apparirà al termine</div>
        </div>
        <!-- Iframe -->
        <iframe id="preview-iframe" sandbox="allow-scripts allow-same-origin"></iframe>
      </div>

    </div>

    <!-- ─── Right panel ─── -->
    <div class="right-panel">

      <div class="config-bar" id="config-bar">
        <!-- chips injected by JS -->
      </div>

      <div class="chat-area" id="chat-area">
        <div class="chat-empty" id="chat-empty">
          <div class="chat-empty-icon">💬</div>
          <div style="font-size:11px">La chat apparirà qui dopo la generazione</div>
        </div>
      </div>

      <div class="critique-bar" id="critique-bar">
        <span style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted)">Critique</span>
        <span class="critique-score" id="critique-score">—</span>
        <span class="critique-detail-toggle" id="critique-toggle">▾ dettaglio</span>
      </div>
      <div class="critique-detail" id="critique-detail"></div>

      <!-- Brief / Edit side sheet -->
      <div class="side-sheet" id="side-sheet">
        <div class="sheet-header">
          <span class="sheet-title" id="sheet-title">Config</span>
          <button class="sheet-close" id="sheet-close">✕</button>
        </div>
        <div class="sheet-body" id="sheet-body">
          <!-- populated by JS based on mode: 'edit' or 'brief' -->
        </div>
        <div class="sheet-footer" id="sheet-footer">
          <button class="sheet-btn ghost" id="sheet-cancel">Annulla</button>
          <button class="sheet-btn primary" id="sheet-apply">Applica</button>
        </div>
      </div>

    </div>
  </div>

  <!-- ═══ BOTTOM BAR ═══ -->
  <div class="bottom-bar">
    <button class="brief-trigger" id="btn-brief">⚙ Brief</button>
    <textarea class="prompt-textarea" id="prompt-textarea" rows="1" placeholder="Descrivi cosa generare…"></textarea>
    <button class="send-btn" id="btn-send" disabled>↵ Send</button>
  </div>

  <script type="module" src="studio.js"></script>
  <script type="module" src="connectors.js"></script>
</body>
</html>
```

- [ ] **Step 2: Open in browser and verify layout**

Navigate to `http://localhost:3737/studio/`. Verify:
- Header with "⬡ Studio" logo, empty tab-bar, disabled Generate button
- Preview area with empty state icon
- Right panel visible on the right (280px wide)
- Bottom bar at the bottom with `⚙ Brief`, textarea, Send button

Expected: Layout renders correctly. Console may show JS errors (studio.js not yet updated) — that's fine for now.

- [ ] **Step 3: Commit**

```bash
cd "packages/codegraph/public/studio"
git add index.html
git commit -m "feat(studio): new HTML+CSS layout — tabs, preview col, right panel, bottom bar"
```

---

## Task 2: Core state + tab management

**Goal:** Rewrite `studio.js` from scratch with the new state model. Implement conversation loading, tab rendering (create/switch/close), and the `window.studioState` export for `connectors.js`.

**Files:**
- Rewrite: `packages/codegraph/public/studio/studio.js`

- [ ] **Step 1: Write the new studio.js skeleton with state + tab functions**

Replace the entire file with this new version. At this stage only `loadConvs`, `renderTabs`, `selectConv`, `deleteConv`, and `createConv` are implemented. All other functions are stubs (empty or `console.log`).

```js
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
    state.convs = result.conversations ?? []
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
    const messages = msgsResult.messages ?? []

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
```

- [ ] **Step 2: Verify tabs in browser**

Open `http://localhost:3737/studio/`. Expect:
- Conversation tabs rendered in the header
- Clicking a tab switches active conv (border highlight)
- `+` button opens a new tab and calls `openSheet('brief')` (which logs nothing yet)
- `✕` on tab deletes after confirm

Open browser console — expect no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/codegraph/public/studio/studio.js
git commit -m "feat(studio): core state + tab management"
```

---

## Task 3: Config bar + Side sheet (pickers + brief)

**Goal:** Implement `renderConfigBar()`, `openSheet()`, `closeSheet()`, and the side sheet body rendering for both "edit" mode (skill/DS/direction/model pickers) and "brief" mode (Surface/Audience/Tone/Brand/Scale form).

**Files:**
- Modify: `packages/codegraph/public/studio/studio.js`

- [ ] **Step 1: Load pickers data**

Add after the `init()` function call at the bottom, and add `loadPickers()` call inside `init()`:

```js
async function loadPickers() {
  try {
    const [sr, dr, dir] = await Promise.all([
      api.get('/api/studio/skills'),
      api.get('/api/studio/design-systems'),
      api.get('/api/studio/directions'),
    ])
    state.pickers.skills = sr.skills ?? []
    state.pickers.ds = dr.designSystems ?? []
    state.pickers.directions = dir.directions ?? []
  } catch (e) {
    toast(`Failed to load pickers: ${e.message}`, 'error')
  }
}
```

In `init()`, add `await loadPickers()` before `await loadConvs()`.

- [ ] **Step 2: Replace `renderConfigBar` stub**

```js
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
```

- [ ] **Step 3: Replace `openSheet` and `closeSheet` stubs**

```js
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
    // Bind pill clicks
    body.querySelectorAll('[data-skill]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selected.skillId = btn.dataset.skill === state.selected.skillId ? null : btn.dataset.skill
        body.innerHTML = renderEditSheetBody()
        bindEditSheetPills(body)
        renderConfigBar()
      })
    })
    body.querySelectorAll('[data-ds]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selected.dsId = btn.dataset.ds === state.selected.dsId ? null : btn.dataset.ds
        body.innerHTML = renderEditSheetBody()
        bindEditSheetPills(body)
        renderConfigBar()
      })
    })
    body.querySelectorAll('[data-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selected.directionId = btn.dataset.dir === state.selected.directionId ? null : btn.dataset.directionId
        body.innerHTML = renderEditSheetBody()
        bindEditSheetPills(body)
        renderConfigBar()
      })
    })
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
      <div class="sheet-pills">${dsPills}</div>
    </div>
    <div class="sheet-section">
      <div class="sheet-label">Visual Direction</div>
      <div class="sheet-pills">${dirPills}</div>
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
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:3737/studio/`. Verify:
- Config bar shows "+" placeholder chip or skill/DS chips
- Clicking `✎ edit` or `+ Add skill / DS` opens the side sheet with pickers
- Clicking a skill pill toggles selection (purple) and updates config bar
- `⚙ Brief` in bottom bar opens the brief sheet
- `✕` closes the sheet

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/public/studio/studio.js
git commit -m "feat(studio): config bar + side sheet (edit pickers + brief form)"
```

---

## Task 4: Preview states

**Goal:** Implement `applyPreviewState()` to toggle the three preview states (empty / generating / done-with-iframe). Add refresh and fullscreen button logic.

**Files:**
- Modify: `packages/codegraph/public/studio/studio.js`

- [ ] **Step 1: Replace `applyPreviewState` stub**

```js
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

  // Tab dot
  renderTabs()
  updateToolbarButtons()
}
```

- [ ] **Step 2: Add refresh + fullscreen buttons**

Add in `init()` after the existing event bindings:

```js
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
```

- [ ] **Step 3: Verify in browser**

Select a conversation with an existing artifact. Expect:
- Preview iframe renders with the artifact HTML
- Refresh re-loads the iframe
- Fullscreen button enters fullscreen

- [ ] **Step 4: Commit**

```bash
git add packages/codegraph/public/studio/studio.js
git commit -m "feat(studio): preview states — empty/generating/done iframe"
```

---

## Task 5: Generation flow (SSE + pipeline rendering)

**Goal:** Implement `generate()`, `connectSSE()`, `handleSseEvent()`, the pipeline block rendering in the chat area. Map SSE events to pipeline steps and show skill name.

**Files:**
- Modify: `packages/codegraph/public/studio/studio.js`

- [ ] **Step 1: Add pipeline rendering helpers**

```js
// Pipeline step IDs and labels
const PIPELINE_STEPS = [
  { id: 'brief',     label: 'Brief analizzato' },
  { id: 'context',   label: 'Contesto SkillBrain caricato' },
  { id: 'skill',     label: 'Skill applicata' },
  { id: 'html',      label: 'Generazione HTML…' },
  { id: 'critique',  label: 'Critique' },
  { id: 'done',      label: 'Completato' },
]

// Kept in module scope so handleSseEvent can update it
let pipelineEl = null

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
  // status: 'done' | 'active' | 'pending' | 'error'
  const icon  = $(`#pipe-icon-${stepId}`)
  const label = $(`#pipe-label-${stepId}`)
  if (!icon || !label) return

  icon.className = `pipe-icon ${status}`
  icon.textContent = status === 'done' ? '✓' : status === 'error' ? '✕' : status === 'active' ? '' : '○'

  label.className = `pipe-label ${status}`

  // Remove previous skill badge
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
```

- [ ] **Step 2: Replace `generate` stub**

```js
async function generate() {
  if (!state.activeConvId) { toast('Seleziona o crea una conversazione', 'error'); return }
  if (state.previewState === 'generating') return

  const btn = $('#btn-generate')
  if (btn) { btn.disabled = true }

  // Show user prompt message in chat
  const promptText = $('#prompt-textarea')?.value?.trim() ?? ''
  if (promptText) {
    appendChatMessage('user', promptText)
    if ($('#prompt-textarea')) $('#prompt-textarea').value = ''
    autoGrow()
  }

  // Add user message to conversation
  if (promptText && state.activeConvId) {
    try {
      await api.post(`/api/studio/conversations/${state.activeConvId}/messages`, {
        role: 'user', content: promptText,
      })
    } catch { /* non-blocking */ }
  }

  // Start pipeline UI
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
        skillId:       state.selected.skillId   ?? undefined,
        dsId:          state.selected.dsId       ?? undefined,
        directionId:   state.selected.directionId ?? undefined,
        brief:         brief ?? undefined,
      }
    )
    state.activeJobId = res.jobId
    connectSSE(res.jobId)
  } catch (e) {
    toast(`Generate failed: ${e.message}`, 'error')
    onGenerationError(e.message)
  }
}
```

- [ ] **Step 3: Replace `connectSSE` and `handleSseEvent` stubs**

```js
function connectSSE(jobId) {
  if (state.sseConn) { state.sseConn.close(); state.sseConn = null }
  const sse = new EventSource(`/api/studio/jobs/${jobId}/stream`)
  state.sseConn = sse
  sse.onmessage = (e) => {
    try { handleSseEvent(JSON.parse(e.data)) } catch { /* ignore */ }
  }
  sse.onerror = () => {
    onGenerationError('SSE disconnected')
    state.sseConn = null
  }
}

function handleSseEvent(event) {
  switch (event.type) {
    case 'start':
      setPipelineStep('context', 'done')
      const skillName = state.pickers.skills.find(s => s.id === state.selected.skillId)?.name ?? null
      setPipelineStep('skill', 'done', skillName ?? '')
      setPipelineStep('html', 'active')
      break

    case 'status':
      if (event.job?.status === 'running') {
        setPipelineStep('context', 'done')
      }
      break

    case 'chunk':
      // text chunk — no UI update needed (not streaming to preview)
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
  // Append AI completion message
  appendChatMessage('ai', 'Generazione completata. Puoi iterare nel prompt qui sotto o esportare dal toolbar.')
  // Collapse pipeline after delay
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
```

- [ ] **Step 4: Verify in browser**

Create a new conversation, write a prompt, click Generate. Verify:
- Pipeline block appears in chat area
- Steps advance: context → skill → HTML → critique → completato
- Skill name badge shows on the "Skill applicata" step
- Preview switches to generating (pulse rings) then to done (iframe)
- Pipeline collapses to summary after 2s

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/public/studio/studio.js
git commit -m "feat(studio): generation flow — SSE, pipeline steps, skill name badge"
```

---

## Task 6: Chat messages rendering

**Goal:** Implement `appendChatMessage()`, `renderChatFromMessages()`, `clearChatEmptyState()`, and `renderCritique()`. These populate the chat area from message history and generation events.

**Files:**
- Modify: `packages/codegraph/public/studio/studio.js`

- [ ] **Step 1: Add chat functions**

```js
function clearChatEmptyState() {
  const empty = $('#chat-empty')
  if (empty) empty.remove()
}

function appendChatMessage(role, text) {
  // role: 'user' | 'ai'
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

  // Render dimension rows
  const dims = data.dimensions ?? []
  detail.innerHTML = dims.map(d => `
    <div class="critique-row">
      <div class="c-check ${d.pass ? 'pass' : 'fail'}">${d.pass ? '✓' : '✗'}</div>
      <span style="flex:1">${esc(d.label ?? d.name ?? '')}</span>
      <span style="font-size:10px;color:var(--text-muted)">${esc(d.comment ?? d.score ?? '')}</span>
    </div>
  `).join('')
}
```

- [ ] **Step 2: Verify in browser**

Select a conversation with existing messages. Verify:
- User messages show with purple avatar "U"
- AI messages show with green avatar "AI"
- Chat area scrolls to bottom automatically
- After generation, "Generazione completata" message appended

- [ ] **Step 3: Commit**

```bash
git add packages/codegraph/public/studio/studio.js
git commit -m "feat(studio): chat messages and critique rendering"
```

---

## Task 7: Bottom bar behavior

**Goal:** Implement `handleSend()` to route user input (either triggers generation if no artifact, or adds a message and re-generates if one exists), and wire the `⚙ Brief` button.

**Files:**
- Modify: `packages/codegraph/public/studio/studio.js`

- [ ] **Step 1: Replace `handleSend` stub**

```js
function handleSend() {
  const ta = $('#prompt-textarea')
  if (!ta) return
  const text = ta.value.trim()
  if (!text || state.previewState === 'generating') return

  if (!state.activeConvId) {
    toast('Crea prima una conversazione con il tasto +', 'info')
    return
  }

  // Add prompt to conversation brief or message, then generate
  if (state.previewState === 'empty') {
    // First generation — use text as the user brief/prompt
    // It will be picked up by generate() when it POSTs the message
    generate()
  } else {
    // Iteration — append message then re-generate
    generate()
  }
}
```

- [ ] **Step 2: Enable Send button based on textarea content**

In `init()`, add:

```js
$('#prompt-textarea')?.addEventListener('input', () => {
  const ta = $('#prompt-textarea')
  const btn = $('#btn-send')
  if (btn) btn.disabled = !ta?.value?.trim() || !state.activeConvId || state.previewState === 'generating'
  autoGrow()
})
```

- [ ] **Step 3: Verify in browser**

Type in the prompt textarea. Verify:
- Send button becomes enabled when text is present
- Pressing Enter triggers send
- Pressing Shift+Enter adds a newline
- Textarea grows up to ~3 lines then scrolls

- [ ] **Step 4: Commit**

```bash
git add packages/codegraph/public/studio/studio.js
git commit -m "feat(studio): bottom bar — send logic, auto-grow textarea"
```

---

## Task 8: Export toolbar + Deploy dropdown

**Goal:** Implement `updateToolbarButtons()` (enable/disable based on state), HTML/ZIP export handlers, and the Deploy dropdown population.

**Files:**
- Modify: `packages/codegraph/public/studio/studio.js`

- [ ] **Step 1: Replace `updateToolbarButtons` stub**

```js
function updateToolbarButtons() {
  const hasDone = state.previewState === 'done' && !!state.artifactHtml
  const ids = ['btn-export-html', 'btn-export-zip', 'btn-deploy', 'btn-refresh', 'btn-fullscreen']
  ids.forEach(id => {
    const btn = $(`#${id}`)
    if (btn) btn.disabled = !hasDone
  })
}
```

- [ ] **Step 2: Add export handlers in `init()`**

```js
$('#btn-export-html')?.addEventListener('click', async () => {
  if (!state.activeConvId) return
  try {
    const res = await fetch(`/api/studio/conversations/${state.activeConvId}/export/html`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'studio-export.html'
    a.click(); URL.revokeObjectURL(url)
  } catch (e) { toast(`Export failed: ${e.message}`, 'error') }
})

$('#btn-export-zip')?.addEventListener('click', async () => {
  if (!state.activeConvId || !window.JSZip) { toast('JSZip not loaded', 'error'); return }
  try {
    const bundle = await api.get(`/api/studio/conversations/${state.activeConvId}/export/bundle`)
    const zip = new JSZip()
    if (bundle.artifactHtml) zip.file('index.html', bundle.artifactHtml)
    if (bundle.messages)     zip.file('messages.json', JSON.stringify(bundle.messages, null, 2))
    if (bundle.critiqueJson) zip.file('critique.json', typeof bundle.critiqueJson === 'string' ? bundle.critiqueJson : JSON.stringify(bundle.critiqueJson, null, 2))
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    const slug = (bundle.conversation?.title ?? 'studio').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
    a.download = `studio-${slug}.zip`
    a.click(); URL.revokeObjectURL(url)
    toast('ZIP scaricato', 'success')
  } catch (e) { toast(`ZIP failed: ${e.message}`, 'error') }
})
```

- [ ] **Step 3: Verify in browser**

After a successful generation, verify:
- `HTML` and `ZIP` buttons are enabled
- Clicking `HTML` downloads the artifact HTML file
- Clicking `ZIP` downloads a zip with `index.html` + `messages.json`
- `Deploy ▾` button is enabled (dropdown content populated in Task 9)

- [ ] **Step 4: Commit**

```bash
git add packages/codegraph/public/studio/studio.js
git commit -m "feat(studio): export toolbar — HTML + ZIP download, toolbar enable/disable"
```

---

## Task 9: Update connectors.js for Deploy dropdown

**Goal:** Update `connectors.js` to populate the `#deploy-dropdown` element with configured connectors, replacing the old `#connector-bar` logic.

**Files:**
- Modify: `packages/codegraph/public/studio/connectors.js`

- [ ] **Step 1: Read current connectors.js structure**

Run:
```bash
head -60 packages/codegraph/public/studio/connectors.js
grep -n "connector-bar\|connectorBar\|function\|export" packages/codegraph/public/studio/connectors.js | head -30
```

- [ ] **Step 2: Replace connector bar population with Deploy dropdown**

Find the function that populates `#connector-bar` (likely called `renderConnectorBar` or similar). Replace its body to target `#deploy-dropdown` instead:

```js
// Replace any function that does:
//   document.getElementById('connector-bar').innerHTML = ...
// with:

function renderDeployDropdown(connectors) {
  const dropdown = document.getElementById('deploy-dropdown')
  if (!dropdown) return

  // connectors is array of { id, label, color, configured }
  const configured = connectors.filter(c => c.configured)

  if (configured.length === 0) {
    dropdown.innerHTML = '<div class="deploy-empty">Nessun connector configurato.<br>Vai in My master.env per aggiungerli.</div>'
    return
  }

  dropdown.innerHTML = configured.map(c => `
    <div class="deploy-item" data-connector="${c.id}">
      <span class="deploy-dot" style="background:${c.color}"></span>
      ${c.label}
    </div>
  `).join('')

  // Bind clicks — delegate to existing connector modal openers
  dropdown.querySelectorAll('.deploy-item').forEach(item => {
    item.addEventListener('click', () => {
      dropdown.classList.remove('open')
      openConnectorModal(item.dataset.connector)
    })
  })
}
```

Then find where `renderConnectorBar` (or equivalent) is called and replace with `renderDeployDropdown(connectors)`.

The connector objects need `id`, `label`, `color`, `configured`. Map from the existing connector status check. The color mapping is:

```js
const CONNECTOR_COLORS = {
  github:   '#6366f1', coolify: '#34d399', unsplash: '#f59e0b',
  kling:    '#ec4899', payload: '#8b5cf6', resend:   '#06b6d4',
  n8n:      '#f97316', plausible:'#a3e635',odoo:    '#ef4444',
  nocodb:   '#22d3ee', smtp:    '#94a3b8', gdrive:   '#4ade80',
}
```

- [ ] **Step 3: Verify in browser**

After generation completes:
- Click `Deploy ▾` — dropdown opens with configured connectors
- Each connector shows a colored dot and name
- Clicking a connector opens its modal (existing modal logic)
- Clicking outside closes the dropdown

- [ ] **Step 4: Commit**

```bash
git add packages/codegraph/public/studio/connectors.js
git commit -m "feat(studio): connectors.js — Deploy dropdown replaces old connector-bar"
```

---

## Task 10: Cleanup + full integration test

**Goal:** Remove dead code from the old layout that no longer exists (conv-sidebar, V1/V2 toggle, project-picker, fixed chat section), fix any lingering references, and do a full integration test of all flows.

**Files:**
- Modify: `packages/codegraph/public/studio/studio.js`
- Modify: `packages/codegraph/public/studio/connectors.js`

- [ ] **Step 1: Remove dead references in studio.js**

Search and remove/stub any references to elements that no longer exist in the HTML:

```bash
grep -n "conv-sidebar\|conv-list\|conv-item\|chat-messages\|chat-section\|preview-frame-wrap\|preview-placeholder\|critique-toggle\|critique-body\|btn-v1\|btn-v2\|setLayout\|toggleDrawer\|composer-col\|project-picker\|btn-new-conv\|streaming-msg\|streaming-text\|btn-import\|openImportModal\|closeImportModal\|confirmImport\|showQuestionForm\|validateBriefBeforeGenerate\|openBriefModal\|closeBriefModal\|submitBrief\|brief-overlay" packages/codegraph/public/studio/studio.js
```

For each match: if the function is no longer needed (targets old DOM elements), delete it. If referenced from an event handler in `init()`, remove the binding.

- [ ] **Step 2: Remove dead references in connectors.js**

```bash
grep -n "connector-bar\|connectorBar" packages/codegraph/public/studio/connectors.js
```

Remove any remaining code that targets `#connector-bar`.

- [ ] **Step 3: Full integration test**

Open `http://localhost:3737/studio/` and run through these flows manually:

**Flow 1 — New conversation:**
- Click `+` → new tab opens, brief sheet slides in
- Fill in Surface + Brand, click Apply
- Write prompt in bottom bar, press Enter
- Verify: tab dot goes purple → pipeline steps advance → iframe renders → tab dot goes green

**Flow 2 — Iteration:**
- With a done artifact, write "Make the CTA bigger" in the prompt, press Enter
- Verify: new generation starts, pipeline re-runs, iframe updates

**Flow 3 — Config change:**
- Click `✎ edit` → side sheet shows pickers → change skill → Apply
- Verify: config chips update in bar

**Flow 4 — Export:**
- Click `HTML` → browser downloads .html file, opens correctly in new tab
- Click `ZIP` → browser downloads .zip with index.html + messages.json

**Flow 5 — Tab management:**
- Open 3 conversations via `+`
- Switch between them (verify content switches correctly)
- Close one via `✕` (verify active tab moves to adjacent)

**Flow 6 — Deploy dropdown:**
- Click `Deploy ▾` → dropdown shows configured connectors
- Click a connector → modal opens correctly

- [ ] **Step 4: Commit**

```bash
git add packages/codegraph/public/studio/studio.js packages/codegraph/public/studio/connectors.js
git commit -m "feat(studio): cleanup dead code + full integration verified"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Tab-based conversations (Task 2)
- ✅ Large preview with 3 states (Task 4)
- ✅ Pipeline progress showing skill name (Task 5)
- ✅ Config chips + ✎ edit side sheet (Task 3)
- ✅ Brief optional side sheet with ⚙ Brief button (Task 3, 7)
- ✅ Bottom prompt bar with auto-grow (Task 7)
- ✅ HTML + ZIP export in preview toolbar (Task 8)
- ✅ Deploy ▾ dropdown with configured connectors (Task 9)
- ✅ Critique bar below right panel (Task 6)
- ✅ Generate button disabled during generation (Task 2/5)
- ✅ Removed: conv-sidebar, V1/V2 toggle, fixed chat height, project picker (Task 10)

**Type consistency:**
- `state.artifactHtml` used consistently (Task 4, 5, 8)
- `state.previewState` values `'empty' | 'generating' | 'done' | 'error'` consistent across tasks
- `appendChatMessage(role, text)` — `role` is `'user' | 'ai'` — consistent across Task 5 and 6
- `setPipelineStep(stepId, status, extra)` — `stepId` matches `PIPELINE_STEPS[].id` values
