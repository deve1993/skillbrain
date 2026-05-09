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

  // ── Generate DS via AI ──────────────────────────────────────────────────────

  router.post('/api/studio/ds/generate', (req, res) => {
    const { brief } = req.body || {}
    if (!brief || typeof brief !== 'string' || !brief.trim()) {
      res.status(400).json({ error: 'brief must be a non-empty string' })
      return
    }
    try {
      const job = createDsJob(brief.trim())
      enqueueDsJob(job.id, {
        skillbrainRoot: ctx.skillbrainRoot,
        anthropicApiKey: ctx.anthropicApiKey,
        userId: (req as any).userId ?? '__local__',
      })
      res.status(201).json({ jobId: job.id })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── SSE Stream for DS generation job ───────────────────────────────────────

  router.get('/api/studio/ds/stream/:jobId', (req, res) => {
    const { jobId } = req.params
    try {
      const job = getDsJob(jobId)
      if (!job) {
        res.status(404).json({ error: 'Job not found' })
        return
      }

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.flushHeaders()

      if (job.status === 'done') {
        res.write(`data: ${JSON.stringify({ type: 'done', result: job.result })}\n\n`)
        res.end()
        return
      }

      if (job.status === 'error') {
        res.write(`data: ${JSON.stringify({ type: 'error', message: job.error })}\n\n`)
        res.end()
        return
      }

      const unsubscribe = subscribeDsJob(jobId, res)
      req.on('close', unsubscribe)
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Import: CSS vars ────────────────────────────────────────────────────────

  router.post('/api/studio/ds/import/css', (req, res) => {
    const { css } = req.body || {}
    try {
      const result = parseCssVars(css ?? '')
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Import: JSON tokens ─────────────────────────────────────────────────────

  router.post('/api/studio/ds/import/json', (req, res) => {
    const { tokens } = req.body || {}
    try {
      const parsed = typeof tokens === 'string' ? JSON.parse(tokens) : tokens
      const result = parseJsonTokens(parsed)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Import: Tailwind config ─────────────────────────────────────────────────

  router.post('/api/studio/ds/import/tailwind', (req, res) => {
    const { config } = req.body || {}
    try {
      const result = parseTailwindConfig(config ?? '')
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Import: Figma variables ─────────────────────────────────────────────────

  router.post('/api/studio/ds/import/figma', async (req, res) => {
    const { fileUrl, accessToken } = req.body || {}
    try {
      const fileKeyMatch = String(fileUrl ?? '').match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/)
      if (!fileKeyMatch) {
        res.status(400).json({ error: 'Invalid Figma file URL' })
        return
      }
      const fileKey = fileKeyMatch[1]

      const token: string | undefined = accessToken || process.env.FIGMA_TOKEN
      if (!token) {
        res.status(400).json({ error: 'No Figma access token provided and FIGMA_TOKEN env var is not set' })
        return
      }

      const apiRes = await fetch(
        `https://api.figma.com/v1/files/${fileKey}/variables/local`,
        { headers: { 'X-Figma-Token': token } },
      )
      if (!apiRes.ok) {
        res.status(apiRes.status).json({ error: `Figma API error: ${apiRes.statusText}` })
        return
      }
      const data: unknown = await apiRes.json()
      const result = parseFigmaVariables(data)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Export: CSS ─────────────────────────────────────────────────────────────

  router.get('/api/design-systems/:project/export/css', (req, res) => {
    try {
      const db = openDb(root)
      const store = new ComponentsStore(db)
      try {
        const ds = store.getDesignSystem(req.params.project)
        if (!ds) { res.status(404).json({ error: 'Design system not found' }); return }
        const css = exportToCss(ds)
        res.setHeader('Content-Type', 'text/css')
        res.send(css)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Export: W3C JSON ────────────────────────────────────────────────────────

  router.get('/api/design-systems/:project/export/json', (req, res) => {
    try {
      const db = openDb(root)
      const store = new ComponentsStore(db)
      try {
        const ds = store.getDesignSystem(req.params.project)
        if (!ds) { res.status(404).json({ error: 'Design system not found' }); return }
        res.json(exportToW3CJson(ds))
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Export: Tailwind config ─────────────────────────────────────────────────

  router.get('/api/design-systems/:project/export/tailwind', (req, res) => {
    try {
      const db = openDb(root)
      const store = new ComponentsStore(db)
      try {
        const ds = store.getDesignSystem(req.params.project)
        if (!ds) { res.status(404).json({ error: 'Design system not found' }); return }
        const tw = exportToTailwind(ds)
        res.setHeader('Content-Type', 'text/plain')
        res.send(tw)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Upsert Design System ────────────────────────────────────────────────────

  router.post('/api/design-systems', (req, res) => {
    const body = req.body || {}
    if (!body.project || typeof body.project !== 'string' || !body.project.trim()) {
      res.status(400).json({ error: 'project field is required' })
      return
    }
    try {
      const db = openDb(root)
      const store = new ComponentsStore(db)
      try {
        const result = store.upsertDesignSystem(body)
        res.status(201).json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  return router
}
