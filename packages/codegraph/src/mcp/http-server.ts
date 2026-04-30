/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

/**
 * MCP HTTP Server — Dual mode entry point
 *
 * Serves both:
 * - MCP protocol via Streamable HTTP (POST/GET/DELETE /mcp)
 * - Dashboard web UI and API (GET /, /api/health, /api/data)
 *
 * Usage: node cli.js mcp --http [--port 3737] [--auth-token secret]
 */

import express, { type Request } from 'express'
import { randomUUID } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import Anthropic from '@anthropic-ai/sdk'
import { createMcpServer } from './server.js'
import { createOAuthRouter, verifyOAuthBearer } from './oauth-router.js'
import { loadRegistry, upsertRegistry } from '../storage/registry.js'
import { openDb, closeDb } from '../storage/db.js'
import { MemoryStore } from '../storage/memory-store.js'
import { SkillsStore } from '../storage/skills-store.js'
import { ProjectsStore } from '../storage/projects-store.js'
import { ComponentsStore } from '../storage/components-store.js'
import { AuditStore } from '../storage/audit-store.js'
import { OAuthStore } from '../storage/oauth-store.js'
import { UsersEnvStore } from '../storage/users-env-store.js'
import { assertEncryptionUsable, decrypt, rotateKey } from '../storage/crypto.js'
import { dashboardUrl } from '../constants.js'

// Curated catalog for the hub's "Add credential" flow. Adding to this list
// surfaces a one-click template; everything else is still addable via the
// generic form. Order matters — most-common services first.
const ENV_TEMPLATES = [
  { service: 'anthropic', varName: 'ANTHROPIC_API_KEY', category: 'api_key', label: 'Anthropic (Claude)', helpUrl: 'https://console.anthropic.com/settings/keys', description: 'Personal Claude API key for direct SDK calls' },
  { service: 'openai',    varName: 'OPENAI_API_KEY',    category: 'api_key', label: 'OpenAI',             helpUrl: 'https://platform.openai.com/api-keys',           description: 'OpenAI API key' },
  { service: 'github',    varName: 'GITHUB_TOKEN',      category: 'api_key', label: 'GitHub PAT',         helpUrl: 'https://github.com/settings/tokens',             description: 'Personal access token (repo scope)' },
  { service: 'supabase',  varName: 'SUPABASE_ACCESS_TOKEN', category: 'api_key', label: 'Supabase',       helpUrl: 'https://supabase.com/dashboard/account/tokens',  description: 'Personal access token for the Supabase CLI' },
  { service: 'vercel',    varName: 'VERCEL_TOKEN',      category: 'api_key', label: 'Vercel',             helpUrl: 'https://vercel.com/account/tokens',              description: 'API token for vercel CLI / API' },
  { service: 'resend',    varName: 'RESEND_API_KEY',    category: 'api_key', label: 'Resend',             helpUrl: 'https://resend.com/api-keys',                    description: 'Transactional email API key' },
  { service: 'stripe',    varName: 'STRIPE_SECRET_KEY', category: 'api_key', label: 'Stripe',             helpUrl: 'https://dashboard.stripe.com/apikeys',           description: 'Secret key for the Stripe SDK' },
  { service: 'figma',     varName: 'FIGMA_TOKEN',       category: 'api_key', label: 'Figma',              helpUrl: 'https://www.figma.com/settings',                 description: 'Personal access token for the Figma API' },
  { service: 'cloudflare',varName: 'CLOUDFLARE_API_TOKEN', category: 'api_key', label: 'Cloudflare',     helpUrl: 'https://dash.cloudflare.com/profile/api-tokens', description: 'API token (workers/pages/dns scopes)' },
  { service: 'coolify',   varName: 'COOLIFY_API_TOKEN', category: 'api_key', label: 'Coolify',            helpUrl: 'https://coolify.io',                              description: 'API token for the self-hosted Coolify instance' },
  { service: 'odoo',      varName: 'ODOO_API_KEY',      category: 'api_key', label: 'Odoo CRM',           helpUrl: 'https://fl1.cz/odoo',                            description: 'API key for fl1.cz/odoo CRM' },
] as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SKILLBRAIN_ROOT = process.env.SKILLBRAIN_ROOT || process.cwd()
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || ''
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL || ''
const PUBLIC_ISSUER  = process.env.OAUTH_ISSUER || process.env.PUBLIC_URL || dashboardUrl()
const SMTP_HOST      = process.env.SMTP_HOST || ''
const SMTP_PORT      = parseInt(process.env.SMTP_PORT || '587', 10)
const SMTP_USER      = process.env.SMTP_USER || ''
const SMTP_PASS      = process.env.SMTP_PASS || ''
const SMTP_FROM      = process.env.SMTP_FROM || 'SkillBrain <noreply@memory.fl1.it>'
const SMTP_SECURE      = process.env.SMTP_SECURE === 'true'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const LEGACY_TOKEN_USER_EMAIL = process.env.LEGACY_TOKEN_USER_EMAIL || ''

// ── Password helpers ──
const scryptAsync = promisify(crypto.scrypt)

async function hashPassword(plain: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = (await scryptAsync(plain, salt, 64) as Buffer).toString('hex')
  return { hash, salt }
}

async function verifyPassword(plain: string, hash: string, salt: string): Promise<boolean> {
  try {
    const derived = (await scryptAsync(plain, salt, 64) as Buffer)
    const stored = Buffer.from(hash, 'hex')
    return derived.length === stored.length && crypto.timingSafeEqual(derived, stored)
  } catch { return false }
}

function generatePassword(len = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from(crypto.randomBytes(len)).map(b => chars[b % chars.length]).join('')
}

async function sendInviteEmail(to: string, name: string, password: string, apiKey: string): Promise<void> {
  if (!SMTP_HOST || !to) return
  const t = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE, auth: { user: SMTP_USER, pass: SMTP_PASS } })
  await t.sendMail({
    from: SMTP_FROM,
    to,
    subject: 'Accesso a SkillBrain',
    text: [
      `Ciao ${name},`,
      '',
      'Sei stato aggiunto al team SkillBrain.',
      '',
      `Dashboard: ${dashboardUrl()}/`,
      `Email:     ${to}`,
      `Password:  ${password}`,
      '',
      'API key per Claude Code:',
      `  SKILLBRAIN_MCP_URL=${dashboardUrl()}/mcp`,
      `  CODEGRAPH_AUTH_TOKEN=${apiKey}`,
      '',
      'Cambia la password dopo il primo accesso dal menu in alto a destra.',
      'Conserva questa email in un posto sicuro.',
    ].join('\n'),
  })
}

function loadRegistrySafe() {
  try {
    return loadRegistry()
  } catch {
    return []
  }
}

// ── Dashboard data functions (imported from dashboard logic) ──

function getMemoryGraphStats() {
  try {
    const db = openDb(SKILLBRAIN_ROOT)
    const store = new MemoryStore(db)
    const stats = store.stats()
    const topMemories = store.query({ status: 'active', limit: 20 })
    const contradictions = store.getContradictions()
    const recentSessions = store.recentSessions(5)
    closeDb(db)
    return {
      ...stats,
      topMemories: topMemories.map((m) => ({
        id: m.id, type: m.type, confidence: m.confidence,
        context: m.context.slice(0, 120), tags: m.tags, skill: m.skill,
      })),
      contradictions,
      recentSessions: recentSessions.map((s) => ({
        id: s.id, session: s.sessionName, started: s.startedAt,
        summary: s.summary, memories: s.memoriesCreated,
      })),
    }
  } catch {
    return { total: 0, byType: {}, byStatus: {}, edges: 0, topMemories: [], contradictions: [], recentSessions: [] }
  }
}

// ── HTTP Server ──

export async function startHttpServer(port: number, authToken?: string): Promise<void> {
  const app = express()
  // Skip global json parser for /api/codegraph/upload — it has its own with a higher limit
  app.use((req, res, next) => {
    if (req.path === '/api/codegraph/upload') return next()
    express.json()(req, res, next)
  })

  // Session map for MCP transports
  const transports = new Map<string, StreamableHTTPServerTransport>()
  // SSE transport sessions (legacy MCP transport, e.g. for ChatGPT)
  const sseTransports = new Map<string, SSEServerTransport>()

  // ── Auth middleware for /mcp + /sse routes (Bearer token) ──
  // On success, sets (req as any).mcpUserId when the token is bound to a user
  // (personal API key, OAuth bearer, or legacy token with LEGACY_TOKEN_USER_EMAIL set).
  const bearerAuth: express.RequestHandler = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      res.setHeader('WWW-Authenticate',
        `Bearer realm="mcp", resource_metadata="${PUBLIC_ISSUER}/.well-known/oauth-protected-resource"`)
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    // 1. Legacy env-var token (backward compat)
    // If LEGACY_TOKEN_USER_EMAIL is set, resolve it to a real userId so user-scoped
    // tools (user_env_*) work without requiring a personal API key.
    if (authToken && token === authToken) {
      if (LEGACY_TOKEN_USER_EMAIL) {
        try {
          const db = openDb(SKILLBRAIN_ROOT)
          let user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(LEGACY_TOKEN_USER_EMAIL) as { id: string } | undefined
          if (!user) {
            // Auto-bootstrap: create the owner user on first use
            const newId = randomUUID().replace(/-/g, '').slice(0, 12)
            db.prepare(`INSERT INTO users (id, name, email, role) VALUES (?, 'Admin', ?, 'admin')`)
              .run(newId, LEGACY_TOKEN_USER_EMAIL)
            user = { id: newId }
            console.log(`[auth] Auto-created owner user for ${LEGACY_TOKEN_USER_EMAIL} (id=${newId})`)
          }
          closeDb(db)
          ;(req as any).mcpUserId = user.id
        } catch { /* users table not yet migrated — proceed without userId */ }
      }
      next(); return
    }
    // 2. Personal API keys table
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const hash = crypto.createHash('sha256').update(token).digest('hex')
      const key = db.prepare(
        `SELECT id, user_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL`
      ).get(hash) as { id: string; user_id: string } | undefined
      if (key) {
        db.prepare(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`)
          .run(new Date().toISOString(), key.id)
        closeDb(db)
        ;(req as any).mcpUserId = key.user_id
        next(); return
      }
      closeDb(db)
    } catch { /* api_keys table not yet migrated */ }
    // 3. OAuth access token
    const oauth = verifyOAuthBearer(SKILLBRAIN_ROOT, token)
    if (oauth) {
      ;(req as any).oauthUserId = oauth.userId
      ;(req as any).oauthClientId = oauth.clientId
      ;(req as any).mcpUserId = oauth.userId
      next(); return
    }
    res.setHeader('WWW-Authenticate',
      `Bearer realm="mcp", resource_metadata="${PUBLIC_ISSUER}/.well-known/oauth-protected-resource"`)
    res.status(401).json({ error: 'Unauthorized' })
  }

  // Skip bearer auth entirely when running without a token (local dev only).
  // Production deploys set CODEGRAPH_AUTH_TOKEN which enables auth on /mcp + /sse.
  const mcpAuthMiddleware: express.RequestHandler = authToken
    ? bearerAuth
    : (_req, _res, next) => next()

  app.use('/mcp', mcpAuthMiddleware)
  app.use('/sse', mcpAuthMiddleware)

  // ── Dashboard auth (per-user email+password) ──
  function createSessionToken(userId: string): string {
    const payload = `${userId}:${Date.now()}`
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')
    return Buffer.from(`${payload}:${sig}`).toString('base64url')
  }

  function parseSessionToken(token: string): string | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString()
      const lastColon = decoded.lastIndexOf(':')
      if (lastColon < 0) return null
      const sig = decoded.slice(lastColon + 1)
      const payload = decoded.slice(0, lastColon)
      const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')
      if (sig.length !== expected.length) return null
      if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null
      return payload.split(':')[0] // userId
    } catch { return null }
  }

  function getUserIdFromSession(token: string | undefined): string | null {
    if (!token) return null
    // Backward compat: old 64-char hex tokens valid only when ADMIN_EMAIL not configured
    if (/^[a-f0-9]{64}$/.test(token) && !ADMIN_EMAIL) return 'legacy-admin'
    return parseSessionToken(token)
  }

  function getUserIdFromRequest(req: Request): string | null {
    const cookieToken = req.headers.cookie?.split(';')
      .map(c => c.trim().split('='))
      .find(([k]) => k === 'sb_session')?.[1]
    const headerToken = req.headers['x-dashboard-token'] as string | undefined
    return getUserIdFromSession(cookieToken) ?? getUserIdFromSession(headerToken)
  }

  // Admin bootstrap: create admin user if users table is empty and credentials are available
  {
    const db = openDb(SKILLBRAIN_ROOT)
    try {
      const count = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n
      if (count === 0) {
        if (ADMIN_EMAIL && DASHBOARD_PASSWORD) {
          const { hash, salt } = await hashPassword(DASHBOARD_PASSWORD)
          const adminId = randomUUID().replace(/-/g, '').slice(0, 12)
          db.prepare(`INSERT INTO users (id, name, email, role, password_hash, password_salt) VALUES (?, 'Admin', ?, 'admin', ?, ?)`)
            .run(adminId, ADMIN_EMAIL, hash, salt)
          console.log(`[auth] Bootstrap: admin user created for ${ADMIN_EMAIL}`)
          console.warn(`[auth] DEPRECATED: DASHBOARD_PASSWORD was used for bootstrap. Remove it from env once you have logged in and changed your password.`)
        } else {
          console.warn(`[auth] WARNING: users table is empty. Set ADMIN_EMAIL + DASHBOARD_PASSWORD for first-run bootstrap, or create a user via POST /api/admin/team/users.`)
        }
      } else if (DASHBOARD_PASSWORD) {
        console.warn(`[auth] DEPRECATED: DASHBOARD_PASSWORD env var is set but no longer used for login. Remove it from your Coolify env vars.`)
      }
    } catch { /* users table might not exist yet */ }
    closeDb(db)
  }

  // Login endpoint — per-user email+password only
  app.post('/auth/login', express.json(), async (req, res) => {
    const { email, password } = req.body || {}
    if (!email || !password) { res.status(400).json({ ok: false, error: 'email and password required' }); return }
    const db = openDb(SKILLBRAIN_ROOT)
    const user = db.prepare('SELECT id, password_hash, password_salt FROM users WHERE email = ?').get(email) as any
    closeDb(db)
    if (!user?.password_hash || !await verifyPassword(password, user.password_hash, user.password_salt)) {
      res.status(401).json({ ok: false, error: 'Wrong email or password' }); return
    }
    const token = createSessionToken(user.id)
    res.json({ ok: true, token })
  })

  // Change password endpoint (authenticated)
  app.put('/api/auth/password', express.json(), async (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { current, newPassword } = req.body || {}
    if (!current || !newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'current and newPassword (min 8 chars) required' }); return
    }
    const db = openDb(SKILLBRAIN_ROOT)
    const user = db.prepare('SELECT password_hash, password_salt FROM users WHERE id = ?').get(userId) as any
    if (!user || !await verifyPassword(current, user.password_hash, user.password_salt)) {
      closeDb(db); res.status(401).json({ error: 'Current password wrong' }); return
    }
    const { hash, salt } = await hashPassword(newPassword)
    db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, userId)
    closeDb(db)
    res.json({ ok: true })
  })

  // Auth check for dashboard routes (not /mcp, not /sse, not /auth, not /oauth, not /.well-known)
  const authEnabled = !!ADMIN_EMAIL
  const isPublicPath = (p: string) =>
    p.startsWith('/mcp') ||
    p.startsWith('/sse') ||
    p.startsWith('/auth/') ||
    p === '/oauth/register' ||
    p === '/oauth/token' ||
    p === '/oauth/revoke' ||
    p.startsWith('/.well-known/') ||
    p.startsWith('/telemetry/')

  if (authEnabled) {
    app.use((req, res, next) => {
      if (isPublicPath(req.path)) { next(); return }

      const userId = getUserIdFromRequest(req)
      if (userId) {
        ;(req as any).userId = userId
        next()
      } else if (req.path.startsWith('/api/')) {
        // Allow Bearer token auth for programmatic API access (e.g. proxy upload)
        const token = req.headers.authorization?.replace('Bearer ', '')
        if (authToken && token === authToken) { next(); return }
        res.status(401).json({ error: 'Authentication required' })
      } else {
        // Serve login page for HTML requests — preserve return_to
        const returnTo = (req.query as any)?.return_to as string | undefined
        res.type('html').send(getLoginPage(returnTo))
      }
    })
  }

  // Helper: require admin role for sensitive operations
  function requireAdmin(req: any, res: any, next: any) {
    const userId: string | undefined = req.userId
    if (!userId) { res.status(401).json({ error: 'Authentication required' }); return }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string } | undefined
      closeDb(db)
      if (user?.role === 'admin') { next(); return }
    } catch { /* users table not yet migrated — fall through */ }
    // Legacy admin (no per-user auth) or legacy-admin placeholder: allow
    if (userId === 'legacy-admin') { next(); return }
    res.status(403).json({ error: 'Only admins can perform this action' })
  }

  // ── MCP Protocol: POST /mcp ──
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    let transport: StreamableHTTPServerTransport | undefined

    if (sessionId) {
      transport = transports.get(sessionId)
    }

    if (!transport) {
      if (isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transports.set(newSessionId, transport!)
          },
        })

        transport.onclose = () => {
          const sid = (transport as any).sessionId
          if (sid) transports.delete(sid)
        }

        const mcpUserId = (req as any).mcpUserId as string | undefined
        const server = createMcpServer({ userId: mcpUserId })
        await server.connect(transport)
      } else {
        res.status(400).json({ error: 'No valid session. Send an initialize request first.' })
        return
      }
    }

    await transport.handleRequest(req, res, req.body)
  })

  // ── MCP Protocol: GET /mcp (SSE stream) ──
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    if (!sessionId) {
      res.status(400).json({ error: 'Missing mcp-session-id header' })
      return
    }

    const transport = transports.get(sessionId)
    if (!transport) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    await transport.handleRequest(req, res)
  })

  // ── MCP Protocol: DELETE /mcp (close session) ──
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    if (!sessionId) {
      res.status(400).json({ error: 'Missing mcp-session-id header' })
      return
    }

    const transport = transports.get(sessionId)
    if (!transport) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    await transport.handleRequest(req, res)
    transports.delete(sessionId)
  })

  // ── Legacy SSE transport (for ChatGPT + older MCP clients) ──
  // Client opens GET /sse to start the event stream, then POSTs JSON-RPC to /sse/messages?sessionId=...
  app.get('/sse', async (req, res) => {
    const transport = new SSEServerTransport('/sse/messages', res)
    sseTransports.set(transport.sessionId, transport)
    transport.onclose = () => { sseTransports.delete(transport.sessionId) }
    const mcpUserId = (req as any).mcpUserId as string | undefined
    const server = createMcpServer({ userId: mcpUserId })
    await server.connect(transport)
    // start() is invoked by connect(); nothing more to do here — the response stays open
  })

  app.post('/sse/messages', async (req, res) => {
    const sessionId = (req.query as any).sessionId as string | undefined
    if (!sessionId) { res.status(400).json({ error: 'Missing sessionId query param' }); return }
    const transport = sseTransports.get(sessionId)
    if (!transport) { res.status(404).json({ error: 'SSE session not found' }); return }
    // Body is already parsed by express.json() earlier in the chain
    await transport.handlePostMessage(req, res, req.body)
  })

  // ── OAuth 2.1 authorization server (for ChatGPT, Claude Desktop, etc.) ──
  app.use(createOAuthRouter({
    skillbrainRoot: SKILLBRAIN_ROOT,
    issuer: PUBLIC_ISSUER,
    getUserIdFromRequest,
  }))

  // ── Dashboard: Health ──
  app.get('/api/health', (_req, res) => {
    const mg = getMemoryGraphStats()
    const repos = loadRegistrySafe()
    res.json({
      status: 'ok',
      memories: mg.total,
      memoryEdges: mg.edges,
      repos: repos.length,
      activeSessions: transports.size,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    })
  })

  // ── Dashboard: Data API ──
  app.get('/api/data', (_req, res) => {
    const mg = getMemoryGraphStats()
    const repos = loadRegistrySafe()
    res.json({
      memoryGraph: mg,
      repos: repos.map((r: any) => ({ name: r.name, path: r.path, stats: r.stats })),
      activeSessions: transports.size,
      timestamp: new Date().toISOString(),
    })
  })

  // ── API: CodeGraph Upload ──
  app.post('/api/codegraph/upload', bearerAuth, express.json({ limit: '512mb' }), async (req, res) => {
    const { repoName, lastCommit, stats, graphDb, compressed } = req.body || {}
    if (!repoName || typeof repoName !== 'string') {
      res.status(400).json({ error: 'repoName (string) required' }); return
    }
    if (typeof graphDb !== 'string' || graphDb.length === 0) {
      res.status(400).json({ error: 'graphDb (base64 string) required' }); return
    }
    // Sanitize repoName: only alphanumeric, hyphens, underscores, dots — no slashes or traversal
    if (!/^[\w.-]+$/.test(repoName) || repoName.includes('..')) {
      res.status(400).json({ error: 'Invalid repoName' }); return
    }
    const MAX_DB_BYTES = 200 * 1024 * 1024 // 200 MB
    let binary = Buffer.from(graphDb, 'base64')
    if (compressed) {
      const { gunzipSync } = await import('node:zlib')
      binary = gunzipSync(binary)
    }
    if (binary.length > MAX_DB_BYTES) {
      res.status(413).json({ error: 'graphDb exceeds 200 MB limit' }); return
    }
    const reposRoot = path.resolve(SKILLBRAIN_ROOT, 'repos')
    const repoPath = path.resolve(reposRoot, repoName)
    if (!repoPath.startsWith(reposRoot + path.sep)) {
      res.status(400).json({ error: 'Invalid repoName' }); return
    }
    const dbDir = path.join(repoPath, '.codegraph')
    const dbPath = path.join(dbDir, 'graph.db')
    try {
      fs.mkdirSync(dbDir, { recursive: true })
      fs.writeFileSync(dbPath, binary)
    } catch (err: any) {
      console.error('[codegraph/upload] fs error', err)
      res.status(500).json({ error: `Failed to write graph.db: ${err.message}` }); return
    }
    try {
      upsertRegistry({
        name: repoName,
        path: repoPath,
        lastCommit: lastCommit ?? null,
        indexedAt: new Date().toISOString(),
        stats: {
          nodes: stats?.nodes ?? 0,
          edges: stats?.edges ?? 0,
          files: stats?.files ?? 0,
          communities: stats?.communities ?? 0,
          processes: stats?.processes ?? 0,
        },
      })
    } catch (err: any) {
      console.error('[codegraph/upload] registry error', err)
      res.status(500).json({ error: `Failed to update registry: ${err.message}` }); return
    }
    res.json({ success: true, repoName, path: repoPath })
  })

  // ── API: Skills ──
  app.get('/api/skills', (_req, res) => {
    const { type, category, search, limit } = _req.query as any
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new SkillsStore(db)
      let skills
      if (search) {
        skills = store.search(search, parseInt(limit || '50', 10)).map((r) => ({
          name: r.skill.name, category: r.skill.category, type: r.skill.type,
          description: r.skill.description.slice(0, 150), lines: r.skill.lines,
          tags: r.skill.tags,
        }))
      } else {
        skills = store.list(type, category).map((s) => ({
          name: s.name, category: s.category, type: s.type,
          description: s.description.slice(0, 150), lines: s.lines,
          tags: s.tags,
        }))
      }
      const stats = store.stats()
      closeDb(db)
      res.json({ skills, total: stats.total, stats })
    } catch {
      res.json({ skills: [], total: 0, stats: {} })
    }
  })

  app.get('/api/skills/:name', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new SkillsStore(db)
      const skill = store.get(_req.params.name)
      closeDb(db)
      if (!skill) { res.status(404).json({ error: 'Skill not found' }); return }
      res.json(skill)
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── API: Skill versioning ──
  app.get('/api/skills/:name/versions', (req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new SkillsStore(db)
      const versions = store.listVersions(req.params.name)
      closeDb(db)
      res.json({ versions })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/skills/:name/rollback/:versionId', requireAdmin, (req, res) => {
    const userId = (req as any).userId ?? 'unknown'
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new SkillsStore(db)
      const skill = store.rollback(req.params.name, req.params.versionId, userId)
      new AuditStore(db).log({
        entityType: 'skill',
        entityId: req.params.name,
        action: 'rollback',
        reviewedBy: userId,
        metadata: { versionId: req.params.versionId },
      })
      closeDb(db)
      res.json({ skill })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── Telemetry: client-side Skill tool usage ──
  // The Claude Code `Skill` tool runs locally and never reaches the MCP server,
  // so a PostToolUse hook fires this endpoint to persist skill_usage rows.
  // Localhost-only: refuse external traffic since there is no auth on this path.
  const isLocalhost = (req: Request): boolean => {
    const ip = req.socket.remoteAddress ?? ''
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('::ffff:127.')
  }

  app.post('/telemetry/skill-usage', express.json({ limit: '8kb' }), (req, res) => {
    if (!isLocalhost(req)) { res.status(403).json({ error: 'localhost only' }); return }
    const { skill, action, sessionId, project, task, tool } = (req.body || {}) as {
      skill?: string
      action?: string
      sessionId?: string
      project?: string
      task?: string
      tool?: string
    }
    if (!skill || typeof skill !== 'string') { res.status(400).json({ error: 'skill required' }); return }
    const validAction = action === 'routed' || action === 'loaded' || action === 'applied' ? action : 'applied'
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new SkillsStore(db)
      store.recordUsage(skill, validAction, {
        sessionId: typeof sessionId === 'string' ? sessionId : undefined,
        project: typeof project === 'string' ? project : undefined,
        task: typeof task === 'string' ? task : (typeof tool === 'string' ? `tool:${tool}` : undefined),
      })
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? 'internal' })
    }
  })

  // ── API: Memories ──
  app.get('/api/memories', (_req, res) => {
    const { type, minConfidence, skill, project, status, search, limit, scope, mine } = _req.query as any
    const userId = (_req as any).userId as string | undefined
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new MemoryStore(db)
      let memories
      if (search) {
        memories = store.search(search, parseInt(limit || '50', 10)).map((r) => ({
          ...r.memory, edges: r.edges,
        }))
      } else {
        const typeArr = type ? (Array.isArray(type) ? type : [type]) : undefined
        memories = store.query({
          type: typeArr,
          minConfidence: minConfidence ? parseInt(minConfidence, 10) : undefined,
          skill, project, status,
          scope: scope || undefined,
          userId,
          mine: mine === 'true' || mine === '1',
          limit: parseInt(limit || '50', 10),
        }).map((m) => ({ ...m, edges: store.getEdges(m.id) }))
      }
      const stats = store.stats()
      closeDb(db)
      res.json({ memories, total: stats.total, stats })
    } catch {
      res.json({ memories: [], total: 0, stats: {} })
    }
  })

  app.get('/api/memories/:id', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new MemoryStore(db)
      const memory = store.get(_req.params.id)
      if (!memory) { closeDb(db); res.status(404).json({ error: 'Memory not found' }); return }
      const edges = store.getEdges(memory.id)
      closeDb(db)
      res.json({ ...memory, edges })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── API: Sessions ──
  app.get('/api/sessions', (_req, res) => {
    const limit = parseInt((_req.query as any).limit || '20', 10)
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new MemoryStore(db)
      const sessions = store.recentSessions(limit)
      closeDb(db)
      res.json({ sessions })
    } catch {
      res.json({ sessions: [] })
    }
  })

  // ── API: Projects ──
  app.get('/api/projects', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new MemoryStore(db)
      const projects = store.listProjects()
      closeDb(db)
      res.json({ projects })
    } catch {
      res.json({ projects: [] })
    }
  })

  app.get('/api/projects/:name', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new MemoryStore(db)
      const detail = store.projectDetail(_req.params.name)
      closeDb(db)
      res.json(detail)
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── API: Memory Edit/Delete ──
  app.delete('/api/memories/:id', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new MemoryStore(db)
      store.delete(_req.params.id)
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/memories/:id', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new MemoryStore(db)
      store.updateMemory(_req.params.id, _req.body || {})
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── API: Session Edit/Delete ──
  app.delete('/api/sessions/:id', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new MemoryStore(db)
      store.deleteSession(_req.params.id)
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/sessions/:id', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new MemoryStore(db)
      store.updateSession(_req.params.id, _req.body || {})
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Bulk cleanup: delete duplicate in-progress sessions for same project
  app.post('/api/sessions/cleanup-duplicates', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new MemoryStore(db)
      const pending = store.pendingSessions()

      // Group by project, keep most recent, delete rest
      const byProject = new Map<string, any[]>()
      for (const s of pending) {
        if (!s.project) continue
        if (!byProject.has(s.project)) byProject.set(s.project, [])
        byProject.get(s.project)!.push(s)
      }

      let deleted = 0
      for (const [, sessions] of byProject) {
        sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        // Keep first (most recent), delete the rest
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

  // ── API: Projects Metadata (full) ──
  app.get('/api/projects-meta', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ProjectsStore(db)
      const projects = store.list()
      closeDb(db)
      res.json({ projects })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/projects-meta/:name', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ProjectsStore(db)
      const project = store.get(_req.params.name)
      closeDb(db)
      if (!project) { res.status(404).json({ error: 'Not found' }); return }
      res.json(project)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/projects-meta/:name', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ProjectsStore(db)
      const project = store.upsert({ name: _req.params.name, ...(_req.body || {}) })
      closeDb(db)
      res.json({ ok: true, project })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/projects-meta/:name', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ProjectsStore(db)
      store.delete(_req.params.name)
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Merge duplicate projects into one primary
  app.post('/api/projects-meta/merge', (req, res) => {
    const { primary, aliases } = req.body as { primary: string; aliases: string[] }
    if (!primary || !Array.isArray(aliases) || aliases.length === 0) {
      return res.status(400).json({ error: 'primary and aliases[] required' })
    }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ProjectsStore(db)
      const result = store.merge(primary, aliases)
      closeDb(db)
      res.json({ ok: true, ...result })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  // Env var management (list names only — values never returned via API for UI safety)
  app.get('/api/projects-meta/:name/env', (_req, res) => {
    try {
      const environment = (_req.query as any).environment || 'production'
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ProjectsStore(db)
      const vars = store.listEnvNames(_req.params.name, environment)
      closeDb(db)
      res.json({ vars })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Reveal single value (requires explicit auth from dashboard)
  app.post('/api/projects-meta/:name/env/reveal', (_req, res) => {
    try {
      const { varName, environment = 'production' } = _req.body || {}
      if (!varName) { res.status(400).json({ error: 'varName required' }); return }
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ProjectsStore(db)
      const value = store.getEnv(_req.params.name, varName, environment)
      closeDb(db)
      if (value === undefined) { res.status(404).json({ error: 'Not found' }); return }
      res.json({ varName, value })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Export all env vars as .env format
  app.post('/api/projects-meta/:name/env/export', (_req, res) => {
    try {
      const { environment = 'production' } = _req.body || {}
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ProjectsStore(db)
      const vars = store.getAllEnv(_req.params.name, environment)
      closeDb(db)
      const content = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n')
      res.json({ content, count: Object.keys(vars).length })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Import .env content (bulk encrypt & save)
  app.post('/api/projects-meta/:name/env/import', (_req, res) => {
    try {
      const { envContent, environment = 'production' } = _req.body || {}
      if (!envContent) { res.status(400).json({ error: 'envContent required' }); return }
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ProjectsStore(db)
      let saved = 0
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const name = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (name && value) {
          try {
            store.setEnv(_req.params.name, name, value, environment, '.env', !name.startsWith('NEXT_PUBLIC_'))
            saved++
          } catch {}
        }
      }
      closeDb(db)
      res.json({ ok: true, saved })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/projects-meta/:name/env/:varName', (_req, res) => {
    try {
      const environment = (_req.query as any).environment || 'production'
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ProjectsStore(db)
      store.deleteEnv(_req.params.name, _req.params.varName, environment)
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── API: Work Log ──
  app.get('/api/worklog', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new MemoryStore(db)
      const projects = store.workLog()
      closeDb(db)
      res.json({ projects })
    } catch {
      res.json({ projects: {} })
    }
  })

  // ── API: UI Components ──
  app.get('/api/components', (_req, res) => {
    const { project, type, tag, search, limit } = _req.query as any
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ComponentsStore(db)
      let components
      if (search) {
        components = store.searchComponents(search, parseInt(limit || '50', 10)).map((r) => r.component)
      } else {
        components = store.listComponents({ project, sectionType: type, tag, limit: parseInt(limit || '100', 10) })
      }
      const stats = store.componentStats()
      closeDb(db)
      res.json({ components, total: stats.total, stats })
    } catch {
      res.json({ components: [], total: 0, stats: {} })
    }
  })

  app.get('/api/components/:id', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ComponentsStore(db)
      const component = store.getComponent(_req.params.id)
      closeDb(db)
      if (!component) { res.status(404).json({ error: 'Component not found' }); return }
      res.json(component)
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  app.post('/api/components', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ComponentsStore(db)
      const component = store.addComponent(_req.body || {})
      closeDb(db)
      res.json({ ok: true, component })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  app.delete('/api/components/:id', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ComponentsStore(db)
      store.deleteComponent(_req.params.id)
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── API: Design Systems ──
  app.get('/api/design-systems', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ComponentsStore(db)
      const designSystems = store.listDesignSystems()
      closeDb(db)
      res.json({ designSystems, total: designSystems.length })
    } catch {
      res.json({ designSystems: [], total: 0 })
    }
  })

  app.get('/api/design-systems/:project', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ComponentsStore(db)
      const ds = store.getDesignSystem(_req.params.project)
      closeDb(db)
      if (!ds) { res.status(404).json({ error: 'Design system not found' }); return }
      res.json(ds)
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // Merge two design systems into one primary
  app.post('/api/design-systems/merge', (req, res) => {
    const { primary, alias } = req.body as { primary: string; alias: string }
    if (!primary || !alias) {
      return res.status(400).json({ error: 'primary and alias required' })
    }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ComponentsStore(db)
      const result = store.mergeDesignSystems(primary, alias)
      closeDb(db)
      res.json({ ok: true, designSystem: result })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  // ── Design System Scan endpoints ──
  app.get('/api/design-systems/pending', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ComponentsStore(db)
      const scans = store.getPendingScans()
      closeDb(db)
      res.json({ scans })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  app.get('/api/design-systems/scans/:project', (req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ComponentsStore(db)
      const scans = store.getPendingScans(req.params.project)
      closeDb(db)
      res.json({ scans })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  app.post('/api/design-systems/:project/apply-scan', express.json(), (req, res) => {
    const { scanId, resolved } = req.body as { scanId: string; resolved: Record<string, unknown> }
    if (!scanId) { res.status(400).json({ error: 'scanId required' }); return }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ComponentsStore(db)
      const ds = store.applyDesignSystemScan(scanId, resolved)
      closeDb(db)
      res.json({ ok: true, designSystem: ds })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.delete('/api/design-systems/scans/:scanId', (req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new ComponentsStore(db)
      store.dismissDesignSystemScan(req.params.scanId)
      closeDb(db)
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── Team / API Keys admin routes ──
  function generateApiKey(): string {
    return 'sk-codegraph-' + crypto.randomBytes(12).toString('hex')
  }

  app.get('/api/admin/team', (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
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

  app.post('/api/admin/team/users', express.json(), async (req, res) => {
    const { name, email, label } = req.body as { name?: string; email?: string; label?: string }
    if (!name) { res.status(400).json({ error: 'name required' }); return }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const userId = randomUUID().replace(/-/g, '').slice(0, 12)
      const keyId = randomUUID().replace(/-/g, '').slice(0, 12)
      const plainKey = generateApiKey()
      const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex')
      const plainPw = generatePassword()
      const { hash: pwHash, salt: pwSalt } = await hashPassword(plainPw)
      db.prepare(`INSERT INTO users (id, name, email, role, password_hash, password_salt) VALUES (?, ?, ?, 'member', ?, ?)`)
        .run(userId, name, email ?? null, pwHash, pwSalt)
      db.prepare(`INSERT INTO api_keys (id, user_id, key_hash, label) VALUES (?, ?, ?, ?)`)
        .run(keyId, userId, keyHash, label ?? `${name}'s key`)
      closeDb(db)
      if (email) sendInviteEmail(email, name, plainPw, plainKey).catch(console.error)
      res.json({ userId, keyId, key: plainKey })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── Admin: Key Rotation ───────────────────────────────────────────────────
  // POST /api/admin/rotate-key  { newKey: "<64 hex chars>" }
  // Re-encrypts all stored secrets with the new key (atomic transaction).
  // After success: update ENCRYPTION_KEY in Coolify to newKey and redeploy.
  app.post('/api/admin/rotate-key', requireAdmin, express.json(), (req, res) => {
    const { newKey } = req.body || {}
    if (!newKey || typeof newKey !== 'string') {
      res.status(400).json({ error: 'newKey (string) required' }); return
    }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
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

  app.delete('/api/admin/team/keys/:id', (req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      db.prepare(`UPDATE api_keys SET revoked_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), req.params.id)
      closeDb(db)
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  app.put('/api/admin/team/users/:id', express.json(), (req, res) => {
    const { name, email, role } = req.body as { name?: string; email?: string; role?: string }
    if (!name) { res.status(400).json({ error: 'name required' }); return }
    if (role && !['admin', 'member'].includes(role)) { res.status(400).json({ error: 'invalid role' }); return }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const result = db.prepare(`UPDATE users SET name = ?, email = ?, role = COALESCE(?, role) WHERE id = ?`)
        .run(name, email ?? null, role ?? null, req.params.id)
      closeDb(db)
      if (result.changes === 0) { res.status(404).json({ error: 'User not found' }); return }
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  app.delete('/api/admin/team/users/:id', (req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      db.prepare(`DELETE FROM api_keys WHERE user_id = ?`).run(req.params.id)
      const result = db.prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id)
      closeDb(db)
      if (result.changes === 0) { res.status(404).json({ error: 'User not found' }); return }
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── API: Admin OAuth clients ──
  app.get('/api/admin/oauth/clients', requireAdmin, (_req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
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

  app.delete('/api/admin/oauth/clients/:id', requireAdmin, (req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new OAuthStore(db)
      store.revokeClientTokens(req.params.id)
      store.deleteClient(req.params.id)
      closeDb(db)
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── API: Self-service profile + API keys ──

  app.get('/api/me', (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(userId) as any
      closeDb(db)
      if (!user) { res.status(404).json({ error: 'User not found' }); return }
      res.json({ user })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  app.get('/api/me/api-keys', (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
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

  app.post('/api/me/api-keys', express.json(), (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { label } = req.body || {}
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const keyId = randomUUID().replace(/-/g, '').slice(0, 12)
      const plainKey = 'sk-codegraph-' + crypto.randomBytes(12).toString('hex')
      const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex')
      db.prepare(`INSERT INTO api_keys (id, user_id, key_hash, label) VALUES (?, ?, ?, ?)`)
        .run(keyId, userId, keyHash, label || 'My key')
      closeDb(db)
      // Plain key returned ONCE — never stored
      res.json({ id: keyId, key: plainKey, label: label || 'My key' })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  app.delete('/api/me/api-keys/:id', (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      // Ensure the key belongs to this user before revoking
      const key = db.prepare('SELECT id FROM api_keys WHERE id = ? AND user_id = ?').get(req.params.id, userId) as any
      if (!key) { closeDb(db); res.status(404).json({ error: 'Key not found' }); return }
      db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.id)
      closeDb(db)
      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  // ── API: My master.env ──
  // All routes are scoped to the logged-in user via req.userId. Values are
  // never returned in list endpoints — only on explicit reveal/export, which
  // are written to the audit log so the user can see when they were touched.

  app.get('/api/me/env', (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    try {
      const { category, service } = req.query as { category?: string; service?: string }
      const db = openDb(SKILLBRAIN_ROOT)
      const vars = new UsersEnvStore(db).listEnv(userId, {
        category: category as any,
        service,
      })
      const cap = new UsersEnvStore(db).capability(userId)
      closeDb(db)
      res.json({ vars, capability: cap })
    } catch (err: any) {
      console.error('[user_env GET]', err)
      res.status(500).json({ error: err.message, code: err.code })
    }
  })

  app.post('/api/me/env/reveal', express.json(), (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { varName } = req.body || {}
    if (!varName) { res.status(400).json({ error: 'varName required' }); return }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const value = new UsersEnvStore(db).getEnv(userId, varName)
      if (value === undefined) {
        closeDb(db); res.status(404).json({ error: 'Not found' }); return
      }
      new AuditStore(db).log({
        entityType: 'user_env',
        entityId: varName,
        action: 'reveal',
        reviewedBy: userId,
      })
      closeDb(db)
      res.json({ varName, value })
    } catch (err: any) {
      console.error('[user_env reveal]', err)
      res.status(500).json({ error: err.message, code: err.code })
    }
  })

  app.put('/api/me/env/:varName', express.json(), (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { value, category, service, description, isSecret } = req.body || {}
    if (typeof value !== 'string' || value.length === 0) {
      res.status(400).json({ error: 'value (string) required' }); return
    }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const store = new UsersEnvStore(db)
      const existed = store.hasEnv(userId, req.params.varName)
      const saved = store.setEnv(userId, req.params.varName, value, {
        category, service, description, isSecret,
      })
      new AuditStore(db).log({
        entityType: 'user_env',
        entityId: req.params.varName,
        action: existed ? 'update' : 'create',
        reviewedBy: userId,
        metadata: { category: saved.category, service: saved.service },
      })
      closeDb(db)
      res.json({ ok: true, var: saved })
    } catch (err: any) {
      console.error('[user_env PUT]', req.params.varName, err)
      res.status(500).json({ error: err.message, code: err.code })
    }
  })

  app.delete('/api/me/env/:varName', (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const removed = new UsersEnvStore(db).deleteEnv(userId, req.params.varName)
      if (!removed) { closeDb(db); res.status(404).json({ error: 'Not found' }); return }
      new AuditStore(db).log({
        entityType: 'user_env',
        entityId: req.params.varName,
        action: 'delete',
        reviewedBy: userId,
      })
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      console.error('[user_env DELETE]', req.params.varName, err)
      res.status(500).json({ error: err.message, code: err.code })
    }
  })

  app.post('/api/me/env/import', express.json(), (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { envContent, category, service } = req.body || {}
    if (typeof envContent !== 'string' || envContent.length === 0) {
      res.status(400).json({ error: 'envContent (string) required' }); return
    }
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const result = new UsersEnvStore(db).importEnv(userId, envContent, { category, service })
      new AuditStore(db).log({
        entityType: 'user_env',
        entityId: '__bulk__',
        action: 'import',
        reviewedBy: userId,
        metadata: { saved: result.saved, errorCount: result.errors.length },
      })
      closeDb(db)
      res.json({ ok: true, ...result })
    } catch (err: any) {
      console.error('[user_env import]', err)
      res.status(500).json({ error: err.message, code: err.code })
    }
  })

  app.post('/api/me/env/export', express.json(), (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    const { category, service } = req.body || {}
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const vars = new UsersEnvStore(db).getAllEnv(userId, { category, service })
      new AuditStore(db).log({
        entityType: 'user_env',
        entityId: '__bulk__',
        action: 'export',
        reviewedBy: userId,
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

  // Curated templates so the hub can offer a guided "Add credential" flow with
  // sensible defaults (service, var name, where to get the key).
  app.get('/api/me/env/templates', (req, res) => {
    const userId = (req as any).userId
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }
    res.json({ templates: ENV_TEMPLATES })
  })

  // ── API: Audit Log ──
  app.get('/api/audit/:entityType/:entityId', (req, res) => {
    try {
      const db = openDb(SKILLBRAIN_ROOT)
      const entries = new AuditStore(db).listForEntity(req.params.entityType, req.params.entityId)
      closeDb(db)
      res.json({ entries })
    } catch {
      res.json({ entries: [] })
    }
  })

  // ── API: Review Queue ──────────────────────────────────────────────────────

  app.get('/api/review/pending', (_req, res) => {
    const db = openDb(SKILLBRAIN_ROOT)
    try {
      const memories = db.prepare(
        `SELECT id, type, context, solution, skill, tags, created_at FROM memories WHERE status = 'pending-review' ORDER BY created_at DESC LIMIT 50`
      ).all()
      const skills = db.prepare(
        `SELECT name, category, description, type, updated_at FROM skills WHERE status = 'pending' ORDER BY updated_at DESC`
      ).all()
      const components = db.prepare(
        `SELECT id, name, project, section_type, description, created_at FROM ui_components WHERE status = 'pending' ORDER BY created_at DESC`
      ).all()
      let proposals: unknown[] = []
      let dsScans: unknown[] = []
      try {
        proposals = db.prepare(
          `SELECT * FROM skill_proposals WHERE status = 'pending' ORDER BY proposed_at DESC`
        ).all()
      } catch { /* table not yet migrated */ }
      try {
        dsScans = db.prepare(
          `SELECT * FROM design_system_scans WHERE status = 'pending' ORDER BY scanned_at DESC`
        ).all()
      } catch { /* ignore */ }
      res.json({ memories, skills, components, proposals, dsScans })
    } finally {
      closeDb(db)
    }
  })

  app.post('/api/review/memory/:id/approve', (req, res) => {
    const db = openDb(SKILLBRAIN_ROOT)
    const now = new Date().toISOString()
    db.prepare(`UPDATE memories SET status = 'active', updated_at = ? WHERE id = ?`)
      .run(now, req.params.id)
    new AuditStore(db).log({ entityType: 'memory', entityId: req.params.id, action: 'approve', reviewedBy: (req as any).userId ?? 'unknown' })
    closeDb(db)
    res.json({ ok: true })
  })

  app.post('/api/review/memory/:id/reject', (req, res) => {
    const db = openDb(SKILLBRAIN_ROOT)
    const now = new Date().toISOString()
    db.prepare(`UPDATE memories SET status = 'deprecated', updated_at = ? WHERE id = ?`)
      .run(now, req.params.id)
    new AuditStore(db).log({ entityType: 'memory', entityId: req.params.id, action: 'reject', reviewedBy: (req as any).userId ?? 'unknown' })
    closeDb(db)
    res.json({ ok: true })
  })

  app.post('/api/review/skill/:name/approve', (req, res) => {
    const db = openDb(SKILLBRAIN_ROOT)
    const name = decodeURIComponent(req.params.name)
    db.prepare(`UPDATE skills SET status = 'active', updated_at = ? WHERE name = ?`)
      .run(new Date().toISOString(), name)
    new AuditStore(db).log({ entityType: 'skill', entityId: name, action: 'approve', reviewedBy: (req as any).userId ?? 'unknown' })
    closeDb(db)
    res.json({ ok: true })
  })

  app.post('/api/review/skill/:name/reject', (req, res) => {
    const db = openDb(SKILLBRAIN_ROOT)
    const name = decodeURIComponent(req.params.name)
    const now = new Date().toISOString()
    db.prepare(`UPDATE skills SET status = 'deprecated', updated_at = ?, updated_by_user_id = ? WHERE name = ? AND status = 'pending'`)
      .run(now, (req as any).userId ?? null, name)
    new AuditStore(db).log({ entityType: 'skill', entityId: name, action: 'reject', reviewedBy: (req as any).userId ?? 'unknown' })
    closeDb(db)
    res.json({ ok: true })
  })

  app.post('/api/review/component/:id/approve', (req, res) => {
    const db = openDb(SKILLBRAIN_ROOT)
    db.prepare(`UPDATE ui_components SET status = 'active', updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), req.params.id)
    new AuditStore(db).log({ entityType: 'component', entityId: req.params.id, action: 'approve', reviewedBy: (req as any).userId ?? 'unknown' })
    closeDb(db)
    res.json({ ok: true })
  })

  app.post('/api/review/component/:id/reject', (req, res) => {
    const db = openDb(SKILLBRAIN_ROOT)
    const now = new Date().toISOString()
    db.prepare(`UPDATE ui_components SET status = 'deprecated', updated_at = ?, updated_by_user_id = ? WHERE id = ? AND status = 'pending'`)
      .run(now, (req as any).userId ?? null, req.params.id)
    new AuditStore(db).log({ entityType: 'component', entityId: req.params.id, action: 'reject', reviewedBy: (req as any).userId ?? 'unknown' })
    closeDb(db)
    res.json({ ok: true })
  })

  app.post('/api/review/proposal/:id/dismiss', (req, res) => {
    const db = openDb(SKILLBRAIN_ROOT)
    try {
      db.prepare(`UPDATE skill_proposals SET status = 'dismissed', reviewed_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), req.params.id)
      new AuditStore(db).log({ entityType: 'proposal', entityId: req.params.id, action: 'dismiss', reviewedBy: (req as any).userId ?? 'unknown' })
    } catch { /* ignore if table not migrated */ }
    closeDb(db)
    res.json({ ok: true })
  })

  app.post('/api/review/proposal/:id/generate', requireAdmin, async (req, res) => {
    if (!ANTHROPIC_API_KEY) {
      res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' }); return
    }
    const db = openDb(SKILLBRAIN_ROOT)
    let proposal: any, skill: any, memories: any[]
    try {
      proposal = db.prepare('SELECT * FROM skill_proposals WHERE id = ?').get(req.params.id)
      if (!proposal) { closeDb(db); res.status(404).json({ error: 'Proposal not found' }); return }
      skill = db.prepare('SELECT * FROM skills WHERE name = ?').get(proposal.skill_name)
      const memIds: string[] = JSON.parse(proposal.memory_ids || '[]')
      memories = memIds
        .map(id => db.prepare('SELECT type, context, problem, solution, reason FROM memories WHERE id = ?').get(id))
        .filter(Boolean) as any[]
    } finally {
      closeDb(db)
    }

    const memoriesText = memories.map((m: any) =>
      `### [${m.type}]\nContext: ${m.context}\nProblem: ${m.problem}\nSolution: ${m.solution}\nWhy: ${m.reason}`
    ).join('\n\n')

    const currentContent = skill?.content
      ? `## Current Skill Content\n\`\`\`\n${skill.content}\n\`\`\``
      : `## Note\nThis skill does not exist yet — create it from scratch based on the learnings below.`

    const prompt = `You are improving a SkillBrain skill file based on recent learnings.

## Skill: ${proposal.skill_name}
Category: ${skill?.category || 'unknown'}
Description: ${skill?.description || '(new skill)'}

${currentContent}

## New Learnings to Incorporate
${memoriesText}

## Instructions
Generate an improved SKILL.md for skill "${proposal.skill_name}" that incorporates these learnings.
- Keep the existing structure and format if a current version exists
- Add concrete examples, gotchas, and actionable patterns from the learnings
- Be specific and practical — this file is read by an AI agent before working on a task
- Output ONLY the updated Markdown content, nothing else`

    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      const generatedContent = (response.content[0] as any).text as string

      const db2 = openDb(SKILLBRAIN_ROOT)
      try {
        db2.prepare(`UPDATE skill_proposals SET proposed_content = ? WHERE id = ?`)
          .run(generatedContent, req.params.id)
        new AuditStore(db2).log({ entityType: 'proposal', entityId: req.params.id, action: 'generate', reviewedBy: (req as any).userId ?? 'unknown' })
      } finally {
        closeDb(db2)
      }
      res.json({ ok: true, content: generatedContent })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Generation failed' })
    }
  })

  app.post('/api/review/proposal/:id/apply', requireAdmin, (req, res) => {
    const db = openDb(SKILLBRAIN_ROOT)
    try {
      const proposal = db.prepare('SELECT * FROM skill_proposals WHERE id = ?').get(req.params.id) as any
      if (!proposal?.proposed_content) {
        res.status(400).json({ error: 'No generated content — run generate first' }); return
      }
      const existing = db.prepare('SELECT * FROM skills WHERE name = ?').get(proposal.skill_name) as any
      const now = new Date().toISOString()
      const content = proposal.proposed_content
      const userId = (req as any).userId ?? null
      if (existing) {
        const store = new SkillsStore(db)
        store.upsert({
          ...existing,
          content,
          lines: content.split('\n').length,
          updatedAt: now,
          status: 'active',
          updatedByUserId: userId,
        }, { changedBy: userId, reason: 'haiku-evolution' })
      } else {
        db.prepare(`INSERT INTO skills (name, category, description, content, type, tags, lines, updated_at, status, created_by_user_id) VALUES (?, ?, ?, ?, 'domain', '[]', ?, ?, 'active', ?)`)
          .run(proposal.skill_name, proposal.skill_name, `Auto-generated from memories`, content, content.split('\n').length, now, userId)
      }
      db.prepare(`UPDATE skill_proposals SET status = 'dismissed', reviewed_at = ? WHERE id = ?`)
        .run(now, req.params.id)
      new AuditStore(db).log({ entityType: 'proposal', entityId: req.params.id, action: 'apply', reviewedBy: userId ?? 'unknown', metadata: { skillName: proposal.skill_name } })
      res.json({ ok: true, skillName: proposal.skill_name })
    } finally {
      closeDb(db)
    }
  })

  // ── Static files (dashboard SPA) ──
  const publicDir = path.resolve(__dirname, '..', '..', 'public')
  app.use(express.static(publicDir))

  // SPA fallback: serve index.html for unmatched GET routes
  app.use((_req, res, next) => {
    if (_req.method === 'GET' && !_req.path.startsWith('/api/') && !_req.path.startsWith('/mcp')) {
      res.sendFile(path.join(publicDir, 'index.html'), (err) => {
        if (err) res.type('html').send(getFallbackPage(transports.size))
      })
    } else {
      next()
    }
  })

  // Fail-fast on missing/broken ENCRYPTION_KEY if the DB has any encrypted rows.
  // Better to refuse to start than to serve requests that'll crash later.
  {
    const db = openDb(SKILLBRAIN_ROOT)
    try {
      const row = db.prepare(`SELECT COUNT(*) as n FROM project_env_vars`).get() as { n: number }
      if (row.n > 0) {
        assertEncryptionUsable()
        // Verify the current key actually matches the existing DB rows
        const sample = db.prepare(
          `SELECT encrypted_value, iv, auth_tag FROM project_env_vars LIMIT 1`,
        ).get() as { encrypted_value: string; iv: string; auth_tag: string } | undefined
        if (sample) {
          try {
            decrypt({ ciphertext: sample.encrypted_value, iv: sample.iv, authTag: sample.auth_tag })
          } catch (err) {
            throw new Error(
              `ENCRYPTION_KEY does not match existing encrypted rows in project_env_vars. ` +
              `Rotating the key requires re-encrypting all stored values first. ` +
              `Original error: ${(err as Error).message}`,
            )
          }
        }
        console.log(`✅ ENCRYPTION_KEY validated (${row.n} encrypted env vars readable)`)
      } else if (process.env.ENCRYPTION_KEY) {
        assertEncryptionUsable() // key set but no rows yet — still validate roundtrip
        console.log('✅ ENCRYPTION_KEY validated (no encrypted rows yet)')
      } else {
        console.warn('⚠️ ENCRYPTION_KEY not set — env var storage disabled until configured')
      }
    } finally {
      closeDb(db)
    }
  }

  app.listen(port, () => {
    console.log(`
  SkillBrain Hub (HTTP mode)
  ──────────────────────────
  Dashboard:  http://localhost:${port}
  MCP:        http://localhost:${port}/mcp               (Streamable HTTP)
  SSE:        http://localhost:${port}/sse               (legacy, for ChatGPT)
  OAuth:      ${PUBLIC_ISSUER}/.well-known/oauth-authorization-server
  API:        http://localhost:${port}/api/health
  Auth:       ${authToken ? 'Bearer token required for /mcp + /sse' : 'disabled'}
`)
  })
}

function getLoginPage(returnTo?: string): string {
  // Only allow same-origin return_to paths (must start with /) to prevent open redirects
  const safeReturn = returnTo && /^\/[^/]/.test(returnTo) ? returnTo : ''
  const returnJson = JSON.stringify(safeReturn)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SkillBrain — Login</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#08080d;color:#d0d0d0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh}
.login{background:#0e0e16;border:1px solid #1a1a2a;border-radius:12px;padding:32px;width:320px;text-align:center}
h1{font-size:22px;background:linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
.sub{color:#555;font-size:12px;margin-bottom:24px}
input{width:100%;padding:10px 14px;background:#111118;border:1px solid #1a1a2a;border-radius:8px;color:#d0d0d0;font-size:14px;outline:none;margin-bottom:12px}
input:focus{border-color:#6366f1}
button{width:100%;padding:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:600;cursor:pointer}
button:hover{opacity:.9}
.err{color:#f87171;font-size:12px;margin-top:8px;display:none}
</style></head><body>
<div class="login">
<h1>SkillBrain</h1>
<div class="sub">Sign in to your account</div>
<form onsubmit="return doLogin(event)">
<input type="email" id="em" placeholder="Email" autofocus>
<input type="password" id="pw" placeholder="Password">
<button type="submit">Login</button>
</form>
<div class="err" id="err">Wrong email or password</div>
</div>
<script>
const RETURN_TO=${returnJson};
async function doLogin(e){
  e.preventDefault();
  const em=document.getElementById('em').value;
  const pw=document.getElementById('pw').value;
  const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em,password:pw})});
  const d=await r.json();
  if(d.ok){
    document.cookie='sb_session='+d.token+';path=/;max-age=604800;SameSite=Lax';
    if(RETURN_TO){location.href=RETURN_TO;}else{location.reload();}
  } else {
    document.getElementById('err').style.display='block';
  }
  return false;
}
</script></body></html>`
}

function getFallbackPage(activeSessions: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SkillBrain</title>
<style>body{background:#08080d;color:#d0d0d0;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
.c{text-align:center}h1{font-size:24px;color:#a78bfa}p{color:#555;margin-top:8px}</style>
</head><body><div class="c"><h1>SkillBrain Hub</h1><p>Server running. Dashboard files not found.</p>
<p>Active sessions: ${activeSessions}</p></div></body></html>`
}

