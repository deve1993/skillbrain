# Synapse Rebrand Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all user-visible "SkillBrain" strings with "Synapse" across the monorepo, leaving package names and internal env vars untouched.

**Architecture:** Bulk-replace license headers with a single `sed` command, then edit each file containing non-header occurrences individually. Three categories: TypeScript sources, frontend static files, and docs.

**Tech Stack:** pnpm monorepo, TypeScript, plain HTML/JS/CSS, Markdown.

---

## What changes vs. what stays

| Changes | Stays |
|---------|-------|
| `SkillBrain — Self-hosted AI memory platform` → `Synapse — The intelligence layer for AI workflows` | `@skillbrain/storage` package name |
| `SkillBrain` in UI text → `Synapse` | `SKILLBRAIN_ROOT`, `SKILLBRAIN_MCP_URL` env vars |
| `SkillBrain Studio` → `Studio` | `CODEGRAPH_AUTH_TOKEN` |
| `SkillBrain Hub` → `Synapse` | Copyright: `Daniel De Vecchi` |
| README title/body | CLAUDE.md / AGENTS.md |

---

### Task 1: Bulk-replace license headers (106 .ts files)

**Files:**  
All `packages/**/*.ts` files — no individual edits, use shell.

**Step 1: Verify current count before the change**

```bash
grep -r "SkillBrain — Self-hosted AI memory platform" packages/ --include="*.ts" | wc -l
```
Expected output: `106`

**Step 2: Run the replacement with LC_ALL=C for safety on macOS**

```bash
LC_ALL=C find packages -name "*.ts" | xargs sed -i '' \
  's/SkillBrain — Self-hosted AI memory platform/Synapse — The intelligence layer for AI workflows/g'
```

**Step 3: Verify zero license-header occurrences remain**

```bash
grep -r "SkillBrain — Self-hosted AI memory platform" packages/ --include="*.ts" | wc -l
```
Expected output: `0`

**Step 4: Verify the replacement landed correctly (spot-check)**

```bash
head -3 packages/storage/src/index.ts
head -3 packages/codegraph/src/mcp/connectors/resend.ts
```
Expected: line 2 reads `* Synapse — The intelligence layer for AI workflows`

**Step 5: Commit**

```bash
git add packages/
git commit -m "rebrand: replace license headers SkillBrain → Synapse (106 files)"
```

---

### Task 2: `http-server.ts` — login page, emails, banner, fallback

**File:** `packages/codegraph/src/mcp/http-server.ts`

Current occurrences (7):
- line 64: `'SkillBrain <noreply@dvesolutions.eu>'`
- line 97: `'Accesso a SkillBrain'`
- line 101: `'Sei stato aggiunto al team SkillBrain.'`
- line 699: `SkillBrain Hub (HTTP mode)`
- line 725: `<title>SkillBrain — Login</title>`
- line 739: `<h1>SkillBrain</h1>`
- line 768–771: `<title>SkillBrain</title>` and `<h1>SkillBrain Hub</h1>`

**Step 1: Apply replacements**

Open `packages/codegraph/src/mcp/http-server.ts` and make these edits:

```diff
-const SMTP_FROM    = process.env.SMTP_FROM || 'SkillBrain <noreply@dvesolutions.eu>'
+const SMTP_FROM    = process.env.SMTP_FROM || 'Synapse <noreply@dvesolutions.eu>'
```

```diff
-    subject: 'Accesso a SkillBrain',
+    subject: 'Accesso a Synapse',
```

```diff
-      'Sei stato aggiunto al team SkillBrain.',
+      'Sei stato aggiunto al team Synapse.',
```

```diff
-  SkillBrain Hub (HTTP mode)
+  Synapse (HTTP mode)
```

```diff
-<title>SkillBrain — Login</title>
+<title>Synapse — Login</title>
```

```diff
-<h1>SkillBrain</h1>
+<h1>Synapse</h1>
```

```diff
-return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SkillBrain</title>
+return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Synapse</title>
```

```diff
-</head><body><div class="c"><h1>SkillBrain Hub</h1><p>Server running.
+</head><body><div class="c"><h1>Synapse</h1><p>Server running.
```

**Step 2: Verify zero occurrences remain in this file**

```bash
grep -n "SkillBrain" packages/codegraph/src/mcp/http-server.ts
```
Expected: no output.

**Step 3: Commit**

```bash
git add packages/codegraph/src/mcp/http-server.ts
git commit -m "rebrand: Synapse in http-server login/email/banner strings"
```

---

### Task 3: `dashboard/server.ts` — Neural Map page

**File:** `packages/codegraph/src/dashboard/server.ts`

Current occurrences (4 UI strings):
- line 206: `<title>SkillBrain — Neural Map</title>`
- line 277: `<h1>SkillBrain</h1>`
- line 282: `SkillBrain Neural Map — auto-refreshes every 30s — built with CodeGraph`
- line 565: `SkillBrain Dashboard: http://localhost:${PORT}`

**Step 1: Apply replacements**

```diff
-<title>SkillBrain — Neural Map</title>
+<title>Synapse — Neural Map</title>
```

```diff
-<h1>SkillBrain</h1>
+<h1>Synapse</h1>
```

```diff
-SkillBrain Neural Map — auto-refreshes every 30s — built with CodeGraph
+Synapse Neural Map — auto-refreshes every 30s — built with CodeGraph
```

```diff
-console.log(`\n  SkillBrain Dashboard: http://localhost:${PORT}\n`)
+console.log(`\n  Synapse Dashboard: http://localhost:${PORT}\n`)
```

**Step 2: Verify**

```bash
grep -n "SkillBrain" packages/codegraph/src/dashboard/server.ts
```
Expected: no output.

**Step 3: Commit**

```bash
git add packages/codegraph/src/dashboard/server.ts
git commit -m "rebrand: Synapse in dashboard Neural Map strings"
```

---

### Task 4: Connector strings — `resend.ts` and `github.ts`

**Files:**
- `packages/codegraph/src/mcp/connectors/resend.ts`
- `packages/codegraph/src/mcp/connectors/github.ts`

**Step 1: Edit `resend.ts` (3 occurrences)**

```diff
-  let from = 'SkillBrain Studio <noreply@dvesolutions.eu>'
+  let from = 'Synapse <noreply@dvesolutions.eu>'
```

```diff
-    senderName: params.senderName ?? 'SkillBrain Studio',
+    senderName: params.senderName ?? 'Synapse',
```

```diff
-      <h1 style="color:#a78bfa;font-size:18px;margin:0">SkillBrain Studio</h1>
+      <h1 style="color:#a78bfa;font-size:18px;margin:0">Studio</h1>
```

**Step 2: Edit `github.ts` (2 occurrences)**

```diff
-    message: `feat(studio): ${params.convTitle} — SkillBrain Studio export`,
+    message: `feat(studio): ${params.convTitle} — Studio export`,
```

```diff
-      body: `Generated by SkillBrain Studio.\n\nPreview file: \`${filePath}\`\n\n---\n*Auto-generated — do not merge without review.*`,
+      body: `Generated by Studio.\n\nPreview file: \`${filePath}\`\n\n---\n*Auto-generated — do not merge without review.*`,
```

**Step 3: Verify both files**

```bash
grep -n "SkillBrain" packages/codegraph/src/mcp/connectors/resend.ts packages/codegraph/src/mcp/connectors/github.ts
```
Expected: no output.

**Step 4: Commit**

```bash
git add packages/codegraph/src/mcp/connectors/resend.ts packages/codegraph/src/mcp/connectors/github.ts
git commit -m "rebrand: Synapse in resend/github connector strings"
```

---

### Task 5: Route strings — `studio-connectors.ts`

**File:** `packages/codegraph/src/mcp/routes/studio-connectors.ts`

Current occurrences (3):
- line 276: `source: source ?? 'SkillBrain Studio'`
- line 362: `<p>Preview from SkillBrain Studio.</p>`
- line 398: `description: 'SkillBrain Studio export: ${convTitle}'`

**Step 1: Apply replacements**

```diff
-        { name, email, phone, description, partnerName, source: source ?? 'SkillBrain Studio' },
+        { name, email, phone, description, partnerName, source: source ?? 'Studio' },
```

```diff
-          html: bodyHtml ?? `<p>Preview from SkillBrain Studio.</p>`,
+          html: bodyHtml ?? `<p>Preview from Studio.</p>`,
```

```diff
-          description: `SkillBrain Studio export: ${convTitle}`,
+          description: `Studio export: ${convTitle}`,
```

**Step 2: Verify**

```bash
grep -n "SkillBrain" packages/codegraph/src/mcp/routes/studio-connectors.ts
```
Expected: no output (the license header was already replaced in Task 1).

**Step 3: Commit**

```bash
git add packages/codegraph/src/mcp/routes/studio-connectors.ts
git commit -m "rebrand: Synapse in studio-connectors route strings"
```

---

### Task 6: Frontend — `public/studio/`

**Files:**
- `packages/codegraph/public/studio/index.html`
- `packages/codegraph/public/studio/mockup.html`
- `packages/codegraph/public/studio/studio.js`

**Step 1: Edit `index.html`**

```diff
-  <title>SkillBrain Studio</title>
+  <title>Studio — Synapse</title>
```

**Step 2: Edit `mockup.html` (2 occurrences)**

```diff
-  <title>SkillBrain Studio</title>
+  <title>Studio — Synapse</title>
```

```diff
-      SkillBrain Studio
+      Studio
```

**Step 3: Edit `studio.js` (2 occurrences)**

```diff
-  { id: 'context',   label: 'Contesto SkillBrain caricato' },
+  { id: 'context',   label: 'Contesto Synapse caricato' },
```

```diff
-                <input class="sheet-input" id="brief-brand" placeholder="es. SkillBrain — AI memory platform" value="${esc(b.brand??'')}">
+                <input class="sheet-input" id="brief-brand" placeholder="es. Synapse — The intelligence layer for AI workflows" value="${esc(b.brand??'')}">
```

**Step 4: Verify**

```bash
grep -n "SkillBrain" packages/codegraph/public/studio/index.html packages/codegraph/public/studio/mockup.html packages/codegraph/public/studio/studio.js
```
Expected: no output.

**Step 5: Commit**

```bash
git add packages/codegraph/public/studio/
git commit -m "rebrand: Synapse in Studio frontend (title, labels, placeholders)"
```

---

### Task 7: Frontend — dashboard `public/`

**Files:**
- `packages/codegraph/public/index.html`
- `packages/codegraph/public/app.js`
- `packages/codegraph/public/style.css`
- `packages/codegraph/public/js/modal.js`
- `packages/codegraph/public/js/render.js`
- `packages/codegraph/public/js/api.js`

**Step 1: Edit `index.html` (2 occurrences)**

```diff
-  <title>SkillBrain Hub</title>
+  <title>Synapse</title>
```

```diff
-      <h1>SkillBrain</h1>
+      <h1>Synapse</h1>
```

**Step 2: Edit comment-only headers (4 files)**

`app.js` line 1:
```diff
-// SkillBrain Hub — SPA orchestrator
+// Synapse — SPA orchestrator
```

`style.css` line 1:
```diff
-/* SkillBrain Hub — Dark Theme */
+/* Synapse — Dark Theme */
```

`js/modal.js` line 1:
```diff
-// SkillBrain Hub — Edit Project modal module
+// Synapse — Edit Project modal module
```

`js/render.js` line 1:
```diff
-// SkillBrain Hub — Rendering / DOM-building module
+// Synapse — Rendering / DOM-building module
```

`js/api.js` line 1:
```diff
-// SkillBrain Hub — API client module
+// Synapse — API client module
```

**Step 3: Edit user-visible string in `render.js`**

```diff
-      projectName = prompt('Project name (must exist in SkillBrain):')
+      projectName = prompt('Project name (must exist in Synapse):')
```

**Step 4: Verify**

```bash
grep -rn "SkillBrain" packages/codegraph/public/index.html packages/codegraph/public/app.js packages/codegraph/public/style.css packages/codegraph/public/js/
```
Expected: no output.

**Step 5: Commit**

```bash
git add packages/codegraph/public/index.html packages/codegraph/public/app.js packages/codegraph/public/style.css packages/codegraph/public/js/
git commit -m "rebrand: Synapse in dashboard HTML/JS/CSS"
```

---

### Task 8: Frontend — `public/whiteboard/`

**Files:**
- `packages/codegraph/public/whiteboard.html`
- `packages/codegraph/public/whiteboard/main.js`
- `packages/codegraph/public/whiteboard/whiteboard.css`
- `packages/codegraph/public/whiteboard/render.js`
- `packages/codegraph/public/whiteboard/state.js`
- `packages/codegraph/public/whiteboard/interact.js`
- `packages/codegraph/public/whiteboard/api.js`

**Step 1: Edit `whiteboard.html` (6 occurrences)**

```diff
-  <title>SkillBrain Whiteboard</title>
+  <title>Synapse Whiteboard</title>
```

```diff
-      <button id="btn-link" class="wb-side-btn" title="+ Link · Drop a SkillBrain memory/skill/session/project as a card">
+      <button id="btn-link" class="wb-side-btn" title="+ Link · Drop a Synapse memory/skill/session/project as a card">
```

```diff
-      <button id="btn-export-mem" class="wb-side-btn" title="Save the selected nodes as a SkillBrain memory">
+      <button id="btn-export-mem" class="wb-side-btn" title="Save the selected nodes as a Synapse memory">
```

```diff
-          <li>Click <strong>+ Link</strong> to drop SkillBrain memories/skills as cards</li>
+          <li>Click <strong>+ Link</strong> to drop Synapse memories/skills as cards</li>
```

```diff
-      <h3>Link from SkillBrain</h3>
+      <h3>Link from Synapse</h3>
```

```diff
-        <button class="wb-gen-btn" data-gen="by-project" title="Frame per progetto SkillBrain">By project</button>
+        <button class="wb-gen-btn" data-gen="by-project" title="Frame per progetto Synapse">By project</button>
```

**Step 2: Edit `whiteboard/main.js` (3 occurrences)**

```diff
-    document.title = `SkillBrain · ${board.name}` + (isReadOnly ? ' (read-only)' : '')
+    document.title = `Synapse · ${board.name}` + (isReadOnly ? ' (read-only)' : '')
```

```diff
-  { selector: '#btn-link', title: '+ Link', body: 'Drop SkillBrain memories, skills, sessions or projects directly onto the canvas as live cards.', position: 'bottom' },
+  { selector: '#btn-link', title: '+ Link', body: 'Drop Synapse memories, skills, sessions or projects directly onto the canvas as live cards.', position: 'bottom' },
```

```diff
-    try { await wb.patch(boardId, { name: e.target.value }); update({ name: e.target.value }); document.title = 'SkillBrain · ' + e.target.value }
+    try { await wb.patch(boardId, { name: e.target.value }); update({ name: e.target.value }); document.title = 'Synapse · ' + e.target.value }
```

**Step 3: Edit comment-only headers (5 files)**

```diff
-/* SkillBrain Whiteboard styles */
+/* Synapse Whiteboard styles */
```

```diff
-// SkillBrain Whiteboard — DOM rendering
+// Synapse Whiteboard — DOM rendering
```

```diff
-// SkillBrain Whiteboard — state management
+// Synapse Whiteboard — state management
```

```diff
-// SkillBrain Whiteboard — interaction layer
+// Synapse Whiteboard — interaction layer
```

```diff
-// SkillBrain Whiteboard — API client
+// Synapse Whiteboard — API client
```

**Step 4: Verify**

```bash
grep -rn "SkillBrain" packages/codegraph/public/whiteboard.html packages/codegraph/public/whiteboard/
```
Expected: no output.

**Step 5: Commit**

```bash
git add packages/codegraph/public/whiteboard.html packages/codegraph/public/whiteboard/
git commit -m "rebrand: Synapse in Whiteboard frontend (titles, tooltips, headers)"
```

---

### Task 9: `README.md`

**File:** `README.md`

Replace all occurrences. The rules:
- `SkillBrain` as a product name → `Synapse`
- `SkillBrain Studio` → `Studio`
- `Self-hosted AI memory platform for teams` → `The intelligence layer for AI workflows`
- Keep `SKILLBRAIN_MCP_URL`, `SKILLBRAIN_ROOT` env var names unchanged
- Keep the alt text of the logo image (graphic asset, out of scope)

**Step 1: Apply replacements — run the sed commands one by one**

```bash
# Replace product tagline
LC_ALL=C sed -i '' \
  's/Self-hosted AI memory platform for teams/The intelligence layer for AI workflows/g' \
  README.md

# Replace "SkillBrain Studio" before replacing bare "SkillBrain"
LC_ALL=C sed -i '' \
  's/SkillBrain Studio/Studio/g' \
  README.md

# Replace remaining bare "SkillBrain"
LC_ALL=C sed -i '' \
  's/SkillBrain/Synapse/g' \
  README.md
```

**Step 2: Restore env var names that were incorrectly changed**

After the above, `SKILLBRAIN_MCP_URL` and `SKILLBRAIN_ROOT` may now read `SYNAPSE_MCP_URL` — restore them:

```bash
LC_ALL=C sed -i '' \
  's/SYNAPSE_MCP_URL/SKILLBRAIN_MCP_URL/g; s/SYNAPSE_ROOT/SKILLBRAIN_ROOT/g' \
  README.md
```

**Step 3: Verify zero SkillBrain remain (excluding env vars)**

```bash
grep -n "SkillBrain" README.md | grep -v "SKILLBRAIN_"
```
Expected: no output.

**Step 4: Also check that env vars are preserved**

```bash
grep "SKILLBRAIN_" README.md
```
Expected: occurrences for `SKILLBRAIN_MCP_URL` and/or `SKILLBRAIN_ROOT`.

**Step 5: Commit**

```bash
git add README.md
git commit -m "rebrand: Synapse in README (product name, tagline, Studio references)"
```

---

### Task 10: `CODEX.md`

**File:** `CODEX.md`

Current occurrences (3):
- line 1: `# Codex Instructions — SkillBrain Integration`
- line 3: `You are connected to SkillBrain collective memory via the 'codegraph' MCP server.`
- line 100: `Never hardcode secrets. Use SkillBrain credential store:`

**Step 1: Apply replacements**

```bash
LC_ALL=C sed -i '' 's/SkillBrain/Synapse/g' CODEX.md
```

**Step 2: Verify**

```bash
grep -n "SkillBrain" CODEX.md
```
Expected: no output.

**Step 3: Commit**

```bash
git add CODEX.md
git commit -m "rebrand: Synapse in CODEX.md"
```

---

### Task 11: Full verification

**Step 1: Check zero "SkillBrain" remain in all in-scope locations**

```bash
grep -r "SkillBrain" \
  packages/codegraph/src \
  packages/storage/src \
  packages/codegraph/public \
  README.md CODEX.md \
  --include="*.ts" --include="*.html" --include="*.js" --include="*.css" --include="*.md"
```
Expected: zero output.

**Step 2: Build storage package**

```bash
pnpm --filter @skillbrain/storage build
```
Expected: exits 0 with no TypeScript errors.

**Step 3: Build codegraph package**

```bash
pnpm --filter codegraph build
```
Expected: exits 0 with no TypeScript errors.

**Step 4: Spot-check the login page HTML template**

```bash
grep -A5 'loginPage\|getLoginPage\|loginHtml' packages/codegraph/src/mcp/http-server.ts | grep -i "synapse\|skillbrain" | head -10
```
Expected: only "Synapse" results.

**Step 5: Final commit if anything was missed**

If any stragglers found, fix them, then:

```bash
git add -p
git commit -m "rebrand: fix remaining SkillBrain stragglers"
```

---

### Summary of commits (expected)

1. `rebrand: replace license headers SkillBrain → Synapse (106 files)`
2. `rebrand: Synapse in http-server login/email/banner strings`
3. `rebrand: Synapse in dashboard Neural Map strings`
4. `rebrand: Synapse in resend/github connector strings`
5. `rebrand: Synapse in studio-connectors route strings`
6. `rebrand: Synapse in Studio frontend (title, labels, placeholders)`
7. `rebrand: Synapse in dashboard HTML/JS/CSS`
8. `rebrand: Synapse in Whiteboard frontend (titles, tooltips, headers)`
9. `rebrand: Synapse in README (product name, tagline, Studio references)`
10. `rebrand: Synapse in CODEX.md`
