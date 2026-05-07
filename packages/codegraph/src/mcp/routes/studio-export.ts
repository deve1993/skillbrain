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
import { openDb, closeDb, StudioStore } from '@skillbrain/storage'
import type { BriefData } from '@skillbrain/storage'
import type { RouteContext } from './index.js'

export function createStudioExportRouter(ctx: RouteContext): Router {
  const router = Router()

  // ── GET /api/studio/conversations/:id/export/html ──
  router.get('/api/studio/conversations/:id/export/html', async (req, res) => {
    let db: ReturnType<typeof openDb> | undefined
    try {
      db = openDb(ctx.skillbrainRoot)
      const store = new StudioStore(db)
      const conv = store.getConversation(req.params.id)
      if (!conv) { res.status(404).json({ error: 'not found' }); return }

      const jobs = store.listJobsForConv(req.params.id)
      const lastDone = jobs.find(j => j.status === 'done' && j.artifactHtml)
      if (!lastDone?.artifactHtml) { res.status(404).json({ error: 'no artifact' }); return }

      // Analytics injection: ?analytics=plausible
      let htmlToSend = lastDone.artifactHtml
      const analyticsParam = req.query.analytics as string | undefined
      if (analyticsParam === 'plausible') {
        try {
          const { injectPlausible } = await import('../connectors/plausible.js')
          const r = injectPlausible(htmlToSend, {
            skillbrainRoot: ctx.skillbrainRoot,
            userId: (req as unknown as { userId?: string; session?: { userId?: string } }).userId
              ?? (req as unknown as { userId?: string; session?: { userId?: string } }).session?.userId,
          })
          if (r.injected) htmlToSend = r.html
        } catch { /* plausible not configured — send original */ }
      }

      const slug = conv.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
      const date = new Date().toISOString().slice(0, 10)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="studio-${slug}-${date}.html"`)
      res.send(htmlToSend)
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ error: (e as Error).message })
    } finally {
      if (db) closeDb(db)
    }
  })

  // ── GET /api/studio/conversations/:id/export/md ──
  router.get('/api/studio/conversations/:id/export/md', (req, res) => {
    const db = openDb(ctx.skillbrainRoot)
    try {
      const store = new StudioStore(db)
      const conv = store.getConversation(req.params.id)
      if (!conv) { res.status(404).json({ error: 'not found' }); return }

      const msgs = store.listMessages(req.params.id)
      let md = `# ${conv.title}\n\n`
      md += `**Created:** ${conv.createdAt}\n\n`
      if (conv.briefData) {
        const b = conv.briefData as Record<string, unknown>
        md += `## Brief\n`
        for (const [k, v] of Object.entries(b)) {
          if (v) md += `- **${k}**: ${String(v)}\n`
        }
        md += '\n'
      }
      md += `## Conversation\n\n`
      for (const m of msgs) {
        if (m.role === 'artifact') continue
        const label = m.role === 'user' ? '**You**' : '**Studio**'
        md += `### ${label}\n${m.content}\n\n`
      }

      const slug = conv.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
      const date = new Date().toISOString().slice(0, 10)
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="studio-${slug}-${date}.md"`)
      res.send(md)
    } finally { closeDb(db) }
  })

  // ── GET /api/studio/conversations/:id/export/bundle ──
  router.get('/api/studio/conversations/:id/export/bundle', (req, res) => {
    const db = openDb(ctx.skillbrainRoot)
    try {
      const store = new StudioStore(db)
      const conv = store.getConversation(req.params.id)
      if (!conv) { res.status(404).json({ error: 'not found' }); return }

      const msgs = store.listMessages(req.params.id)
      const jobs = store.listJobsForConv(req.params.id)
      const lastDone = jobs.find(j => j.status === 'done' && j.artifactHtml)

      res.json({
        version: '1.0',
        exportedAt: new Date().toISOString(),
        conversation: {
          id: conv.id,
          title: conv.title,
          briefJson: conv.briefData ? JSON.stringify(conv.briefData) : null,
          createdAt: conv.createdAt,
        },
        messages: msgs.filter(m => m.role !== 'artifact'),
        artifactHtml: lastDone?.artifactHtml ?? null,
        critiqueJson: lastDone?.critiqueJson ?? null,
      })
    } finally { closeDb(db) }
  })

  // ── POST /api/studio/import ──
  router.post('/api/studio/import', (req, res) => {
    const body = req.body as {
      conversation?: { title?: string; briefJson?: string | null }
      messages?: Array<{ role: string; content: string }>
      artifactHtml?: string | null
      critiqueJson?: string | null
    }
    const { conversation, messages, artifactHtml, critiqueJson } = body

    if (!conversation?.title) {
      res.status(400).json({ error: 'conversation.title required' })
      return
    }

    const db = openDb(ctx.skillbrainRoot)
    try {
      const store = new StudioStore(db)

      let briefData: BriefData | undefined
      if (conversation.briefJson) {
        try { briefData = JSON.parse(conversation.briefJson) as BriefData } catch { /* invalid JSON */ }
      }

      const newConv = store.createConversation({
        title: `[Imported] ${conversation.title}`,
        briefData: briefData ?? null,
      })

      if (Array.isArray(messages)) {
        for (const m of messages) {
          store.addMessage({
            convId: newConv.id,
            role: m.role as 'user' | 'assistant' | 'artifact',
            content: typeof m.content === 'string' ? m.content : String(m.content),
          })
        }
      }

      if (artifactHtml) {
        const job = store.createJob({
          convId: newConv.id,
          agentModel: 'imported',
          critiqueModel: 'imported',
          promptSnapshot: '',
        })
        store.updateJob(job.id, {
          status: 'done',
          artifactHtml,
          critiqueJson: critiqueJson ?? null,
        })
      }

      res.status(201).json({ conversationId: newConv.id, title: newConv.title })
    } finally { closeDb(db) }
  })

  return router
}
