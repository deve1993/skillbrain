# Design System Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Studio into a two-tab page — "Design System" (visual DS editor with AI generation + import/export) and "Prototype Generator" (existing iframe, untouched).

**Architecture:** New `DsRunner` class (mirrors `studio-runner.ts`) spawns Claude Code CLI with a JSON-only system prompt. Results stream via SSE to a new `/ds-studio/` SPA. `renderStudio()` in `render.js` becomes a tabbed wrapper with two iframes. Import parsers run server-side; Figma calls the Figma REST API with a user token. Export generates CSS/JSON/Tailwind strings from the stored `DesignSystem`.

**Tech Stack:** TypeScript (Node), Express SSE, SQLite via `@skillbrain/storage`, vanilla JS frontend (same pattern as `/studio/`), HTML5 color inputs, sandboxed iframe preview.

---

## Reference Files

| Purpose | Path |
|---------|------|
| Credential resolution pattern | `packages/codegraph/src/mcp/studio-runner.ts` |
| Route registration | `packages/codegraph/src/mcp/http-server.ts:635–645` |
| RouteContext type | `packages/codegraph/src/mcp/routes/index.ts` |
| Component/DS store | `packages/storage/src/components-store.ts` |
| Existing studio routes pattern | `packages/codegraph/src/mcp/routes/studio.ts` |
| renderStudio to replace | `packages/codegraph/public/js/render.js:1510–1518` |
| CSS vars for matching dark theme | `packages/codegraph/public/style.css:1–24` |
| Studio SPA pattern | `packages/codegraph/public/studio/index.html` + `studio.js` |

---

## Task 1: DsRunner — in-memory job store + Claude Code spawn

**Files:**
- Create: `packages/codegraph/src/mcp/ds-runner.ts`

**Step 1: Create `ds-runner.ts`**

```typescript
/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeFileSync, existsSync } from 'node:fs'
import type { Response } from 'express'
import { randomUUID } from 'node:crypto'
import { localProviderOverrides, type RunnerCtx } from './studio-runner.js'
import { openDb, closeDb, isEncryptionAvailable, UsersEnvStore } from '@skillbrain/storage'

const STUDIO_SETTINGS_PATH = join(tmpdir(), 'synapse-studio-claude-settings.json')
if (!existsSync(STUDIO_SETTINGS_PATH)) {
  writeFileSync(STUDIO_SETTINGS_PATH, '{}', 'utf8')
}

// ── In-memory job store (jobs are short-lived, no persistence needed) ──

export interface DsGenJob {
  id: string
  status: 'pending' | 'running' | 'done' | 'error'
  brief: string
  result?: Record<string, unknown>
  error?: string
}

const jobs = new Map<string, DsGenJob>()

export function createDsJob(brief: string): DsGenJob {
  const job: DsGenJob = { id: `dsj-${randomUUID()}`, status: 'pending', brief }
  jobs.set(job.id, job)
  return job
}

export function getDsJob(id: string): DsGenJob | undefined {
  return jobs.get(id)
}

// ── Credential resolver (mirrors studio-runner.ts) ──

function resolveCredentials(ctx: RunnerCtx): { type: 'api'; key: string } | { type: 'claude_code' } | null {
  const effectiveId = ctx.userId ?? '__local__'
  const memProvider = localProviderOverrides.get(effectiveId)
  if (memProvider === 'claude_code') return { type: 'claude_code' }

  if (ctx.userId && isEncryptionAvailable()) {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const envStore = new UsersEnvStore(db)
      const provider = envStore.getEnv(ctx.userId, 'STUDIO_PROVIDER')
      if (provider === 'claude_code') { closeDb(db); return { type: 'claude_code' } }
      const userKey = envStore.getEnv(ctx.userId, 'ANTHROPIC_API_KEY')
      closeDb(db)
      if (userKey) return { type: 'api', key: userKey }
    } catch { /* ignore */ }
  }

  return ctx.anthropicApiKey ? { type: 'api', key: ctx.anthropicApiKey } : null
}

// ── SSE subscribers ──

const subscribers = new Map<string, Set<Response>>()

export function subscribeDsJob(jobId: string, res: Response): () => void {
  if (!subscribers.has(jobId)) subscribers.set(jobId, new Set())
  subscribers.get(jobId)!.add(res)
  return () => subscribers.get(jobId)?.delete(res)
}

function emit(jobId: string, event: Record<string, unknown>): void {
  const subs = subscribers.get(jobId)
  if (!subs?.size) return
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const res of subs) {
    try { res.write(data) } catch { /* disconnected */ }
  }
}

// ── System prompt ──

const DS_SYSTEM_PROMPT = `You are a design system expert. Generate a complete design system based on the user's brief.

Return ONLY valid JSON — no markdown, no explanation, no code fences — with this exact structure:
{
  "colors": {
    "primary": "#...",
    "secondary": "#...",
    "accent": "#...",
    "background": "#...",
    "surface": "#...",
    "text": "#...",
    "textMuted": "#...",
    "border": "#...",
    "error": "#...",
    "success": "#...",
    "warning": "#..."
  },
  "fonts": {
    "sans": "Inter",
    "mono": "JetBrains Mono",
    "heading": "Inter",
    "baseSize": "16px",
    "lineHeight": "1.5"
  },
  "spacing": {
    "xs": "4px",
    "sm": "8px",
    "md": "16px",
    "lg": "24px",
    "xl": "32px",
    "2xl": "48px"
  },
  "radius": {
    "sm": "4px",
    "md": "8px",
    "lg": "16px",
    "full": "9999px"
  },
  "animations": [],
  "darkMode": true,
  "colorFormat": "hex"
}

Adapt colors, fonts, and scale to the brief. Return ONLY the JSON object.`

// ── Runner ──

export function enqueueDsJob(jobId: string, ctx: RunnerCtx): void {
  const job = jobs.get(jobId)
  if (!job) return
  const creds = resolveCredentials(ctx)
  if (!creds) {
    job.status = 'error'
    job.error = 'No credentials configured. Set up a provider in Studio → Settings.'
    emit(jobId, { type: 'error', message: job.error })
    return
  }
  runDsJob(jobId, ctx).catch((err: unknown) => {
    const j = jobs.get(jobId)
    if (j) { j.status = 'error'; j.error = (err as Error).message }
    emit(jobId, { type: 'error', message: (err as Error).message })
  }).finally(() => {
    setTimeout(() => { jobs.delete(jobId); subscribers.delete(jobId) }, 60_000)
  })
}

async function runDsJob(jobId: string, ctx: RunnerCtx): Promise<void> {
  const job = jobs.get(jobId)!
  job.status = 'running'
  emit(jobId, { type: 'start', jobId })

  let fullText = ''
  let lastEmittedLen = 0

  await new Promise<void>((resolve, reject) => {
    const child = spawn('claude', [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--no-session-persistence',
      '--settings', STUDIO_SETTINGS_PATH,
      '--system-prompt', DS_SYSTEM_PROMPT,
    ], { stdio: ['pipe', 'pipe', 'pipe'] })

    child.stdin.write(job.brief, 'utf8')
    child.stdin.end()

    let buf = ''
    child.stdout.on('data', (chunk: Buffer) => {
      buf += chunk.toString('utf8')
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const evt = JSON.parse(line) as Record<string, unknown>
          if (evt.type === 'assistant') {
            const content = (evt.message as any)?.content as Array<{ type: string; text?: string }> | undefined
            if (content) {
              let acc = ''
              for (const blk of content) if (blk.type === 'text' && blk.text) acc += blk.text
              if (acc.length > lastEmittedLen) {
                emit(jobId, { type: 'chunk', text: acc.slice(lastEmittedLen) })
                fullText = acc
                lastEmittedLen = acc.length
              }
            }
          }
        } catch { /* malformed line */ }
      }
    })

    child.stderr.on('data', (d: Buffer) => process.stderr.write(`[ds-runner] ${d.toString().trim()}\n`))
    child.on('error', (e) => reject(new Error(`claude CLI error: ${e.message}`)))
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`claude CLI exited with code ${code}`)))
  })

  // Extract and parse JSON from accumulated text
  const jsonMatch = fullText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Model did not return valid JSON')
  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

  job.status = 'done'
  job.result = parsed
  emit(jobId, { type: 'done', jobId, result: parsed })
}
```

**Step 2: Build to verify no TypeScript errors**

```bash
cd "packages/codegraph" && npm run build 2>&1 | tail -5
```
Expected: clean build (no errors)

**Step 3: Commit**

```bash
git add packages/codegraph/src/mcp/ds-runner.ts
git commit -m "feat(studio): DsRunner — Claude Code CLI job engine for DS generation"
```

---

## Task 2: Import parsers utility

**Files:**
- Create: `packages/codegraph/src/mcp/ds-import.ts`

**Step 1: Create `ds-import.ts`**

```typescript
/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type { DesignSystemInput } from '@skillbrain/storage'

// ── CSS variable parser ──

export function parseCssVars(css: string): Partial<DesignSystemInput> {
  const colors: Record<string, string> = {}
  const fonts: Record<string, unknown> = {}
  const spacing: Record<string, unknown> = {}
  const radius: Record<string, string> = {}

  const re = /--([a-z][a-z0-9-]*)\s*:\s*([^;}{]+?)\s*;/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    const [, name, value] = m
    const v = value.trim()
    if (/^(#[0-9a-f]{3,8}|rgb|hsl|oklch)/i.test(v) || name.match(/color|bg|background|text|foreground|accent|primary|secondary|muted|border/i)) {
      const key = name.replace(/^(color|colors?)-/i, '') || name
      colors[key] = v
    } else if (name.match(/font|family|typeface/i)) {
      fonts[name.replace(/^font-/i, '') || name] = v
    } else if (name.match(/spacing|space|gap|padding|margin/i)) {
      spacing[name.replace(/^(spacing|space)-/i, '') || name] = v
    } else if (name.match(/radius|rounded|corner/i)) {
      radius[name.replace(/^(radius|rounded)-/i, '') || name] = v
    }
  }
  return { colors, fonts, spacing, radius }
}

// ── W3C / Style Dictionary JSON parser ──

export function parseJsonTokens(raw: unknown): Partial<DesignSystemInput> {
  const colors: Record<string, string> = {}
  const fonts: Record<string, unknown> = {}
  const spacing: Record<string, unknown> = {}
  const radius: Record<string, string> = {}

  function walk(obj: Record<string, unknown>, path: string[]): void {
    for (const [k, v] of Object.entries(obj)) {
      const cur = [...path, k]
      if (v && typeof v === 'object' && '$value' in (v as object)) {
        // W3C leaf node
        const val = String((v as Record<string, unknown>).$value)
        const fullKey = cur.join('.')
        categorize(fullKey, val, colors, fonts, spacing, radius)
      } else if (v && typeof v === 'object') {
        walk(v as Record<string, unknown>, cur)
      } else if (typeof v === 'string') {
        // Flat token: { "colors.primary": "#..." }
        categorize(cur.join('.'), v, colors, fonts, spacing, radius)
      }
    }
  }

  if (raw && typeof raw === 'object') walk(raw as Record<string, unknown>, [])
  return { colors, fonts, spacing, radius }
}

function categorize(
  key: string,
  value: string,
  colors: Record<string, string>,
  fonts: Record<string, unknown>,
  spacing: Record<string, unknown>,
  radius: Record<string, string>,
): void {
  const k = key.toLowerCase()
  const leaf = key.split('.').pop() ?? key
  if (k.match(/color|bg|background|text|foreground|accent|primary|secondary|muted|border|surface/)) {
    colors[leaf] = value
  } else if (k.match(/font|family|typeface|typography/)) {
    fonts[leaf] = value
  } else if (k.match(/spacing|space|gap|size|padding/)) {
    spacing[leaf] = value
  } else if (k.match(/radius|rounded|corner/)) {
    radius[leaf] = value
  }
}

// ── Tailwind config parser ──
// Accepts the stringified JS object from theme.extend or theme directly

export function parseTailwindConfig(configText: string): Partial<DesignSystemInput> {
  const colors: Record<string, string> = {}
  const fonts: Record<string, unknown> = {}
  const spacing: Record<string, unknown> = {}
  const radius: Record<string, string> = {}

  // Extract theme.colors / theme.extend.colors block
  const extractBlock = (text: string, key: string): string | null => {
    const re = new RegExp(`${key}\\s*:\\s*(\\{)`)
    const m = re.exec(text)
    if (!m) return null
    let depth = 0, start = m.index + m[0].length - 1, i = start
    while (i < text.length) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') { depth--; if (depth === 0) return text.slice(start, i + 1) }
      i++
    }
    return null
  }

  const colorBlock = extractBlock(configText, 'colors')
  if (colorBlock) {
    // Extract 'key': 'value' or "key": "value" pairs at depth 1
    const re = /['"]?([a-z][a-z0-9-]*)['"]?\s*:\s*['"]([^'"]+)['"]/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(colorBlock)) !== null) colors[m[1]] = m[2]
  }

  const fontBlock = extractBlock(configText, 'fontFamily')
  if (fontBlock) {
    const re = /['"]?([a-z][a-z0-9-]*)['"]?\s*:\s*\[['"]([^'"]+)['"]/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(fontBlock)) !== null) fonts[m[1]] = m[2]
  }

  const spacingBlock = extractBlock(configText, 'spacing')
  if (spacingBlock) {
    const re = /['"]?([a-z0-9][a-z0-9-.]*)['"]?\s*:\s*['"]([^'"]+)['"]/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(spacingBlock)) !== null) spacing[m[1]] = m[2]
  }

  const radiusBlock = extractBlock(configText, 'borderRadius')
  if (radiusBlock) {
    const re = /['"]?([a-z][a-z0-9-]*)['"]?\s*:\s*['"]([^'"]+)['"]/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(radiusBlock)) !== null) radius[m[1]] = m[2]
  }

  return { colors, fonts, spacing, radius }
}

// ── Figma variables mapper ──
// Accepts the raw response from Figma GET /v1/files/:key/variables/local

export function parseFigmaVariables(raw: unknown): Partial<DesignSystemInput> {
  if (!raw || typeof raw !== 'object') return {}
  const data = raw as Record<string, unknown>
  const variables = (data.variables ?? data.meta?.variables ?? {}) as Record<string, { name: string; resolvedType: string; valuesByMode: Record<string, unknown> }>
  const colors: Record<string, string> = {}
  const fonts: Record<string, unknown> = {}
  const spacing: Record<string, unknown> = {}
  const radius: Record<string, string> = {}

  for (const [, variable] of Object.entries(variables)) {
    const name = variable.name?.replace(/\//g, '.') ?? ''
    const type = variable.resolvedType ?? ''
    const firstMode = Object.values(variable.valuesByMode ?? {})[0]

    if (type === 'COLOR' && firstMode && typeof firstMode === 'object') {
      const { r, g, b, a } = firstMode as { r: number; g: number; b: number; a?: number }
      const hex = `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}${a !== undefined && a < 1 ? Math.round(a * 255).toString(16).padStart(2, '0') : ''}`
      const leaf = name.split('.').pop() ?? name
      categorize(name, hex, colors, fonts, spacing, radius)
      void leaf
    } else if (type === 'FLOAT' && typeof firstMode === 'number') {
      const leaf = name.split('.').pop() ?? name
      categorize(name, `${firstMode}px`, colors, fonts, spacing, radius)
      void leaf
    } else if (type === 'STRING' && typeof firstMode === 'string') {
      categorize(name, firstMode, colors, fonts, spacing, radius)
    }
  }

  return { colors, fonts, spacing, radius }
}
```

**Step 2: Build**

```bash
cd "packages/codegraph" && npm run build 2>&1 | tail -5
```

Expected: clean build

**Step 3: Commit**

```bash
git add packages/codegraph/src/mcp/ds-import.ts
git commit -m "feat(studio): DS import parsers — CSS vars, W3C JSON, Tailwind, Figma"
```

---

## Task 3: Export helpers utility

**Files:**
- Create: `packages/codegraph/src/mcp/ds-export.ts`

**Step 1: Create `ds-export.ts`**

```typescript
/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type { DesignSystem } from '@skillbrain/storage'

export function exportToCss(ds: DesignSystem): string {
  const lines: string[] = [`:root {`]

  for (const [k, v] of Object.entries(ds.colors ?? {}))
    lines.push(`  --color-${k}: ${v};`)

  for (const [k, v] of Object.entries(ds.fonts ?? {}))
    lines.push(`  --font-${k}: ${v};`)

  for (const [k, v] of Object.entries(ds.spacing ?? {}))
    lines.push(`  --spacing-${k}: ${v};`)

  for (const [k, v] of Object.entries(ds.radius ?? {}))
    lines.push(`  --radius-${k}: ${v};`)

  lines.push(`}`)
  return lines.join('\n')
}

export function exportToW3CJson(ds: DesignSystem): Record<string, unknown> {
  const tokens: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(ds.colors ?? {}))
    tokens[`color.${k}`] = { $value: v, $type: 'color' }

  for (const [k, v] of Object.entries(ds.fonts ?? {}))
    tokens[`font.${k}`] = { $value: v, $type: 'fontFamily' }

  for (const [k, v] of Object.entries(ds.spacing ?? {}))
    tokens[`spacing.${k}`] = { $value: v, $type: 'dimension' }

  for (const [k, v] of Object.entries(ds.radius ?? {}))
    tokens[`radius.${k}`] = { $value: v, $type: 'dimension' }

  return tokens
}

export function exportToTailwind(ds: DesignSystem): string {
  const colors = JSON.stringify(ds.colors ?? {}, null, 4)
    .replace(/"/g, "'")
  const fontFamily: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(ds.fonts ?? {})) {
    if (k === 'sans' || k === 'mono' || k === 'heading') fontFamily[k] = [String(v), 'sans-serif']
  }
  const spacing = JSON.stringify(ds.spacing ?? {}, null, 4).replace(/"/g, "'")
  const borderRadius = JSON.stringify(ds.radius ?? {}, null, 4).replace(/"/g, "'")

  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: ${colors},
      fontFamily: ${JSON.stringify(fontFamily, null, 4).replace(/"/g, "'")},
      spacing: ${spacing},
      borderRadius: ${borderRadius},
    },
  },
}`
}
```

**Step 2: Build + commit**

```bash
cd "packages/codegraph" && npm run build 2>&1 | tail -5
git add packages/codegraph/src/mcp/ds-export.ts
git commit -m "feat(studio): DS export helpers — CSS vars, W3C JSON, Tailwind config"
```

---

## Task 4: Studio DS routes

**Files:**
- Create: `packages/codegraph/src/mcp/routes/studio-ds.ts`
- Modify: `packages/codegraph/src/mcp/routes/index.ts`
- Modify: `packages/codegraph/src/mcp/http-server.ts`

**Step 1: Create `studio-ds.ts`**

```typescript
/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { Router } from 'express'
import { openDb, closeDb, ComponentsStore } from '@skillbrain/storage'
import type { RouteContext } from './index.js'
import { createDsJob, getDsJob, enqueueDsJob, subscribeDsJob } from '../ds-runner.js'
import { parseCssVars, parseJsonTokens, parseTailwindConfig, parseFigmaVariables } from '../ds-import.js'
import { exportToCss, exportToW3CJson, exportToTailwind } from '../ds-export.js'

export function createStudioDsRouter(ctx: RouteContext): Router {
  const router = Router()
  const root = ctx.skillbrainRoot

  // ── Generate ──────────────────────────────────────────────

  router.post('/api/studio/ds/generate', (req, res) => {
    const { brief } = req.body || {}
    if (!brief || typeof brief !== 'string' || !brief.trim()) {
      res.status(400).json({ error: 'brief required' }); return
    }
    const job = createDsJob(brief.trim())
    enqueueDsJob(job.id, {
      skillbrainRoot: root,
      anthropicApiKey: ctx.anthropicApiKey,
      userId: (req as any).userId as string ?? '__local__',
    })
    res.status(201).json({ jobId: job.id })
  })

  router.get('/api/studio/ds/stream/:jobId', (req, res) => {
    const job = getDsJob(req.params.jobId)
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    // If already done, send result immediately
    if (job.status === 'done') {
      res.write(`data: ${JSON.stringify({ type: 'done', result: job.result })}\n\n`)
      res.end(); return
    }
    if (job.status === 'error') {
      res.write(`data: ${JSON.stringify({ type: 'error', message: job.error })}\n\n`)
      res.end(); return
    }

    const unsubscribe = subscribeDsJob(req.params.jobId, res)
    req.on('close', unsubscribe)
  })

  // ── Import ────────────────────────────────────────────────

  router.post('/api/studio/ds/import/css', (req, res) => {
    const { css } = req.body || {}
    if (!css) { res.status(400).json({ error: 'css required' }); return }
    res.json(parseCssVars(String(css)))
  })

  router.post('/api/studio/ds/import/json', (req, res) => {
    const { tokens } = req.body || {}
    if (!tokens) { res.status(400).json({ error: 'tokens required' }); return }
    const raw = typeof tokens === 'string' ? JSON.parse(tokens) : tokens
    res.json(parseJsonTokens(raw))
  })

  router.post('/api/studio/ds/import/tailwind', (req, res) => {
    const { config } = req.body || {}
    if (!config) { res.status(400).json({ error: 'config required' }); return }
    res.json(parseTailwindConfig(String(config)))
  })

  router.post('/api/studio/ds/import/figma', async (req, res) => {
    const { fileUrl, accessToken } = req.body || {}
    if (!fileUrl) { res.status(400).json({ error: 'fileUrl required' }); return }

    // Extract file key from Figma URL: figma.com/design/:fileKey/...
    const match = fileUrl.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/)
    if (!match) { res.status(400).json({ error: 'Invalid Figma URL' }); return }
    const fileKey = match[1]

    const token = accessToken || process.env.FIGMA_TOKEN
    if (!token) { res.status(400).json({ error: 'No Figma access token. Provide accessToken in body or set FIGMA_TOKEN env var.' }); return }

    try {
      const figmaRes = await fetch(`https://api.figma.com/v1/files/${fileKey}/variables/local`, {
        headers: { 'X-Figma-Token': token },
      })
      if (!figmaRes.ok) {
        res.status(figmaRes.status).json({ error: `Figma API error: ${figmaRes.statusText}` }); return
      }
      const data = await figmaRes.json()
      res.json(parseFigmaVariables(data))
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // ── Export ────────────────────────────────────────────────

  router.get('/api/design-systems/:project/export/css', (req, res) => {
    try {
      const db = openDb(root)
      const store = new ComponentsStore(db)
      const ds = store.getDesignSystem(req.params.project)
      closeDb(db)
      if (!ds) { res.status(404).json({ error: 'Design system not found' }); return }
      res.type('text/css').send(exportToCss(ds))
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  router.get('/api/design-systems/:project/export/json', (req, res) => {
    try {
      const db = openDb(root)
      const store = new ComponentsStore(db)
      const ds = store.getDesignSystem(req.params.project)
      closeDb(db)
      if (!ds) { res.status(404).json({ error: 'Design system not found' }); return }
      res.json(exportToW3CJson(ds))
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  router.get('/api/design-systems/:project/export/tailwind', (req, res) => {
    try {
      const db = openDb(root)
      const store = new ComponentsStore(db)
      const ds = store.getDesignSystem(req.params.project)
      closeDb(db)
      if (!ds) { res.status(404).json({ error: 'Design system not found' }); return }
      res.type('text/plain').send(exportToTailwind(ds))
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  return router
}
```

**Step 2: Export from `routes/index.ts`**

Add at the end of `packages/codegraph/src/mcp/routes/index.ts`:
```typescript
export { createStudioDsRouter } from './studio-ds.js'
```

**Step 3: Register in `http-server.ts`**

In `packages/codegraph/src/mcp/http-server.ts`:

Line 51 — add import:
```typescript
import { createStudioDsRouter } from './routes/studio-ds.js'
```

After line 645 (`app.use(createStudioConnectorsRouter(routeCtx))`):
```typescript
app.use(createStudioDsRouter(routeCtx))
```

**Step 4: Build**

```bash
cd "packages/codegraph" && npm run build 2>&1 | tail -5
```
Expected: clean build

**Step 5: Smoke test routes**

```bash
node dist/cli.js mcp --http --port 3003 &
sleep 3
curl -s -X POST http://localhost:3003/api/studio/ds/import/css \
  -H "Content-Type: application/json" \
  -d '{"css":"--color-primary: #6366f1; --color-background: #0f172a;"}' | python3 -m json.tool
kill %1
```
Expected: `{"colors":{"primary":"#6366f1","background":"#0f172a"},...}`

**Step 6: Commit**

```bash
git add packages/codegraph/src/mcp/routes/studio-ds.ts \
        packages/codegraph/src/mcp/routes/index.ts \
        packages/codegraph/src/mcp/http-server.ts
git commit -m "feat(studio): Studio DS API routes — generate, stream, import, export"
```

---

## Task 5: DS Studio frontend SPA

**Files:**
- Create: `packages/codegraph/public/ds-studio/index.html`
- Create: `packages/codegraph/public/ds-studio/ds-studio.js`

**Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Design System Studio — Synapse</title>
<style>
/* ── Dark theme matching main app ── */
:root {
  --bg: #08080d;
  --card: #0e0e16;
  --border: #1a1a2a;
  --border-hover: #2a2a4a;
  --text: #d0d0d0;
  --text-dim: #777;
  --text-muted: #444;
  --accent: #a78bfa;
  --accent2: #6366f1;
  --green: #34d399;
  --red: #f87171;
  --surface: #12121e;
  --font: 'Inter', -apple-system, sans-serif;
}
* { margin:0; padding:0; box-sizing:border-box }
body { font-family:var(--font); background:var(--bg); color:var(--text); display:flex; height:100vh; overflow:hidden; font-size:13px }

/* ── Layout ── */
#left  { width:280px; flex-shrink:0; overflow-y:auto; border-right:1px solid var(--border); display:flex; flex-direction:column; gap:0 }
#right { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px }

/* ── Left panel sections ── */
.l-section { padding:14px 16px; border-bottom:1px solid var(--border) }
.l-section h3 { font-size:10px; font-weight:600; letter-spacing:.08em; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px }

/* ── DS selector bar ── */
#ds-bar { display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid var(--border) }
#ds-select { flex:1; background:var(--card); border:1px solid var(--border); border-radius:6px; color:var(--text); padding:5px 8px; font-size:12px }
#ds-new-btn { background:var(--accent2); color:#fff; border:none; border-radius:6px; padding:5px 10px; font-size:11px; cursor:pointer; white-space:nowrap }

/* ── Textarea + button ── */
textarea { width:100%; background:var(--surface); border:1px solid var(--border); border-radius:6px; color:var(--text); padding:8px; font-size:12px; resize:vertical; font-family:var(--font) }
.btn-primary { background:var(--accent2); color:#fff; border:none; border-radius:6px; padding:7px 14px; font-size:12px; cursor:pointer; width:100%; margin-top:8px }
.btn-primary:disabled { opacity:.5; cursor:default }
.btn-sm { background:var(--card); border:1px solid var(--border); color:var(--text); border-radius:5px; padding:5px 10px; font-size:11px; cursor:pointer }
.btn-sm:hover { border-color:var(--accent) }

/* ── Import/Export buttons row ── */
.btn-row { display:flex; flex-wrap:wrap; gap:6px }

/* ── Right: token sections ── */
.token-section { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:14px }
.token-section h3 { font-size:11px; font-weight:600; letter-spacing:.06em; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px }

/* ── Color rows ── */
.color-row { display:flex; align-items:center; gap:8px; margin-bottom:6px }
.color-row input[type=color] { width:32px; height:28px; border:none; border-radius:4px; cursor:pointer; padding:0; background:none }
.color-row .color-name { flex:1; font-size:12px; color:var(--text-dim) }
.color-row .color-hex { width:90px; background:var(--surface); border:1px solid var(--border); border-radius:4px; color:var(--text); padding:3px 6px; font-size:11px; font-family:monospace }
.color-row .del-btn { background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px; line-height:1 }
.color-row .del-btn:hover { color:var(--red) }

/* ── Token inputs ── */
.token-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px }
.token-row { display:flex; flex-direction:column; gap:2px }
.token-row label { font-size:10px; color:var(--text-dim) }
.token-row input { background:var(--surface); border:1px solid var(--border); border-radius:4px; color:var(--text); padding:4px 7px; font-size:12px }

/* ── Preview ── */
#preview-frame { width:100%; height:280px; border:1px solid var(--border); border-radius:8px; background:#fff }
#preview-section { background:var(--card); border:1px solid var(--border); border-radius:8px; overflow:hidden }
#preview-section .preview-header { padding:10px 14px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between }
#preview-section .preview-header span { font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em }
#preview-section .preview-header label { font-size:11px; color:var(--text-dim); display:flex; align-items:center; gap:4px; cursor:pointer }

/* ── Save bar ── */
#save-bar { display:flex; gap:8px; align-items:center }
#save-bar input { flex:1; background:var(--surface); border:1px solid var(--border); border-radius:6px; color:var(--text); padding:6px 10px; font-size:12px }
#save-btn { background:var(--green); color:#000; border:none; border-radius:6px; padding:7px 18px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap }

/* ── Status ── */
#status { font-size:11px; color:var(--text-dim); text-align:center; min-height:16px }
#status.ok { color:var(--green) }
#status.err { color:var(--red) }

/* ── Import overlay ── */
#import-overlay { display:none; position:fixed; inset:0; background:#000a; z-index:100; align-items:center; justify-content:center }
#import-overlay.open { display:flex }
.import-box { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:24px; width:520px; max-width:90vw }
.import-box h2 { font-size:14px; margin-bottom:12px }
.import-box textarea { height:160px; margin-bottom:10px }
.import-box input[type=text] { width:100%; background:var(--surface); border:1px solid var(--border); border-radius:6px; color:var(--text); padding:6px 10px; font-size:12px; margin-bottom:10px }
.import-footer { display:flex; gap:8px; justify-content:flex-end }
.btn-cancel { background:var(--surface); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:6px 14px; font-size:12px; cursor:pointer }
.btn-import { background:var(--accent2); color:#fff; border:none; border-radius:6px; padding:6px 14px; font-size:12px; cursor:pointer }
</style>
</head>
<body>

<!-- LEFT PANEL -->
<div id="left">
  <!-- DS selector -->
  <div id="ds-bar">
    <select id="ds-select"><option value="">— New DS —</option></select>
    <button id="ds-new-btn" onclick="newDs()">+ New</button>
  </div>

  <!-- Generate -->
  <div class="l-section">
    <h3>Generate with AI</h3>
    <textarea id="brief" rows="4" placeholder="Dark SaaS, purple accent, Inter, minimal and modern..."></textarea>
    <button class="btn-primary" id="gen-btn" onclick="generate()">▸ Generate Design System</button>
  </div>

  <!-- Import -->
  <div class="l-section">
    <h3>Import</h3>
    <div class="btn-row">
      <button class="btn-sm" onclick="openImport('json')">JSON tokens</button>
      <button class="btn-sm" onclick="openImport('css')">CSS vars</button>
      <button class="btn-sm" onclick="openImport('tailwind')">Tailwind</button>
      <button class="btn-sm" onclick="openImport('figma')">Figma</button>
    </div>
  </div>

  <!-- Export -->
  <div class="l-section">
    <h3>Export</h3>
    <div class="btn-row">
      <button class="btn-sm" onclick="exportDs('css')">CSS vars</button>
      <button class="btn-sm" onclick="exportDs('json')">JSON tokens</button>
      <button class="btn-sm" onclick="exportDs('tailwind')">Tailwind</button>
    </div>
  </div>

  <div style="flex:1"></div>
  <div id="status" style="padding:12px 16px"></div>
</div>

<!-- RIGHT PANEL -->
<div id="right">
  <!-- Colors -->
  <div class="token-section" id="colors-section">
    <h3>Colors <button class="btn-sm" style="float:right;margin-top:-2px" onclick="addColor()">+ Add</button></h3>
    <div id="colors-list"></div>
  </div>

  <!-- Typography -->
  <div class="token-section">
    <h3>Typography</h3>
    <div class="token-grid" id="fonts-grid"></div>
  </div>

  <!-- Spacing -->
  <div class="token-section">
    <h3>Spacing Scale</h3>
    <div class="token-grid" id="spacing-grid"></div>
  </div>

  <!-- Radius -->
  <div class="token-section">
    <h3>Border Radius</h3>
    <div class="token-grid" id="radius-grid"></div>
  </div>

  <!-- Preview -->
  <div id="preview-section">
    <div class="preview-header">
      <span>Preview</span>
      <label><input type="checkbox" id="dark-mode-toggle" onchange="toggleDarkMode()"> Dark mode</label>
    </div>
    <iframe id="preview-frame" sandbox="allow-scripts" title="DS Preview"></iframe>
  </div>

  <!-- Save -->
  <div id="save-bar">
    <input id="project-input" placeholder="Project name (e.g. my-saas)" type="text">
    <button id="save-btn" onclick="saveDs()">Save DS</button>
  </div>
</div>

<!-- Import overlay -->
<div id="import-overlay">
  <div class="import-box">
    <h2 id="import-title">Import</h2>
    <input type="text" id="import-figma-url" placeholder="Figma file URL" style="display:none">
    <input type="text" id="import-figma-token" placeholder="Figma access token (or set FIGMA_TOKEN env)" style="display:none">
    <textarea id="import-text" placeholder="Paste content here..."></textarea>
    <div class="import-footer">
      <button class="btn-cancel" onclick="closeImport()">Cancel</button>
      <button class="btn-import" onclick="runImport()">Import</button>
    </div>
  </div>
</div>

<script type="module" src="/ds-studio/ds-studio.js"></script>
</body>
</html>
```

**Step 2: Create `ds-studio.js`**

```javascript
// Synapse Design System Studio

const api = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
}

// ── State ──
let tokens = {
  colors: { primary: '#6366f1', secondary: '#8b5cf6', accent: '#a78bfa', background: '#08080d', surface: '#0e0e16', text: '#d0d0d0', textMuted: '#777', border: '#1a1a2a', error: '#f87171', success: '#34d399', warning: '#f59e0b' },
  fonts: { sans: 'Inter', mono: 'JetBrains Mono', heading: 'Inter', baseSize: '16px', lineHeight: '1.5' },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px' },
  radius: { sm: '4px', md: '8px', lg: '16px', full: '9999px' },
  darkMode: true,
}
let currentProject = null
let importMode = null

// ── Init ──
async function init() {
  await loadDsList()
  renderAll()
}

async function loadDsList() {
  const data = await api.get('/api/design-systems')
  const sel = document.getElementById('ds-select')
  sel.innerHTML = '<option value="">— New DS —</option>'
  for (const ds of data.designSystems ?? []) {
    const opt = document.createElement('option')
    opt.value = ds.project
    opt.textContent = `${ds.project}${ds.clientName ? ' — ' + ds.clientName : ''}`
    sel.appendChild(opt)
  }
  sel.onchange = () => loadDs(sel.value)
}

async function loadDs(project) {
  if (!project) { currentProject = null; return }
  const ds = await api.get(`/api/design-systems/${encodeURIComponent(project)}`)
  if (ds.error) return
  currentProject = project
  document.getElementById('project-input').value = project
  tokens.colors = ds.colors ?? tokens.colors
  tokens.fonts = ds.fonts ?? tokens.fonts
  tokens.spacing = ds.spacing ?? tokens.spacing
  tokens.radius = ds.radius ?? tokens.radius
  tokens.darkMode = ds.darkMode ?? false
  document.getElementById('dark-mode-toggle').checked = tokens.darkMode
  renderAll()
}

function newDs() {
  currentProject = null
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
}

// ── Render token sections ──
function renderAll() {
  renderColors()
  renderFonts()
  renderSpacing()
  renderRadius()
  updatePreview()
}

function renderColors() {
  const list = document.getElementById('colors-list')
  list.innerHTML = Object.entries(tokens.colors).map(([name, val]) => `
    <div class="color-row">
      <input type="color" value="${val}" oninput="setColor('${name}',this.value)">
      <span class="color-name">${name}</span>
      <input class="color-hex" type="text" value="${val}" oninput="setColorHex('${name}',this.value)">
      <button class="del-btn" onclick="delColor('${name}')">×</button>
    </div>
  `).join('')
}

function renderFonts() {
  document.getElementById('fonts-grid').innerHTML = Object.entries(tokens.fonts).map(([k, v]) => `
    <div class="token-row">
      <label>${k}</label>
      <input type="text" value="${v}" oninput="tokens.fonts['${k}']=this.value;updatePreview()">
    </div>
  `).join('')
}

function renderSpacing() {
  document.getElementById('spacing-grid').innerHTML = Object.entries(tokens.spacing).map(([k, v]) => `
    <div class="token-row">
      <label>${k}</label>
      <input type="text" value="${v}" oninput="tokens.spacing['${k}']=this.value;updatePreview()">
    </div>
  `).join('')
}

function renderRadius() {
  document.getElementById('radius-grid').innerHTML = Object.entries(tokens.radius).map(([k, v]) => `
    <div class="token-row">
      <label>${k}</label>
      <input type="text" value="${v}" oninput="tokens.radius['${k}']=this.value;updatePreview()">
    </div>
  `).join('')
}

// ── Color helpers ──
window.setColor = (name, val) => { tokens.colors[name] = val; document.querySelector(`.color-row input.color-hex[oninput*="${name}"]`)?.setAttribute('value', val); updatePreview() }
window.setColorHex = (name, val) => { tokens.colors[name] = val; updatePreview() }
window.delColor = (name) => { delete tokens.colors[name]; renderColors(); updatePreview() }
window.addColor = () => { const k = prompt('Color name (e.g. brand):'); if (k) { tokens.colors[k] = '#000000'; renderColors(); updatePreview() } }
window.toggleDarkMode = () => { tokens.darkMode = document.getElementById('dark-mode-toggle').checked; updatePreview() }

// ── Preview ──
function buildPreviewHtml() {
  const cssVars = [
    ...Object.entries(tokens.colors).map(([k, v]) => `--c-${k}: ${v};`),
    ...Object.entries(tokens.fonts).map(([k, v]) => `--f-${k}: ${v};`),
    ...Object.entries(tokens.spacing).map(([k, v]) => `--s-${k}: ${v};`),
    ...Object.entries(tokens.radius).map(([k, v]) => `--r-${k}: ${v};`),
  ].join('\n    ')

  return `<!DOCTYPE html>
<html>
<head>
<style>
  :root { ${cssVars} }
  * { margin:0; padding:0; box-sizing:border-box }
  body { font-family: var(--f-sans, var(--f-heading, sans-serif)); background: var(--c-background, #fff); color: var(--c-text, #000); padding: 20px; display:flex; flex-direction:column; gap:16px }
  h1 { font-size:24px; font-weight:700; color:var(--c-text,#000) }
  p { font-size:14px; color:var(--c-textMuted,#666); line-height: var(--f-lineHeight, 1.5) }
  .card { background:var(--c-surface,#f8f8f8); border:1px solid var(--c-border,#e0e0e0); border-radius:var(--r-md,8px); padding:var(--s-md,16px) }
  .btn { display:inline-block; background:var(--c-primary,#6366f1); color:#fff; border:none; border-radius:var(--r-sm,4px); padding: var(--s-sm,8px) var(--s-md,16px); font-size:14px; cursor:pointer; margin-right:8px }
  .btn-secondary { background:transparent; border:1px solid var(--c-primary,#6366f1); color:var(--c-primary,#6366f1) }
  .badge { display:inline-block; background:var(--c-accent,#a78bfa); color:#fff; border-radius:var(--r-full,9999px); padding:2px 10px; font-size:11px }
  .palette { display:flex; gap:6px; flex-wrap:wrap }
  .swatch { width:32px; height:32px; border-radius:var(--r-sm,4px) }
</style>
</head>
<body>
  <h1>Design System Preview</h1>
  <p>Typography specimen — the quick brown fox jumps over the lazy dog.</p>
  <div class="card">
    <h2 style="font-size:16px;margin-bottom:8px">Component Card</h2>
    <p style="margin-bottom:12px">Surface color with border radius and spacing.</p>
    <button class="btn">Primary</button>
    <button class="btn btn-secondary">Secondary</button>
    <span class="badge">Badge</span>
  </div>
  <div class="palette">
    ${Object.entries(tokens.colors).slice(0, 10).map(([k, v]) => `<div class="swatch" style="background:${v}" title="${k}:${v}"></div>`).join('')}
  </div>
</body>
</html>`
}

function updatePreview() {
  const frame = document.getElementById('preview-frame')
  frame.srcdoc = buildPreviewHtml()
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
    if (error) throw new Error(error)

    const sse = new EventSource(`/api/studio/ds/stream/${jobId}`)
    let accumulated = ''

    sse.onmessage = (e) => {
      const evt = JSON.parse(e.data)
      if (evt.type === 'chunk') {
        accumulated += evt.text
        setStatus('Generating…')
      }
      if (evt.type === 'done') {
        sse.close()
        if (evt.result) {
          applyTokens(evt.result)
          setStatus('Generated! Review and save.', 'ok')
        } else {
          // Try to parse accumulated text
          try {
            const m = accumulated.match(/\{[\s\S]*\}/)
            if (m) applyTokens(JSON.parse(m[0]))
          } catch { setStatus('Generated (no valid JSON — try again)', 'err') }
        }
        btn.disabled = false
        btn.textContent = '▸ Generate Design System'
      }
      if (evt.type === 'error') {
        sse.close()
        setStatus('Error: ' + evt.message, 'err')
        btn.disabled = false
        btn.textContent = '▸ Generate Design System'
      }
    }
    sse.onerror = () => {
      sse.close()
      setStatus('Connection error', 'err')
      btn.disabled = false
      btn.textContent = '▸ Generate Design System'
    }
  } catch (err) {
    setStatus('Error: ' + err.message, 'err')
    btn.disabled = false
    btn.textContent = '▸ Generate Design System'
  }
}

function applyTokens(result) {
  if (result.colors) tokens.colors = result.colors
  if (result.fonts) tokens.fonts = result.fonts
  if (result.spacing) tokens.spacing = result.spacing
  if (result.radius) tokens.radius = result.radius
  if (typeof result.darkMode === 'boolean') {
    tokens.darkMode = result.darkMode
    document.getElementById('dark-mode-toggle').checked = result.darkMode
  }
  renderAll()
}

// ── Import ──
window.openImport = function(mode) {
  importMode = mode
  const overlay = document.getElementById('import-overlay')
  const title = document.getElementById('import-title')
  const textarea = document.getElementById('import-text')
  const figmaUrl = document.getElementById('import-figma-url')
  const figmaToken = document.getElementById('import-figma-token')

  const labels = { json: 'Paste JSON Design Tokens', css: 'Paste CSS variables', tailwind: 'Paste Tailwind theme config', figma: 'Import from Figma' }
  title.textContent = labels[mode]
  textarea.placeholder = mode === 'figma' ? 'Optional: paste file JSON if offline' : `Paste ${mode} content here...`
  figmaUrl.style.display = mode === 'figma' ? 'block' : 'none'
  figmaToken.style.display = mode === 'figma' ? 'block' : 'none'
  textarea.value = ''

  overlay.classList.add('open')
}

window.closeImport = () => document.getElementById('import-overlay').classList.remove('open')

window.runImport = async function() {
  const text = document.getElementById('import-text').value.trim()
  let result

  try {
    if (importMode === 'figma') {
      const fileUrl = document.getElementById('import-figma-url').value.trim()
      const accessToken = document.getElementById('import-figma-token').value.trim()
      if (!fileUrl) { alert('Figma URL required'); return }
      result = await api.post('/api/studio/ds/import/figma', { fileUrl, accessToken: accessToken || undefined })
    } else if (importMode === 'json') {
      result = await api.post('/api/studio/ds/import/json', { tokens: text })
    } else if (importMode === 'css') {
      result = await api.post('/api/studio/ds/import/css', { css: text })
    } else if (importMode === 'tailwind') {
      result = await api.post('/api/studio/ds/import/tailwind', { config: text })
    }

    if (result?.error) { alert('Import error: ' + result.error); return }
    if (result) {
      if (result.colors && Object.keys(result.colors).length) tokens.colors = { ...tokens.colors, ...result.colors }
      if (result.fonts && Object.keys(result.fonts).length) tokens.fonts = { ...tokens.fonts, ...result.fonts }
      if (result.spacing && Object.keys(result.spacing).length) tokens.spacing = { ...tokens.spacing, ...result.spacing }
      if (result.radius && Object.keys(result.radius).length) tokens.radius = { ...tokens.radius, ...result.radius }
      renderAll()
      setStatus('Imported! Review and save.', 'ok')
    }
    closeImport()
  } catch (err) {
    alert('Import failed: ' + err.message)
  }
}

// ── Export ──
window.exportDs = async function(format) {
  const project = document.getElementById('project-input').value.trim()
  if (!project) { setStatus('Save DS first (enter a project name)', 'err'); return }
  const url = `/api/design-systems/${encodeURIComponent(project)}/export/${format}`
  const res = await fetch(url)
  if (!res.ok) { setStatus('Export failed', 'err'); return }
  const text = await res.text()
  try {
    await navigator.clipboard.writeText(text)
    setStatus(`Copied ${format} to clipboard`, 'ok')
  } catch {
    prompt(`${format} export:`, text)
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
    currentProject = project
    await loadDsList()
    document.getElementById('ds-select').value = project
    setStatus('Saved!', 'ok')
  } catch (err) {
    setStatus('Save failed: ' + err.message, 'err')
  } finally {
    btn.disabled = false
  }
}

// ── Status helper ──
function setStatus(msg, type = '') {
  const el = document.getElementById('status')
  el.textContent = msg
  el.className = type
}

// ── Start ──
init()
```

**Step 3: Add POST `/api/design-systems` route** (save DS from frontend)

In `packages/codegraph/src/mcp/routes/studio-ds.ts`, add before the export routes:

```typescript
  router.post('/api/design-systems', (req, res) => {
    const input = req.body || {}
    if (!input.project) { res.status(400).json({ error: 'project required' }); return }
    try {
      const db = openDb(root)
      const store = new ComponentsStore(db)
      const ds = store.upsertDesignSystem(input)
      closeDb(db)
      res.status(201).json(ds)
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message })
    }
  })
```

**Step 4: Build + verify**

```bash
cd "packages/codegraph" && npm run build 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add packages/codegraph/public/ds-studio/
git add packages/codegraph/src/mcp/routes/studio-ds.ts
git commit -m "feat(studio): DS Studio SPA — visual editor, AI generate, import, export, save"
```

---

## Task 6: Update `renderStudio()` — two-tab wrapper

**Files:**
- Modify: `packages/codegraph/public/js/render.js:1510–1518`

**Step 1: Replace `renderStudio()`**

Find and replace the entire function (lines 1510–1518):

```javascript
export function renderStudio() {
  const page = document.getElementById('page')
  page.innerHTML = `
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin:-20px -28px 0;padding:0 28px">
      <button id="studio-tab-ds" onclick="switchStudioTab('ds')" style="background:none;border:none;border-bottom:2px solid var(--accent);color:var(--text);padding:12px 18px;font-size:13px;font-weight:500;cursor:pointer">Design System</button>
      <button id="studio-tab-proto" onclick="switchStudioTab('proto')" style="background:none;border:none;border-bottom:2px solid transparent;color:var(--text-muted);padding:12px 18px;font-size:13px;font-weight:500;cursor:pointer">Prototype Generator</button>
    </div>
    <div id="studio-content" style="margin:-0px -28px;height:calc(100vh - 84px)">
      <iframe id="studio-iframe-ds" src="/ds-studio/" style="display:block;width:100%;height:100%;border:none"></iframe>
      <iframe id="studio-iframe-proto" src="/studio/" style="display:none;width:100%;height:100%;border:none"></iframe>
    </div>
  `
}

window.switchStudioTab = function(tab) {
  const ds = document.getElementById('studio-tab-ds')
  const proto = document.getElementById('studio-tab-proto')
  const iDs = document.getElementById('studio-iframe-ds')
  const iProto = document.getElementById('studio-iframe-proto')
  if (tab === 'ds') {
    ds.style.borderBottomColor = 'var(--accent)'; ds.style.color = 'var(--text)'
    proto.style.borderBottomColor = 'transparent'; proto.style.color = 'var(--text-muted)'
    iDs.style.display = 'block'; iProto.style.display = 'none'
  } else {
    proto.style.borderBottomColor = 'var(--accent)'; proto.style.color = 'var(--text)'
    ds.style.borderBottomColor = 'transparent'; ds.style.color = 'var(--text-muted)'
    iProto.style.display = 'block'; iDs.style.display = 'none'
  }
}
```

**Step 2: Commit**

```bash
git add packages/codegraph/public/js/render.js
git commit -m "feat(studio): two-tab Studio — Design System + Prototype Generator"
```

---

## Task 7: End-to-end verification

**Step 1: Start server**

```bash
cd "packages/codegraph" && node dist/cli.js mcp --http --port 3737
```

**Step 2: Navigate to Studio tab**

Open `http://localhost:3737` → click **Studio** in sidebar.

Expected: Two tabs visible — "Design System" | "Prototype Generator"

**Step 3: Test tab switching**

Click "Prototype Generator" → existing Studio app loads in iframe.
Click "Design System" → DS Studio loads.

**Step 4: Test Generate**

- Ensure credentials set (via Studio → Settings or `ANTHROPIC_API_KEY` env)
- Enter brief: "Minimal SaaS dark theme, indigo primary, Inter font"
- Click Generate → status shows "Generating…" → tokens populate in right panel → preview iframe updates

**Step 5: Test manual edit**

- Click any color picker → change color → preview iframe updates immediately

**Step 6: Test Save**

- Enter project name → click Save → status shows "Saved!"
- Run: `curl -s http://localhost:3737/api/design-systems | python3 -m json.tool | grep project`
  Expected: project name appears

**Step 7: Test Export**

- Click "CSS vars" export → clipboard copied
- `curl -s http://localhost:3737/api/design-systems/<project>/export/css`
  Expected: `:root { --color-primary: ...; }` block

**Step 8: Test Import CSS**

- Click Import → CSS vars → paste `--color-primary: #e11d48; --color-background: #0f172a;`
- Click Import → colors merge into editor

**Step 9: Verify MCP tool still works**

From Claude Code terminal:
```
design_system_get({ project: "<saved-project>" })
```
Expected: full DS token object returned

**Step 10: Final build + commit**

```bash
cd "packages/codegraph" && npm run build 2>&1 | tail -5
git add -A
git commit -m "feat(studio): Design System Studio complete — v1"
```

---

## Summary of New Files

| File | Purpose |
|------|---------|
| `src/mcp/ds-runner.ts` | Claude Code CLI job engine for DS generation |
| `src/mcp/ds-import.ts` | Parsers: CSS, W3C JSON, Tailwind, Figma variables |
| `src/mcp/ds-export.ts` | Exporters: CSS custom props, W3C tokens JSON, Tailwind config |
| `src/mcp/routes/studio-ds.ts` | API routes: generate, stream, import/*, export/*, save |
| `public/ds-studio/index.html` | DS Studio SPA shell |
| `public/ds-studio/ds-studio.js` | DS Studio logic: editor, AI generate, import/export, preview |

## Modified Files

| File | Change |
|------|--------|
| `src/mcp/routes/index.ts` | Export `createStudioDsRouter` |
| `src/mcp/http-server.ts` | Import + register `createStudioDsRouter` |
| `public/js/render.js:1510–1518` | Replace `renderStudio()` with two-tab version |
