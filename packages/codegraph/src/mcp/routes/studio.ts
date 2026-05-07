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
import { studioRunner } from '../studio-runner.js'

export function createStudioRouter(ctx: RouteContext): Router {
  const router = Router()
  const root = ctx.skillbrainRoot

  // ── Conversations ──

  router.get('/api/studio/conversations', (req, res) => {
    try {
      const limit = Math.min(200, parseInt((req.query as Record<string, string>).limit || '50', 10))
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const result = store.listConversations({ limit })
        res.json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  router.post('/api/studio/conversations', (req, res) => {
    const { title, brief, skillId, dsId, directionId } = req.body || {}
    if (!title) { res.status(400).json({ error: 'title required' }); return }
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const result = store.createConversation({ title, briefData: brief ?? null, skillId, dsId, directionId })
        res.status(201).json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  router.get('/api/studio/conversations/:id', (req, res) => {
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const result = store.getConversation(req.params.id)
        if (!result) { res.status(404).json({ error: 'Conversation not found' }); return }
        res.json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  router.delete('/api/studio/conversations/:id', (req, res) => {
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        store.deleteConversation(req.params.id)
        res.status(204).send()
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Messages ──

  router.get('/api/studio/conversations/:id/messages', (req, res) => {
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const result = store.listMessages(req.params.id)
        res.json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  router.post('/api/studio/conversations/:id/messages', (req, res) => {
    const { role, content, artifactHtml } = req.body || {}
    if (!['user', 'assistant', 'artifact'].includes(role)) {
      res.status(400).json({ error: 'role must be user|assistant|artifact' }); return
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'content required' }); return
    }
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const result = store.addMessage({ convId: req.params.id, role, content, artifactHtml: artifactHtml ?? null })
        res.status(201).json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Generation ──

  router.post('/api/studio/conversations/:id/generate', (req, res) => {
    const { agentModel, critiqueModel } = req.body || {}
    const resolvedAgentModel: string = agentModel || 'claude-sonnet-4-6'
    const resolvedCritiqueModel: string = critiqueModel || 'claude-haiku-4-5-20251001'
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const contextBlock = store.buildContextBlock(req.params.id)
        const job = store.createJob({
          convId: req.params.id,
          agentModel: resolvedAgentModel,
          critiqueModel: resolvedCritiqueModel,
          promptSnapshot: contextBlock,
        })
        // Fire-and-forget: avvia il runner
        studioRunner.enqueue(job.id, {
          skillbrainRoot: ctx.skillbrainRoot,
          anthropicApiKey: ctx.anthropicApiKey,
        })
        res.status(201).json({ jobId: job.id, contextBlock })
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Jobs ──

  router.get('/api/studio/jobs/:jobId', (req, res) => {
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const result = store.getJob(req.params.jobId)
        if (!result) { res.status(404).json({ error: 'Job not found' }); return }
        res.json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  router.get('/api/studio/jobs/:jobId/stream', (req, res) => {
    const { jobId } = req.params

    const db = openDb(ctx.skillbrainRoot)
    let job: unknown
    try {
      const store = new StudioStore(db)
      job = store.getJob(jobId)
    } finally {
      closeDb(db)
    }

    if (!job) {
      res.status(404).json({ error: 'Job not found' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    try {
      res.write(`data: ${JSON.stringify({ type: 'status', job })}\n\n`)
    } catch { /* client disconnected before initial write */ }

    const unsubscribe = studioRunner.subscribe(jobId, res)

    req.on('close', () => {
      unsubscribe()
    })
  })

  // ── Design Systems ──

  router.get('/api/studio/design-systems', (req, res) => {
    try {
      const q = req.query as Record<string, string>
      const search = q.search || undefined
      const limit = Math.min(200, parseInt(q.limit || '72', 10))
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const result = store.listDesignSystems({ search, limit })
        res.json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  router.get('/api/studio/design-systems/:id', (req, res) => {
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const result = store.getDesignSystem(req.params.id)
        if (!result) { res.status(404).json({ error: 'Design System not found' }); return }
        res.json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  router.put('/api/studio/design-systems/:id', (req, res) => {
    const { customTokensJson, customNotes } = req.body || {}
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        store.updateDesignSystem(req.params.id, { customTokensJson, customNotes })
        const result = store.getDesignSystem(req.params.id)
        res.json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Design System Versions ──

  router.post('/api/studio/design-systems/:id/versions', (req, res) => {
    const { changeJson } = req.body || {}
    const authorEmail = (req as unknown as { userId?: string }).userId ?? 'anonymous'
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const result = store.createDsVersion({ dsId: req.params.id, authorEmail, changeJson: changeJson ?? '{}' })
        res.status(201).json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  router.get('/api/studio/design-systems/:id/versions', (req, res) => {
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const result = store.listDsVersions(req.params.id)
        res.json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // ── Skills & Directions ──

  router.get('/api/studio/skills', (_req, res) => {
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const result = store.listSkills()
        res.json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  router.get('/api/studio/directions', (_req, res) => {
    try {
      const db = openDb(root)
      const store = new StudioStore(db)
      try {
        const result = store.listDirections()
        res.json(result)
      } finally {
        closeDb(db)
      }
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  return router
}
