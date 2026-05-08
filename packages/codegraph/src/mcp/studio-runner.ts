/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import Anthropic from '@anthropic-ai/sdk'
import { spawn } from 'node:child_process'
import { writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Response } from 'express'

// Minimal settings file for claude CLI — disables hooks/MCP so Studio jobs run cleanly
export const STUDIO_SETTINGS_PATH = join(tmpdir(), 'synapse-studio-claude-settings.json')
if (!existsSync(STUDIO_SETTINGS_PATH)) {
  writeFileSync(STUDIO_SETTINGS_PATH, '{}', 'utf8')
}
import { openDb, closeDb, StudioStore, UsersEnvStore, isEncryptionAvailable } from '@skillbrain/storage'
import type { Job, Conversation, BriefData } from '@skillbrain/storage'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RunnerCtx {
  skillbrainRoot: string
  anthropicApiKey: string   // server-wide fallback
  userId?: string           // requesting user (for per-user credentials)
}

type ResolvedCreds =
  | { type: 'api'; key: string }
  | { type: 'claude_code' }

// ── Credential resolver ───────────────────────────────────────────────────────

// In-memory fallback for local instances without ENCRYPTION_KEY or auth
export const localProviderOverrides = new Map<string, string>()

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

interface SseEvent {
  type: 'start' | 'chunk' | 'artifact' | 'critique' | 'slop' | 'done' | 'error'
  jobId?: string
  text?: string
  html?: string
  json?: unknown
  message?: string
}

// ── Singleton ─────────────────────────────────────────────────────────────────

class StudioRunner {
  private subscribers = new Map<string, Set<Response>>()
  private running = new Set<string>()

  subscribe(jobId: string, res: Response): () => void {
    if (!this.subscribers.has(jobId)) this.subscribers.set(jobId, new Set())
    this.subscribers.get(jobId)!.add(res)
    return () => {
      this.subscribers.get(jobId)?.delete(res)
    }
  }

  private emit(jobId: string, event: SseEvent): void {
    const subs = this.subscribers.get(jobId)
    if (!subs || subs.size === 0) return
    const data = `data: ${JSON.stringify(event)}\n\n`
    for (const res of subs) {
      try { res.write(data) } catch { /* subscriber disconnesso */ }
    }
  }

  enqueue(jobId: string, ctx: RunnerCtx): void {
    if (this.running.has(jobId)) return
    this.running.add(jobId)

    const creds = resolveCredentials(ctx)
    const promise = creds?.type === 'claude_code'
      ? this.runWithClaudeCode(jobId, ctx)
      : this.run(jobId, { ...ctx, anthropicApiKey: creds?.key ?? '' })

    promise.catch((err: unknown) => {
      this.emit(jobId, { type: 'error', jobId, message: (err as Error).message })
    }).finally(() => {
      this.running.delete(jobId)
      setTimeout(() => this.subscribers.delete(jobId), 30_000)
    })
  }

  private async run(jobId: string, ctx: RunnerCtx): Promise<void> {
    const db = openDb(ctx.skillbrainRoot)
    const store = new StudioStore(db)

    const job = store.getJob(jobId)
    if (!job) { closeDb(db); throw new Error(`Job ${jobId} not found`) }
    const conv = store.getConversation(job.convId)
    if (!conv) { closeDb(db); throw new Error(`Conversation ${job.convId} not found`) }

    store.updateJob(jobId, { status: 'running' })
    closeDb(db)

    this.emit(jobId, { type: 'start', jobId, text: job.agentModel })

    if (!ctx.anthropicApiKey) {
      const db2 = openDb(ctx.skillbrainRoot)
      new StudioStore(db2).updateJob(jobId, { status: 'error', errorMsg: 'ANTHROPIC_API_KEY not set' })
      closeDb(db2)
      this.emit(jobId, { type: 'error', jobId, message: 'ANTHROPIC_API_KEY not set' })
      return
    }

    const systemPrompt = buildSystemPrompt(job)
    const userPrompt = buildUserPrompt(conv)

    const client = new Anthropic({ apiKey: ctx.anthropicApiKey })
    let fullText = ''

    try {
      const stream = client.messages.stream({
        model: job.agentModel,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          const text = chunk.delta.text
          fullText += text
          this.emit(jobId, { type: 'chunk', jobId, text })
        }
      }
    } catch (err: unknown) {
      const db2 = openDb(ctx.skillbrainRoot)
      new StudioStore(db2).updateJob(jobId, { status: 'error', errorMsg: (err as Error).message })
      closeDb(db2)
      this.emit(jobId, { type: 'error', jobId, message: (err as Error).message })
      return
    }

    const artifactHtml = extractHtml(fullText)
    this.emit(jobId, { type: 'artifact', jobId, html: artifactHtml })

    let critiqueJson: unknown = null
    try {
      critiqueJson = await runCritique(artifactHtml, job.critiqueModel, client)
      this.emit(jobId, { type: 'critique', jobId, json: critiqueJson })
    } catch {
      // critique è best-effort
    }

    if (critiqueJson && isSlop(critiqueJson)) {
      this.emit(jobId, {
        type: 'slop',
        jobId,
        json: critiqueJson,
        message: 'Quality gate failed: output scored too low on 2+ dimensions. Refine your brief and retry.',
      })
      const dbSlop = openDb(ctx.skillbrainRoot)
      new StudioStore(dbSlop).updateJob(jobId, {
        status: 'done',
        artifactHtml,
        critiqueJson: JSON.stringify({ ...(critiqueJson as object), _slop: true }),
        errorMsg: 'slop-detected',
      })
      closeDb(dbSlop)
      this.emit(jobId, { type: 'done', jobId })
      return
    }

    const db3 = openDb(ctx.skillbrainRoot)
    new StudioStore(db3).updateJob(jobId, {
      status: 'done',
      artifactHtml,
      critiqueJson: JSON.stringify(critiqueJson),
    })
    closeDb(db3)

    this.emit(jobId, { type: 'done', jobId })
  }

  // ── Claude Code CLI runner ──────────────────────────────────────────────────

  private async runWithClaudeCode(jobId: string, ctx: RunnerCtx): Promise<void> {
    const db = openDb(ctx.skillbrainRoot)
    const store = new StudioStore(db)

    const job = store.getJob(jobId)
    if (!job) { closeDb(db); throw new Error(`Job ${jobId} not found`) }
    const conv = store.getConversation(job.convId)
    if (!conv) { closeDb(db); throw new Error(`Conversation ${job.convId} not found`) }

    store.updateJob(jobId, { status: 'running' })
    closeDb(db)

    this.emit(jobId, { type: 'start', jobId, text: `claude-code:${job.agentModel}` })

    const systemPrompt = buildSystemPrompt(job)
    const userPrompt = buildUserPrompt(conv)

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
        '--model', job.agentModel,
        '--system-prompt', systemPrompt,
      ], { stdio: ['pipe', 'pipe', 'pipe'] })

      child.stdin.write(userPrompt, 'utf8')
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
                  this.emit(jobId, { type: 'chunk', jobId, text: delta })
                  fullText = accumulated
                  lastEmittedLen = accumulated.length
                }
              }
            }
          } catch { /* malformed JSON line */ }
        }
      })

      child.stderr.on('data', (d: Buffer) => {
        process.stderr.write(`[studio:claude-code] ${d.toString().trim()}\n`)
      })

      child.on('error', (e) => reject(new Error(`Failed to start claude CLI: ${e.message}. Is Claude Code installed and authenticated?`)))
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`claude CLI exited with code ${code}`))
      })
    })

    const artifactHtml = extractHtml(fullText)
    this.emit(jobId, { type: 'artifact', jobId, html: artifactHtml })

    const db2 = openDb(ctx.skillbrainRoot)
    new StudioStore(db2).updateJob(jobId, { status: 'done', artifactHtml })
    closeDb(db2)

    this.emit(jobId, { type: 'done', jobId })
  }
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildSystemPrompt(job: Job): string {
  const lines: string[] = [
    'You are an expert web developer specializing in self-contained HTML/CSS/JS prototypes.',
    'You produce production-quality, visually polished, fully functional HTML artifacts.',
    '',
    '## Rules',
    '- Output ONLY a complete, self-contained HTML file — no explanations, no markdown fences',
    '- No external CDN dependencies except Google Fonts',
    '- All CSS inside a <style> tag, all JS inside a <script> tag',
    '- The output must render correctly when set as srcdoc of an iframe',
    '- Responsive by default (mobile-first)',
    '- Use realistic placeholder content — no lorem ipsum',
  ]

  if (job.promptSnapshot) {
    lines.push('', '## Context (memories + project knowledge)', job.promptSnapshot)
  }

  return lines.join('\n')
}

function buildUserPrompt(conv: Conversation): string {
  const brief = (conv.briefData ?? {}) as BriefData & Record<string, unknown>

  const surface = typeof brief.surface === 'string' ? brief.surface : 'web interface'
  const audience = typeof brief.audience === 'string' ? brief.audience : 'end users'

  const parts = [`Create a ${surface} for ${audience}.`]

  if (typeof brief.tone === 'string') parts.push(`Tone: ${brief.tone}`)
  if (typeof brief.brand === 'string') parts.push(`Brand / visual style: ${brief.brand}`)
  if (typeof brief.scale === 'string') parts.push(`Scale: ${brief.scale}`)
  if (conv.skillId) parts.push(`Skill context: ${conv.skillId}`)
  if (conv.dsId) parts.push(`Design system: ${conv.dsId}`)
  if (conv.directionId) parts.push(`Visual direction: ${conv.directionId}`)
  parts.push('', 'Output only the complete HTML file.')

  return parts.join('\n')
}

function isSlop(critique: unknown): boolean {
  if (!critique || typeof critique !== 'object') return false
  const c = critique as Record<string, { score?: number }>
  const dims = ['philosophy', 'hierarchy', 'execution', 'specificity', 'restraint']
  const scores = dims.map(d => c[d]?.score ?? 3)
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const lowCount = scores.filter(s => s <= 2).length
  return lowCount >= 2 || avg < 2.5
}

function extractHtml(text: string): string {
  const doctype = text.indexOf('<!DOCTYPE')
  const htmlOpen = text.indexOf('<html')
  const start = doctype !== -1 ? doctype : htmlOpen !== -1 ? htmlOpen : 0
  const end = text.lastIndexOf('</html>')
  if (end !== -1) return text.slice(start, end + 7)
  return text.slice(start)
}

async function runCritique(
  html: string,
  model: string,
  client: Anthropic,
): Promise<unknown> {
  const prompt = `You are a senior design critic. Evaluate this HTML prototype on 5 dimensions.
Return ONLY valid JSON, no markdown, no explanations.

HTML:
${html.slice(0, 6000)}

JSON format:
{
  "philosophy":   { "score": 1-5, "comment": "..." },
  "hierarchy":    { "score": 1-5, "comment": "..." },
  "execution":    { "score": 1-5, "comment": "..." },
  "specificity":  { "score": 1-5, "comment": "..." },
  "restraint":    { "score": 1-5, "comment": "..." },
  "overall": 1-5,
  "summary": "one sentence"
}`

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Critique returned non-text block')
  const match = block.text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Critique returned no JSON')
  return JSON.parse(match[0]) as unknown
}

export const studioRunner = new StudioRunner()
