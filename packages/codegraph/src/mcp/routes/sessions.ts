/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { Router } from 'express'
import { openDb, closeDb } from '../../storage/db.js'
import { MemoryStore } from '../../storage/memory-store.js'
import type { RouteContext } from './index.js'

export function createSessionsRouter(ctx: RouteContext): Router {
  const router = Router()

  router.get('/api/sessions', (req, res) => {
    const limit = parseInt((req.query as any).limit || '20', 10)
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      const sessions = store.recentSessions(limit)
      closeDb(db)
      res.json({ sessions })
    } catch {
      res.json({ sessions: [] })
    }
  })

  router.delete('/api/sessions/:id', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      store.deleteSession(req.params.id)
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.put('/api/sessions/:id', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      store.updateSession(req.params.id, req.body || {})
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/api/sessions/cleanup-duplicates', (_req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      const pending = store.pendingSessions()

      const byProject = new Map<string, any[]>()
      for (const s of pending) {
        if (!s.project) continue
        if (!byProject.has(s.project)) byProject.set(s.project, [])
        byProject.get(s.project)!.push(s)
      }

      let deleted = 0
      for (const [, sessions] of byProject) {
        sessions.sort((a: any, b: any) => b.startedAt.localeCompare(a.startedAt))
        for (let i = 1; i < sessions.length; i++) {
          store.deleteSession(sessions[i].id)
          deleted++
        }
      }

      closeDb(db)
      res.json({ ok: true, deleted })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}
