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
import type { RouteContext } from './index.js'
import { getConnectorStatuses, type ConnectorCtx } from '../connectors/index.js'
import { createGithubPr } from '../connectors/github.js'
import { triggerCoolifyDeploy } from '../connectors/coolify.js'
import { searchUnsplash, trackUnsplashDownload } from '../connectors/unsplash.js'
import { createKlingVideoTask, pollKlingTask } from '../connectors/kling.js'
import { publishToPayload } from '../connectors/payload.js'
import { sendPreviewEmail } from '../connectors/resend.js'
import { triggerN8nWorkflow } from '../connectors/n8n.js'
import { injectPlausible } from '../connectors/plausible.js'
import { createOdooLead } from '../connectors/odoo.js'
import { insertNocoDbRow } from '../connectors/nocodb.js'
import { sendSmtpEmail } from '../connectors/smtp.js'
import { uploadToGoogleDrive } from '../connectors/gdrive.js'

export function createStudioConnectorsRouter(ctx: RouteContext): Router {
  const router = Router()

  function getLastArtifact(convId: string): string | null {
    const db = openDb(ctx.skillbrainRoot)
    try {
      const store = new StudioStore(db)
      const jobs = store.listJobsForConv(convId)
      return jobs.find(j => j.status === 'done' && j.artifactHtml)?.artifactHtml ?? null
    } finally {
      closeDb(db)
    }
  }

  function connectorCtx(req: Express.Request & { userId?: string; session?: { userId?: string } }): ConnectorCtx {
    return {
      skillbrainRoot: ctx.skillbrainRoot,
      userId: (req as unknown as { userId?: string; session?: { userId?: string } }).userId
        ?? (req as unknown as { userId?: string; session?: { userId?: string } }).session?.userId,
    }
  }

  // ── GET /api/studio/connectors/status ──
  router.get('/api/studio/connectors/status', (req, res) => {
    try {
      res.json(getConnectorStatuses(connectorCtx(req as never)))
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── POST /api/studio/conversations/:id/connectors/github-pr ──
  router.post('/api/studio/conversations/:id/connectors/github-pr', async (req, res) => {
    const { repo, baseBranch } = req.body as { repo?: string; baseBranch?: string }
    if (!repo) { res.status(400).json({ error: 'repo required (format: owner/repo)' }); return }

    const html = getLastArtifact(req.params.id)
    if (!html) { res.status(404).json({ error: 'No artifact found for this conversation' }); return }

    const db = openDb(ctx.skillbrainRoot)
    let convTitle = 'studio-export'
    try {
      const conv = new StudioStore(db).getConversation(req.params.id)
      if (conv) convTitle = conv.title
    } finally { closeDb(db) }

    try {
      const result = await createGithubPr(
        { repo, convTitle, artifactHtml: html, baseBranch },
        connectorCtx(req as never),
      )
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── POST /api/studio/conversations/:id/connectors/coolify-deploy ──
  router.post('/api/studio/conversations/:id/connectors/coolify-deploy', async (req, res) => {
    const { appUuid } = req.body as { appUuid?: string }
    if (!appUuid) { res.status(400).json({ error: 'appUuid required' }); return }

    try {
      const result = await triggerCoolifyDeploy({ appUuid }, connectorCtx(req as never))
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── GET /api/studio/connectors/unsplash/search ──
  router.get('/api/studio/connectors/unsplash/search', async (req, res) => {
    const { q, orientation } = req.query as { q?: string; orientation?: string }
    if (!q) { res.status(400).json({ error: 'q required' }); return }

    try {
      const photos = await searchUnsplash(
        { query: q, perPage: 12, orientation: (orientation as 'landscape' | 'portrait' | 'squarish') ?? 'landscape' },
        connectorCtx(req as never),
      )
      res.json(photos)
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── POST /api/studio/connectors/unsplash/track ──
  router.post('/api/studio/connectors/unsplash/track', async (req, res) => {
    const { downloadLocation } = req.body as { downloadLocation?: string }
    if (!downloadLocation) { res.status(400).json({ error: 'downloadLocation required' }); return }
    try {
      await trackUnsplashDownload(downloadLocation, connectorCtx(req as never))
      res.json({ ok: true })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── POST /api/studio/conversations/:id/connectors/kling-video ──
  router.post('/api/studio/conversations/:id/connectors/kling-video', async (req, res) => {
    const { prompt, duration, aspectRatio } = req.body as {
      prompt?: string; duration?: '5' | '10'; aspectRatio?: string
    }
    if (!prompt) { res.status(400).json({ error: 'prompt required' }); return }

    try {
      const task = await createKlingVideoTask(
        { prompt, duration, aspectRatio: (aspectRatio as '16:9' | '9:16' | '1:1') ?? '16:9' },
        connectorCtx(req as never),
      )
      res.status(201).json(task)
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── GET /api/studio/connectors/kling-video/:taskId ──
  router.get('/api/studio/connectors/kling-video/:taskId', async (req, res) => {
    try {
      const task = await pollKlingTask(req.params.taskId, connectorCtx(req as never))
      res.json(task)
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── POST /api/studio/conversations/:id/connectors/payload-publish ──
  router.post('/api/studio/conversations/:id/connectors/payload-publish', async (req, res) => {
    const { collection, slug, status: pubStatus } = req.body as {
      collection?: string; slug?: string; status?: 'draft' | 'published'
    }

    const html = getLastArtifact(req.params.id)
    if (!html) { res.status(404).json({ error: 'No artifact found' }); return }

    const db = openDb(ctx.skillbrainRoot)
    let title = 'Studio Export'
    try {
      const conv = new StudioStore(db).getConversation(req.params.id)
      if (conv) title = conv.title
    } finally { closeDb(db) }

    try {
      const result = await publishToPayload(
        { title, artifactHtml: html, collection, slug, status: pubStatus },
        connectorCtx(req as never),
      )
      res.json(result)
    } catch (e) { res.status(500).json({ error: (e as Error).message }) }
  })

  // ── POST /api/studio/conversations/:id/connectors/resend-email ──
  router.post('/api/studio/conversations/:id/connectors/resend-email', async (req, res) => {
    const { to, previewUrl } = req.body as { to?: string; previewUrl?: string }
    if (!to) { res.status(400).json({ error: 'to (email) required' }); return }

    const html = getLastArtifact(req.params.id)

    const db = openDb(ctx.skillbrainRoot)
    let title = 'Studio Export'
    try {
      const conv = new StudioStore(db).getConversation(req.params.id)
      if (conv) title = conv.title
    } finally { closeDb(db) }

    try {
      const result = await sendPreviewEmail(
        { to, convTitle: title, previewUrl, artifactHtml: html ?? undefined },
        connectorCtx(req as never),
      )
      res.json(result)
    } catch (e) { res.status(500).json({ error: (e as Error).message }) }
  })

  // ── POST /api/studio/conversations/:id/connectors/n8n-trigger ──
  router.post('/api/studio/conversations/:id/connectors/n8n-trigger', async (req, res) => {
    const { webhookPath, extra } = req.body as { webhookPath?: string; extra?: Record<string, unknown> }
    if (!webhookPath) { res.status(400).json({ error: 'webhookPath required' }); return }

    const db = openDb(ctx.skillbrainRoot)
    let convData: Record<string, unknown> = { conversationId: req.params.id }
    try {
      const store = new StudioStore(db)
      const conv = store.getConversation(req.params.id)
      if (conv) convData = {
        conversationId: conv.id,
        title: conv.title,
        status: conv.status,
        briefJson: conv.briefData ? JSON.stringify(conv.briefData) : null,
        updatedAt: conv.updatedAt,
        hasArtifact: !!getLastArtifact(req.params.id),
      }
    } finally { closeDb(db) }

    try {
      const result = await triggerN8nWorkflow(
        { webhookPath, payload: { ...convData, ...extra, _source: 'skillbrain-studio' } },
        connectorCtx(req as never),
      )
      res.json(result)
    } catch (e) { res.status(500).json({ error: (e as Error).message }) }
  })

  // ── GET /api/studio/connectors/plausible/preview ──
  router.get('/api/studio/connectors/plausible/preview', (req, res) => {
    try {
      const sampleHtml = '<!DOCTYPE html><html><head></head><body></body></html>'
      const result = injectPlausible(sampleHtml, connectorCtx(req as never))
      res.json({
        configured: result.injected,
        siteId: result.siteId,
        scriptSrc: result.scriptSrc,
        example: result.html,
      })
    } catch (e) {
      res.json({ configured: false, error: (e as Error).message })
    }
  })

  // ── POST /api/studio/conversations/:id/connectors/plausible-inject ──
  router.post('/api/studio/conversations/:id/connectors/plausible-inject', (req, res) => {
    const html = getLastArtifact(req.params.id)
    if (!html) { res.status(404).json({ error: 'No artifact found' }); return }

    try {
      const result = injectPlausible(html, connectorCtx(req as never))
      if (!result.injected) {
        res.status(400).json({ error: 'Could not inject script — HTML structure unrecognized' })
        return
      }
      res.json({
        injected: true,
        siteId: result.siteId,
        html: result.html,
      })
    } catch (e) { res.status(500).json({ error: (e as Error).message }) }
  })

  // ── POST /api/studio/connectors/odoo-lead ──
  router.post('/api/studio/connectors/odoo-lead', async (req, res) => {
    const { name, email, phone, description, partnerName, source } = req.body as {
      name?: string; email?: string; phone?: string
      description?: string; partnerName?: string; source?: string
    }
    if (!name) { res.status(400).json({ error: 'name required' }); return }

    try {
      const result = await createOdooLead(
        { name, email, phone, description, partnerName, source: source ?? 'SkillBrain Studio' },
        connectorCtx(req as never),
      )
      res.status(201).json(result)
    } catch (e) { res.status(500).json({ error: (e as Error).message }) }
  })

  // ── POST /api/studio/form-submit ──
  // Public endpoint for forms in previews — creates Odoo lead + NocoDB row. Always returns 200.
  router.post('/api/studio/form-submit', async (req, res) => {
    const { name, email, phone, message, company, source, _tableId } = req.body as {
      name?: string; email?: string; phone?: string
      message?: string; company?: string; source?: string
      _tableId?: string
    }

    const leadName = name ?? email ?? 'Nuovo lead'
    const results: Record<string, unknown> = {}

    try {
      const lead = await createOdooLead({
        name: leadName,
        email, phone,
        partnerName: company,
        description: message,
        source: source ?? 'Studio Form',
      }, connectorCtx(req as never))
      results['odoo'] = { id: lead.id, adminUrl: lead.adminUrl }
    } catch (e) {
      results['odoo'] = { error: (e as Error).message }
    }

    try {
      const row = await insertNocoDbRow({
        tableId: _tableId,
        row: {
          Name: leadName, Email: email ?? '', Phone: phone ?? '',
          Message: message ?? '', Company: company ?? '',
          Source: source ?? 'Studio Form', CreatedAt: new Date().toISOString(),
        },
      }, connectorCtx(req as never))
      results['nocodb'] = { id: row.id }
    } catch (e) {
      results['nocodb'] = { error: (e as Error).message }
    }

    res.json({ ok: true, results })
  })

  // ── POST /api/studio/connectors/nocodb-row ──
  router.post('/api/studio/connectors/nocodb-row', async (req, res) => {
    const { tableId, row } = req.body as { tableId?: string; row?: Record<string, unknown> }
    if (!row) { res.status(400).json({ error: 'row required' }); return }

    try {
      const result = await insertNocoDbRow({ tableId, row }, connectorCtx(req as never))
      res.status(201).json(result)
    } catch (e) { res.status(500).json({ error: (e as Error).message }) }
  })

  // ── POST /api/studio/conversations/:id/connectors/smtp-email ──
  router.post('/api/studio/conversations/:id/connectors/smtp-email', async (req, res) => {
    const { to, subject, bodyHtml, attachArtifact } = req.body as {
      to?: string; subject?: string; bodyHtml?: string; attachArtifact?: boolean
    }
    if (!to || !subject) { res.status(400).json({ error: 'to and subject required' }); return }

    const attachments: Array<{ filename: string; content: Buffer }> = []
    if (attachArtifact) {
      const html = getLastArtifact(req.params.id)
      if (html) {
        const db2 = openDb(ctx.skillbrainRoot)
        let slug = 'artifact'
        try {
          const conv = new StudioStore(db2).getConversation(req.params.id)
          if (conv) slug = conv.title.replace(/[^a-z0-9]/gi, '-').slice(0, 40)
        } finally { closeDb(db2) }
        attachments.push({ filename: `${slug}.html`, content: Buffer.from(html, 'utf-8') })
      }
    }

    try {
      const result = await sendSmtpEmail(
        {
          to,
          subject,
          html: bodyHtml ?? `<p>Preview from SkillBrain Studio.</p>`,
          attachments: attachments.length ? attachments : undefined,
        },
        connectorCtx(req as never),
      )
      res.json(result)
    } catch (e) { res.status(500).json({ error: (e as Error).message }) }
  })

  // ── POST /api/studio/conversations/:id/connectors/drive-upload ──
  router.post('/api/studio/conversations/:id/connectors/drive-upload', async (req, res) => {
    const { folderId } = req.body as { folderId?: string }

    const html = getLastArtifact(req.params.id)
    if (!html) { res.status(404).json({ error: 'no artifact for this conversation' }); return }

    const db3 = openDb(ctx.skillbrainRoot)
    let convTitle = 'studio-export'
    try {
      const store = new StudioStore(db3)
      const conv = store.getConversation(req.params.id)
      if (conv) convTitle = conv.title
    } finally { closeDb(db3) }

    const uploadHtml = html
    const slug = convTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
    const date = new Date().toISOString().slice(0, 10)
    const filename = `studio-${slug}-${date}.html`

    try {
      const result = await uploadToGoogleDrive(
        {
          filename,
          content: Buffer.from(uploadHtml, 'utf-8'),
          mimeType: 'text/html',
          folderId,
          description: `SkillBrain Studio export: ${convTitle}`,
        },
        connectorCtx(req as never),
      )
      res.json(result)
    } catch (e) { res.status(500).json({ error: (e as Error).message }) }
  })

  return router
}
