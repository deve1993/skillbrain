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
import { randomUUID } from 'node:crypto'
import type { Response } from 'express'

import { openDb, closeDb, UsersEnvStore, isEncryptionAvailable } from '@skillbrain/storage'
import { localProviderOverrides, STUDIO_SETTINGS_PATH, type RunnerCtx } from './studio-runner.js'

// ── DS System Prompt ──────────────────────────────────────────────────────────

const DS_SYSTEM_PROMPT = `You are an expert UI/UX designer and design systems engineer.
Given a brief describing a product, brand, or visual direction, generate a complete design system token set.

Return ONLY the JSON object. No explanation, no markdown, no code fences.

The JSON must have exactly this shape:
{
  "colors": {
    "primary": "#6d28d9",
    "secondary": "#0ea5e9",
    "accent": "#f59e0b",
    "background": "#ffffff",
    "surface": "#f8fafc",
    "text": "#0f172a",
    "textMuted": "#64748b",
    "border": "#e2e8f0",
    "error": "#ef4444",
    "success": "#22c55e",
    "warning": "#f59e0b"
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
  "palette": {
    "brand": {
      "50": "#f5f3ff",
      "100": "#ede9fe",
      "200": "#ddd6fe",
      "300": "#c4b5fd",
      "400": "#a78bfa",
      "500": "#8b5cf6",
      "600": "#7c3aed",
      "700": "#6d28d9",
      "800": "#5b21b6",
      "900": "#4c1d95"
    },
    "neutral": {
      "50": "#f8fafc",
      "100": "#f1f5f9",
      "200": "#e2e8f0",
      "300": "#cbd5e1",
      "400": "#94a3b8",
      "500": "#64748b",
      "600": "#475569",
      "700": "#334155",
      "800": "#1e293b",
      "900": "#0f172a"
    }
  },
  "semanticColors": {
    "text": {
      "primary": "#0f172a",
      "secondary": "#334155",
      "muted": "#64748b",
      "disabled": "#94a3b8",
      "inverse": "#ffffff",
      "link": "#7c3aed"
    },
    "bg": {
      "base": "#ffffff",
      "surface": "#f8fafc",
      "elevated": "#ffffff",
      "overlay": "rgba(0,0,0,0.5)"
    },
    "border": {
      "default": "#e2e8f0",
      "strong": "#cbd5e1",
      "focus": "#7c3aed"
    },
    "feedback": {
      "error": "#ef4444",
      "success": "#22c55e",
      "warning": "#f59e0b",
      "info": "#0ea5e9"
    }
  },
  "shadows": {
    "sm": "0 1px 2px rgba(0,0,0,0.05)",
    "md": "0 4px 6px rgba(0,0,0,0.07)",
    "lg": "0 10px 15px rgba(0,0,0,0.10)",
    "xl": "0 20px 25px rgba(0,0,0,0.10)",
    "focus": "0 0 0 3px rgba(109,40,217,0.3)"
  },
  "typography": {
    "families": {
      "sans": "Inter",
      "mono": "JetBrains Mono",
      "heading": "Inter"
    },
    "scale": {
      "xs":   { "size": "0.75rem",  "leading": "1rem" },
      "sm":   { "size": "0.875rem", "leading": "1.25rem" },
      "base": { "size": "1rem",     "leading": "1.5rem" },
      "lg":   { "size": "1.125rem", "leading": "1.75rem" },
      "xl":   { "size": "1.25rem",  "leading": "1.75rem" },
      "2xl":  { "size": "1.5rem",   "leading": "2rem" },
      "3xl":  { "size": "1.875rem", "leading": "2.25rem" },
      "4xl":  { "size": "2.25rem",  "leading": "2.5rem" }
    },
    "weights": {
      "normal":   "400",
      "medium":   "500",
      "semibold": "600",
      "bold":     "700"
    }
  },
  "effects": {
    "aurora":   { "preset": "none",   "customCss": "" },
    "particles":{ "preset": "none",   "customCss": "" },
    "glow":     { "preset": "none",   "customCss": "" },
    "glassmorphism": { "preset": "none", "customCss": "" }
  },
  "components": {
    "button": {
      "radius": "0.375rem",
      "paddingX": "1rem",
      "paddingY": "0.5rem",
      "fontWeight": "600",
      "fontSize": "0.875rem"
    },
    "input": {
      "radius": "0.375rem",
      "borderWidth": "1px",
      "paddingX": "0.75rem",
      "paddingY": "0.5rem",
      "fontSize": "0.875rem"
    },
    "card": {
      "radius": "0.75rem",
      "padding": "1.5rem",
      "shadow": "md"
    },
    "badge": {
      "radius": "9999px",
      "paddingX": "0.5rem",
      "paddingY": "0.125rem",
      "fontSize": "0.75rem",
      "fontWeight": "500"
    }
  },
  "assets": {
    "logoUrl": "",
    "logoWordmark": "",
    "iconLibrary": "lucide"
  },
  "animations": [],
  "darkMode": false,
  "colorFormat": "hex"
}

Return ONLY the JSON object. No explanation, no markdown, no code fences.`

// ── Job store ─────────────────────────────────────────────────────────────────

export interface DsGenJob {
  id: string
  status: 'pending' | 'running' | 'done' | 'error'
  brief: string
  result?: Record<string, unknown>
  error?: string
}

const jobs = new Map<string, DsGenJob>()

export function createDsJob(brief: string): DsGenJob {
  const id = `dsj-${randomUUID()}`
  const job: DsGenJob = { id, status: 'pending', brief }
  jobs.set(id, job)
  return job
}

export function getDsJob(id: string): DsGenJob | undefined {
  return jobs.get(id)
}

// ── SSE subscribers ───────────────────────────────────────────────────────────

const dsSubscribers = new Map<string, Set<Response>>()

export function subscribeDsJob(jobId: string, res: Response): () => void {
  if (!dsSubscribers.has(jobId)) dsSubscribers.set(jobId, new Set())
  dsSubscribers.get(jobId)!.add(res)
  return () => {
    dsSubscribers.get(jobId)?.delete(res)
  }
}

// ── SSE emitter ───────────────────────────────────────────────────────────────

interface DsSseEvent {
  type: 'start' | 'chunk' | 'done' | 'error'
  jobId?: string
  text?: string
  result?: Record<string, unknown>
  message?: string
}

function emitDs(jobId: string, event: DsSseEvent): void {
  const subs = dsSubscribers.get(jobId)
  if (!subs || subs.size === 0) return
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const res of subs) {
    try { res.write(data) } catch { /* subscriber disconnected */ }
  }
}

// ── Credential resolver ───────────────────────────────────────────────────────

type ResolvedCreds =
  | { type: 'api'; key: string }
  | { type: 'claude_code' }

function resolveCredentials(ctx: RunnerCtx): ResolvedCreds | null {
  const { userId, skillbrainRoot, anthropicApiKey } = ctx
  const effectiveId = userId ?? '__local__'

  // 1. Check in-memory override (set when encryption is unavailable or no session)
  const memProvider = localProviderOverrides.get(effectiveId)
  if (memProvider === 'claude_code') return { type: 'claude_code' }

  // 2. Check encrypted per-user store
  if (userId && isEncryptionAvailable()) {
    try {
      const db = openDb(skillbrainRoot)
      const envStore = new UsersEnvStore(db)
      const provider = envStore.getEnv(userId, 'STUDIO_PROVIDER')
      if (provider === 'claude_code') { closeDb(db); return { type: 'claude_code' } }
      const userKey = envStore.getEnv(userId, 'ANTHROPIC_API_KEY')
      closeDb(db)
      if (userKey) return { type: 'api', key: userKey }
    } catch { /* encryption unavailable or no entry */ }
  }

  // 3. Fall back to server-wide key
  return anthropicApiKey ? { type: 'api', key: anthropicApiKey } : null
}

// ── Job runner ────────────────────────────────────────────────────────────────

export function enqueueDsJob(jobId: string, ctx: RunnerCtx): void {
  runDsJob(jobId, ctx)
    .catch((err: unknown) => {
      const job = jobs.get(jobId)
      if (job) {
        job.status = 'error'
        job.error = (err as Error).message
      }
      emitDs(jobId, { type: 'error', jobId, message: (err as Error).message })
    })
    .finally(() => {
      setTimeout(() => {
        jobs.delete(jobId)
        dsSubscribers.delete(jobId)
      }, 60_000)
    })
}

async function runDsJob(jobId: string, ctx: RunnerCtx): Promise<void> {
  const job = jobs.get(jobId)
  if (!job) throw new Error(`DS job ${jobId} not found`)

  job.status = 'running'
  emitDs(jobId, { type: 'start', jobId })

  // DS generation always uses the Claude Code CLI
  await runWithClaudeCode(jobId, ctx)
}

async function runWithClaudeCode(jobId: string, _ctx: RunnerCtx): Promise<void> {
  const job = jobs.get(jobId)
  if (!job) throw new Error(`DS job ${jobId} not found`)

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
            const msg = evt.message as Record<string, unknown> | undefined
            const content = msg?.content as Array<{ type: string; text?: string }> | undefined
            if (content) {
              let accumulated = ''
              for (const blk of content) {
                if (blk.type === 'text' && blk.text) accumulated += blk.text
              }
              if (accumulated.length > lastEmittedLen) {
                const delta = accumulated.slice(lastEmittedLen)
                emitDs(jobId, { type: 'chunk', jobId, text: delta })
                fullText = accumulated
                lastEmittedLen = accumulated.length
              }
            }
          }
        } catch { /* malformed JSON line */ }
      }
    })

    child.stderr.on('data', (d: Buffer) => {
      process.stderr.write(`[ds-runner:claude-code] ${d.toString().trim()}\n`)
    })

    child.on('error', (e) => reject(new Error(`Failed to start claude CLI: ${e.message}. Is Claude Code installed and authenticated?`)))
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`claude CLI exited with code ${code}`))
    })
  })

  // Extract JSON from the full text output
  const match = fullText.match(/\{[\s\S]*\}/)
  if (!match) {
    job.status = 'error'
    job.error = 'No JSON found in model output'
    emitDs(jobId, { type: 'error', jobId, message: job.error })
    return
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(match[0]) as Record<string, unknown>
  } catch (err) {
    job.status = 'error'
    job.error = `Failed to parse JSON from model output: ${(err as Error).message}`
    emitDs(jobId, { type: 'error', jobId, message: job.error })
    return
  }

  job.status = 'done'
  job.result = parsed
  emitDs(jobId, { type: 'done', jobId, result: parsed })
}
