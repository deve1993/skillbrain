/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { Router, json } from 'express'
import { randomUUID } from 'node:crypto'
import crypto from 'node:crypto'
import { openDb, closeDb } from '@skillbrain/storage'
import { UsersEnvStore } from '@skillbrain/storage'
import { AuditStore } from '@skillbrain/storage'
import { ENV_TEMPLATES } from '../env-templates.js'
import type { RouteContext } from './index.js'

export function createUserProfileRouter(ctx: RouteContext): Router {
  const router = Router()

  // Self-service profile
  router.get('/api/me', (req, res) => {
    const userId = (req as any).userId
    if (!userId) {
      // No auth configured (local dev): return an anonymous local user so the
      // SPA boots without redirecting to /login.html. In production ADMIN_EMAIL
      // is set and this branch never fires.
      if (!process.env.ADMIN_EMAIL) {
        res.json({ user: { id: 'anonymous', name: 'Local', email: 'anonymous@local', role: 'admin', created_at: new Date().toISOString() } })
        return
      }
      res.status(401).json({ error: 'Unauthorized' }); return
    }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(userId) as any
      closeDb(db)
      if (!user) { res.status(404).json({ error: 'User not found' }); return }
      res.json({ user })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.get('/api/me/api-keys', (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const keys = db.prepare(
        `SELECT id, label, created_at, last_used_at, CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END as revoked
         FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`
      ).all(userId)
      closeDb(db)
      res.json({ keys })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.post('/api/me/api-keys', json(), (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { label } = req.body || {}
    try {
      const db = openDb(ctx.skillbrainRoot)
      const keyId = randomUUID().replace(/-/g, '').slice(0, 12)
      const plainKey = 'sk-codegraph-' + crypto.randomBytes(12).toString('hex')
      const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex')
      db.prepare(`INSERT INTO api_keys (id, user_id, key_hash, label) VALUES (?, ?, ?, ?)`)
        .run(keyId, userId, keyHash, label || 'My key')
      closeDb(db)
      res.json({ id: keyId, key: plainKey, label: label || 'My key' })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.delete('/api/me/api-keys/:id', (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const key = db.prepare('SELECT id FROM api_keys WHERE id = ? AND user_id = ?').get(req.params.id, userId) as any
      if (!key) { closeDb(db); res.status(404).json({ error: 'Key not found' }); return }
      db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.id)
      closeDb(db)
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // master.env (user-scoped)
  router.get('/api/me/env', (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    try {
      const { category, service } = req.query as { category?: string; service?: string }
      const db = openDb(ctx.skillbrainRoot)
      const vars = new UsersEnvStore(db).listEnv(userId, { category: category as any, service })
      const cap = new UsersEnvStore(db).capability(userId)
      closeDb(db)
      res.json({ vars, capability: cap })
    } catch (err: any) {
      console.error('[user_env GET]', err)
      res.status(500).json({ error: err.message, code: err.code })
    }
  })

  router.post('/api/me/env/reveal', json(), (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { varName } = req.body || {}
    if (!varName) { res.status(400).json({ error: 'varName required' }); return }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const value = new UsersEnvStore(db).getEnv(userId, varName)
      if (value === undefined) {
        closeDb(db); res.status(404).json({ error: 'Not found' }); return
      }
      new AuditStore(db).log({
        entityType: 'user_env', entityId: varName,
        action: 'reveal', reviewedBy: userId,
      })
      closeDb(db)
      res.json({ varName, value })
    } catch (err: any) {
      console.error('[user_env reveal]', err)
      res.status(500).json({ error: err.message, code: err.code })
    }
  })

  router.put('/api/me/env/:varName', json(), (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { value, category, service, description, isSecret } = req.body || {}
    if (typeof value !== 'string' || value.length === 0) {
      res.status(400).json({ error: 'value (string) required' }); return
    }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new UsersEnvStore(db)
      const existed = store.hasEnv(userId, req.params.varName)
      const saved = store.setEnv(userId, req.params.varName, value, {
        category, service, description, isSecret,
      })
      new AuditStore(db).log({
        entityType: 'user_env', entityId: req.params.varName,
        action: existed ? 'update' : 'create', reviewedBy: userId,
        metadata: { category: saved.category, service: saved.service },
      })
      closeDb(db)
      res.json({ ok: true, var: saved })
    } catch (err: any) {
      console.error('[user_env PUT]', req.params.varName, err)
      res.status(500).json({ error: err.message, code: err.code })
    }
  })

  router.delete('/api/me/env/:varName', (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const removed = new UsersEnvStore(db).deleteEnv(userId, req.params.varName)
      if (!removed) { closeDb(db); res.status(404).json({ error: 'Not found' }); return }
      new AuditStore(db).log({
        entityType: 'user_env', entityId: req.params.varName,
        action: 'delete', reviewedBy: userId,
      })
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      console.error('[user_env DELETE]', req.params.varName, err)
      res.status(500).json({ error: err.message, code: err.code })
    }
  })

  router.post('/api/me/env/import', json(), (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { envContent, category, service } = req.body || {}
    if (typeof envContent !== 'string' || envContent.length === 0) {
      res.status(400).json({ error: 'envContent (string) required' }); return
    }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const result = new UsersEnvStore(db).importEnv(userId, envContent, { category, service })
      new AuditStore(db).log({
        entityType: 'user_env', entityId: '__bulk__',
        action: 'import', reviewedBy: userId,
        metadata: { saved: result.saved, errorCount: result.errors.length },
      })
      closeDb(db)
      res.json({ ok: true, ...result })
    } catch (err: any) {
      console.error('[user_env import]', err)
      res.status(500).json({ error: err.message, code: err.code })
    }
  })

  router.post('/api/me/env/export', json(), (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { category, service } = req.body || {}
    try {
      const db = openDb(ctx.skillbrainRoot)
      const vars = new UsersEnvStore(db).getAllEnv(userId, { category, service })
      new AuditStore(db).log({
        entityType: 'user_env', entityId: '__bulk__',
        action: 'export', reviewedBy: userId,
        metadata: { count: Object.keys(vars).length },
      })
      closeDb(db)
      const content = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n')
      res.json({ content, count: Object.keys(vars).length })
    } catch (err: any) {
      console.error('[user_env export]', err)
      res.status(500).json({ error: err.message, code: err.code })
    }
  })

  router.get('/api/me/env/templates', (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    res.json({ templates: ENV_TEMPLATES })
  })

  // Audit log
  router.get('/api/audit/:entityType/:entityId', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const entries = new AuditStore(db).listForEntity(req.params.entityType, req.params.entityId)
      closeDb(db)
      res.json({ entries })
    } catch {
      res.json({ entries: [] })
    }
  })

  return router
}
