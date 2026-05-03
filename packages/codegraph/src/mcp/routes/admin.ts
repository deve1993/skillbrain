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
import { OAuthStore } from '@skillbrain/storage'
import { rotateKey } from '@skillbrain/storage'
import type { RouteContext } from './index.js'

function generateApiKey(): string {
  return 'sk-codegraph-' + crypto.randomBytes(12).toString('hex')
}

export function createAdminRouter(ctx: RouteContext): Router {
  const router = Router()

  router.get('/api/admin/team', ctx.requireAdmin, (_req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const users = db.prepare(`
        SELECT u.id, u.name, u.email, u.role, u.created_at,
               json_group_array(json_object(
                 'id', k.id, 'label', k.label,
                 'last_used_at', k.last_used_at,
                 'created_at', k.created_at,
                 'revoked', CASE WHEN k.revoked_at IS NOT NULL THEN 1 ELSE 0 END
               )) as keys
        FROM users u
        LEFT JOIN api_keys k ON k.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `).all()
      closeDb(db)
      res.json({ users })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.post('/api/admin/team/users', ctx.requireAdmin, json(), async (req, res) => {
    const { name, email, label } = req.body as { name?: string; email?: string; label?: string }
    if (!name) { res.status(400).json({ error: 'name required' }); return }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const userId = randomUUID().replace(/-/g, '').slice(0, 12)
      const keyId = randomUUID().replace(/-/g, '').slice(0, 12)
      const plainKey = generateApiKey()
      const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex')
      const plainPw = ctx.generatePassword()
      const { hash: pwHash, salt: pwSalt } = await ctx.hashPassword(plainPw)
      db.prepare(`INSERT INTO users (id, name, email, role, password_hash, password_salt) VALUES (?, ?, ?, 'member', ?, ?)`)
        .run(userId, name, email ?? null, pwHash, pwSalt)
      db.prepare(`INSERT INTO api_keys (id, user_id, key_hash, label) VALUES (?, ?, ?, ?)`)
        .run(keyId, userId, keyHash, label ?? `${name}'s key`)
      closeDb(db)
      let emailSent: boolean | null = null
      if (email) {
        try {
          await ctx.sendInviteEmail(email, name, plainPw, plainKey)
          emailSent = true
        } catch (err) {
          console.error('[team] invite email failed:', err)
          emailSent = false
        }
      }
      res.json({ userId, keyId, key: plainKey, password: plainPw, emailSent })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.post('/api/admin/rotate-key', ctx.requireAdmin, json(), (req, res) => {
    const { newKey } = req.body || {}
    if (!newKey || typeof newKey !== 'string') {
      res.status(400).json({ error: 'newKey (string) required' }); return
    }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const rotated = rotateKey(db, newKey)
      closeDb(db)
      res.json({
        ok: true,
        rotated,
        message: `${rotated} secret(s) re-encrypted. NOW update ENCRYPTION_KEY=${newKey} in Coolify and redeploy.`,
      })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  router.delete('/api/admin/team/keys/:id', ctx.requireAdmin, (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      db.prepare(`UPDATE api_keys SET revoked_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), req.params.id)
      closeDb(db)
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.put('/api/admin/team/users/:id', ctx.requireAdmin, json(), (req, res) => {
    const { name, email, role } = req.body as { name?: string; email?: string; role?: string }
    if (!name) { res.status(400).json({ error: 'name required' }); return }
    if (role && !['admin', 'member'].includes(role)) { res.status(400).json({ error: 'invalid role' }); return }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const result = db.prepare(`UPDATE users SET name = ?, email = ?, role = COALESCE(?, role) WHERE id = ?`)
        .run(name, email ?? null, role ?? null, req.params.id)
      closeDb(db)
      if (result.changes === 0) { res.status(404).json({ error: 'User not found' }); return }
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.delete('/api/admin/team/users/:id', ctx.requireAdmin, (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      db.prepare(`DELETE FROM api_keys WHERE user_id = ?`).run(req.params.id)
      const result = db.prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id)
      closeDb(db)
      if (result.changes === 0) { res.status(404).json({ error: 'User not found' }); return }
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.get('/api/admin/oauth/clients', ctx.requireAdmin, (_req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new OAuthStore(db)
      const clients = store.listClients().map((c) => ({
        client_id: c.client_id,
        client_name: c.client_name,
        client_uri: c.client_uri,
        redirect_uris: JSON.parse(c.redirect_uris || '[]'),
        grant_types: JSON.parse(c.grant_types || '[]'),
        token_endpoint_auth_method: c.token_endpoint_auth_method,
        created_at: c.created_at,
        has_secret: !!c.client_secret_hash,
      }))
      closeDb(db)
      res.json({ clients })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.delete('/api/admin/oauth/clients/:id', ctx.requireAdmin, (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new OAuthStore(db)
      store.revokeClientTokens(String(req.params.id))
      store.deleteClient(String(req.params.id))
      closeDb(db)
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  return router
}
