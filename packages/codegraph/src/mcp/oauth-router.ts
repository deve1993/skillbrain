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
 * OAuth 2.1 authorization server for MCP clients (ChatGPT, Claude Desktop, etc.)
 *
 * Endpoints:
 *   GET  /.well-known/oauth-authorization-server
 *   GET  /.well-known/oauth-protected-resource
 *   POST /oauth/register              — RFC 7591 dynamic client registration
 *   GET  /oauth/authorize             — show consent page (or login first)
 *   POST /oauth/authorize/consent     — user approves the grant
 *   POST /oauth/token                 — authorization_code + refresh_token grants
 *   POST /oauth/revoke                — token revocation
 *
 * The /authorize flow leans on the existing dashboard session cookie (`sb_session`).
 * If the user isn't logged in, they're redirected to /auth/login with a return_to
 * that resumes the flow.
 */

import express, { type Router, type Request, type Response } from 'express'
import crypto from 'node:crypto'
import { OAuthStore } from '../storage/oauth-store.js'
import { openDb, closeDb } from '../storage/db.js'

const AUTH_REQUEST_COOKIE = 'sb_auth_request'

export interface OAuthRouterDeps {
  skillbrainRoot: string
  issuer: string                      // e.g. https://memory.fl1.it
  getUserIdFromRequest: (req: Request) => string | null
}

function sha256Base64Url(input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64url')
}

function jsonError(res: Response, status: number, error: string, description?: string): void {
  res.status(status).json({ error, error_description: description })
}

function parseBasicAuth(header: string | undefined): { id: string; secret: string } | null {
  if (!header?.startsWith('Basic ')) return null
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8')
    const idx = decoded.indexOf(':')
    if (idx < 0) return null
    return {
      id: decodeURIComponent(decoded.slice(0, idx)),
      secret: decodeURIComponent(decoded.slice(idx + 1)),
    }
  } catch {
    return null
  }
}

function clientAuth(req: Request): { id: string | null; secret: string | null } {
  const basic = parseBasicAuth(req.headers.authorization)
  if (basic) return { id: basic.id, secret: basic.secret }
  const body = (req.body || {}) as Record<string, unknown>
  return {
    id: typeof body.client_id === 'string' ? body.client_id : null,
    secret: typeof body.client_secret === 'string' ? body.client_secret : null,
  }
}

/**
 * Validates a requested redirect_uri against the set registered with the client.
 * Loopback addresses (localhost, 127.0.0.1, [::1]) accept any port per RFC 8252.
 */
function redirectUriMatches(requested: string, registered: string[]): boolean {
  let reqUrl: URL
  try { reqUrl = new URL(requested) } catch { return false }
  for (const reg of registered) {
    let regUrl: URL
    try { regUrl = new URL(reg) } catch { continue }
    if (reqUrl.protocol !== regUrl.protocol) continue
    if (reqUrl.pathname !== regUrl.pathname) continue
    const isLoopback = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
    if (reqUrl.hostname === regUrl.hostname) return true
    if (isLoopback(reqUrl.hostname) && isLoopback(regUrl.hostname)) return true
  }
  return false
}

export function createOAuthRouter(deps: OAuthRouterDeps): Router {
  const router = express.Router()
  const { issuer, skillbrainRoot, getUserIdFromRequest } = deps

  // Prevent clickjacking on the consent page
  router.use((_req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY')
    next()
  })

  // ── Discovery metadata ──────────────────────────────────────────────

  router.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.json({
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      registration_endpoint: `${issuer}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      scopes_supported: ['mcp'],
    })
  })

  router.get('/.well-known/oauth-protected-resource', (_req, res) => {
    res.json({
      resource: `${issuer}/mcp`,
      authorization_servers: [issuer],
      scopes_supported: ['mcp'],
      bearer_methods_supported: ['header'],
    })
  })

  router.get('/.well-known/oauth-protected-resource/mcp', (_req, res) => {
    res.json({
      resource: `${issuer}/mcp`,
      authorization_servers: [issuer],
      scopes_supported: ['mcp'],
      bearer_methods_supported: ['header'],
    })
  })

  router.get('/.well-known/oauth-protected-resource/sse', (_req, res) => {
    res.json({
      resource: `${issuer}/sse`,
      authorization_servers: [issuer],
      scopes_supported: ['mcp'],
      bearer_methods_supported: ['header'],
    })
  })

  // ── Dynamic client registration (RFC 7591) ─────────────────────────

  router.post('/oauth/register', express.json(), (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>
    const redirectUris = Array.isArray(body.redirect_uris) ? (body.redirect_uris as string[]) : []
    if (redirectUris.length === 0) {
      jsonError(res, 400, 'invalid_client_metadata', 'redirect_uris required'); return
    }

    const db = openDb(skillbrainRoot)
    try {
      const store = new OAuthStore(db)
      const { clientId, clientSecret } = store.registerClient({
        redirectUris,
        clientName: typeof body.client_name === 'string' ? body.client_name : undefined,
        clientUri: typeof body.client_uri === 'string' ? body.client_uri : undefined,
        logoUri: typeof body.logo_uri === 'string' ? body.logo_uri : undefined,
        scope: typeof body.scope === 'string' ? body.scope : undefined,
        grantTypes: Array.isArray(body.grant_types) ? (body.grant_types as string[]) : undefined,
        responseTypes: Array.isArray(body.response_types) ? (body.response_types as string[]) : undefined,
        tokenEndpointAuthMethod: typeof body.token_endpoint_auth_method === 'string'
          ? body.token_endpoint_auth_method
          : undefined,
        softwareId: typeof body.software_id === 'string' ? body.software_id : undefined,
        softwareVersion: typeof body.software_version === 'string' ? body.software_version : undefined,
      })
      const row = store.getClient(clientId)!
      res.status(201).json({
        client_id: clientId,
        client_secret: clientSecret ?? undefined,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0,
        client_name: row.client_name ?? undefined,
        redirect_uris: JSON.parse(row.redirect_uris),
        grant_types: JSON.parse(row.grant_types),
        response_types: JSON.parse(row.response_types),
        token_endpoint_auth_method: row.token_endpoint_auth_method,
        scope: row.scope ?? undefined,
      })
    } catch (err) {
      jsonError(res, 500, 'server_error', (err as Error).message)
    } finally {
      closeDb(db)
    }
  })

  // ── Authorization endpoint (GET) ────────────────────────────────────

  router.get('/oauth/authorize', (req, res) => {
    const q = req.query as Record<string, string | undefined>
    const clientId = q.client_id
    const redirectUri = q.redirect_uri
    const responseType = q.response_type
    const codeChallenge = q.code_challenge
    const codeChallengeMethod = q.code_challenge_method ?? 'S256'
    const scope = q.scope ?? 'mcp'
    const state = q.state
    const resource = q.resource

    if (!clientId || !redirectUri || !responseType || !codeChallenge) {
      jsonError(res, 400, 'invalid_request', 'missing required params'); return
    }
    if (responseType !== 'code') {
      jsonError(res, 400, 'unsupported_response_type', 'only "code" supported'); return
    }
    if (codeChallengeMethod !== 'S256') {
      jsonError(res, 400, 'invalid_request', 'only S256 PKCE supported'); return
    }

    const db = openDb(skillbrainRoot)
    const store = new OAuthStore(db)
    const client = store.getClient(clientId)
    if (!client) { closeDb(db); jsonError(res, 400, 'invalid_client', 'unknown client_id'); return }
    const registeredRedirects: string[] = JSON.parse(client.redirect_uris || '[]')
    if (!redirectUriMatches(redirectUri, registeredRedirects)) {
      closeDb(db); jsonError(res, 400, 'invalid_request', 'redirect_uri mismatch'); return
    }

    const requestId = store.createAuthRequest({
      clientId,
      redirectUri,
      state,
      scopes: scope.split(/\s+/).filter(Boolean),
      codeChallenge,
      codeChallengeMethod,
      resource,
    })
    closeDb(db)

    // If user isn't logged in, bounce to the login page with a return_to
    const userId = getUserIdFromRequest(req)
    res.cookie(AUTH_REQUEST_COOKIE, requestId, {
      httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000,
    })
    if (!userId) {
      const returnTo = `/oauth/authorize/continue?request_id=${requestId}`
      res.redirect(`/?return_to=${encodeURIComponent(returnTo)}`); return
    }
    res.type('html').send(renderConsentPage({
      clientName: client.client_name ?? clientId,
      clientUri: client.client_uri,
      logoUri: client.logo_uri,
      scopes: scope.split(/\s+/).filter(Boolean),
      requestId,
    }))
  })

  // Callable after login as the return_to destination — short-circuits back into the flow
  router.get('/oauth/authorize/continue', (req, res) => {
    const requestId = (req.query as any).request_id as string | undefined
    const userId = getUserIdFromRequest(req)
    if (!requestId) { jsonError(res, 400, 'invalid_request', 'missing request_id'); return }
    if (!userId) {
      const returnTo = `/oauth/authorize/continue?request_id=${requestId}`
      res.redirect(`/?return_to=${encodeURIComponent(returnTo)}`); return
    }
    const db = openDb(skillbrainRoot)
    try {
      const store = new OAuthStore(db)
      // Peek without consuming — render consent
      const row = db.prepare('SELECT * FROM oauth_auth_requests WHERE id = ?').get(requestId) as any
      if (!row) { jsonError(res, 400, 'invalid_request', 'unknown or expired request'); return }
      const client = store.getClient(row.client_id)
      if (!client) { jsonError(res, 400, 'invalid_client', 'client disappeared'); return }
      res.type('html').send(renderConsentPage({
        clientName: client.client_name ?? row.client_id,
        clientUri: client.client_uri,
        logoUri: client.logo_uri,
        scopes: JSON.parse(row.scopes || '[]'),
        requestId,
      }))
    } finally {
      closeDb(db)
    }
  })

  // ── Consent POST ────────────────────────────────────────────────────

  router.post('/oauth/authorize/consent', express.urlencoded({ extended: false }), (req, res) => {
    const userId = getUserIdFromRequest(req)
    if (!userId) { jsonError(res, 401, 'login_required'); return }
    const body = req.body as Record<string, string>
    const requestId = body.request_id
    const decision = body.decision // 'approve' | 'deny'
    if (!requestId) { jsonError(res, 400, 'invalid_request', 'missing request_id'); return }

    const db = openDb(skillbrainRoot)
    try {
      const store = new OAuthStore(db)
      const authReq = store.consumeAuthRequest(requestId)
      if (!authReq) { jsonError(res, 400, 'invalid_request', 'request expired or already consumed'); return }

      const redirect = new URL(authReq.redirect_uri)
      if (decision !== 'approve') {
        redirect.searchParams.set('error', 'access_denied')
        if (authReq.state) redirect.searchParams.set('state', authReq.state)
        res.redirect(redirect.toString()); return
      }

      const code = store.createAuthCode({
        clientId: authReq.client_id,
        userId,
        redirectUri: authReq.redirect_uri,
        codeChallenge: authReq.code_challenge,
        codeChallengeMethod: authReq.code_challenge_method,
        scopes: authReq.scopes,
        resource: authReq.resource ?? undefined,
      })
      redirect.searchParams.set('code', code)
      if (authReq.state) redirect.searchParams.set('state', authReq.state)
      res.redirect(redirect.toString())
    } finally {
      closeDb(db)
    }
  })

  // ── Token endpoint ──────────────────────────────────────────────────

  router.post('/oauth/token', express.urlencoded({ extended: false }), express.json(), (req, res) => {
    const body = (req.body || {}) as Record<string, string>
    const grantType = body.grant_type
    const auth = clientAuth(req)
    if (!auth.id) { jsonError(res, 400, 'invalid_client', 'client_id required'); return }

    const db = openDb(skillbrainRoot)
    try {
      const store = new OAuthStore(db)
      const client = store.getClient(auth.id)
      if (!client) { jsonError(res, 401, 'invalid_client', 'unknown client'); return }

      // Confidential clients must present the secret; public (PKCE) clients must not
      const isConfidential = client.token_endpoint_auth_method !== 'none'
      if (isConfidential) {
        if (!auth.secret || !store.verifyClientSecret(auth.id, auth.secret)) {
          res.setHeader('WWW-Authenticate', 'Basic realm="oauth"')
          jsonError(res, 401, 'invalid_client', 'client authentication failed'); return
        }
      }

      if (grantType === 'authorization_code') {
        const code = body.code
        const redirectUri = body.redirect_uri
        const codeVerifier = body.code_verifier
        if (!code || !codeVerifier) {
          jsonError(res, 400, 'invalid_request', 'code and code_verifier required'); return
        }
        const stored = store.getAuthCode(code)
        if (!stored || stored.client_id !== auth.id) {
          jsonError(res, 400, 'invalid_grant', 'invalid or expired code'); return
        }
        if (redirectUri && redirectUri !== stored.redirect_uri) {
          jsonError(res, 400, 'invalid_grant', 'redirect_uri mismatch'); return
        }
        // Verify PKCE
        const expected = stored.code_challenge
        const actual = sha256Base64Url(codeVerifier)
        if (actual.length !== expected.length ||
            !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
          jsonError(res, 400, 'invalid_grant', 'PKCE verification failed'); return
        }

        store.consumeAuthCode(code)
        const { accessToken, refreshToken, expiresIn } = store.issueTokens({
          clientId: stored.client_id,
          userId: stored.user_id,
          scopes: stored.scopes,
          resource: stored.resource ?? undefined,
        })
        res.json({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: expiresIn,
          refresh_token: refreshToken,
          scope: stored.scopes.join(' '),
        })
        return
      }

      if (grantType === 'refresh_token') {
        const refreshToken = body.refresh_token
        if (!refreshToken) { jsonError(res, 400, 'invalid_request', 'refresh_token required'); return }
        const stored = store.lookupToken(refreshToken)
        if (!stored || stored.token_type !== 'refresh' || stored.client_id !== auth.id) {
          jsonError(res, 400, 'invalid_grant', 'invalid refresh token'); return
        }
        // Rotate: revoke the old refresh token, issue a new pair
        store.revokeToken(refreshToken)
        const { accessToken, refreshToken: newRefresh, expiresIn } = store.issueTokens({
          clientId: stored.client_id,
          userId: stored.user_id,
          scopes: stored.scopes,
          resource: stored.resource ?? undefined,
        })
        res.json({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: expiresIn,
          refresh_token: newRefresh,
          scope: stored.scopes.join(' '),
        })
        return
      }

      jsonError(res, 400, 'unsupported_grant_type', `grant_type "${grantType}" not supported`)
    } finally {
      closeDb(db)
    }
  })

  // ── Revocation (RFC 7009) ───────────────────────────────────────────

  router.post('/oauth/revoke', express.urlencoded({ extended: false }), express.json(), (req, res) => {
    const body = (req.body || {}) as Record<string, string>
    const token = body.token
    if (!token) { res.status(200).json({}); return }  // RFC 7009: treat as success
    const auth = clientAuth(req)
    if (!auth.id) { jsonError(res, 400, 'invalid_client', 'client_id required'); return }
    const db = openDb(skillbrainRoot)
    try {
      const store = new OAuthStore(db)
      const client = store.getClient(auth.id)
      if (!client) { jsonError(res, 401, 'invalid_client'); return }
      if (client.token_endpoint_auth_method !== 'none') {
        if (!auth.secret || !store.verifyClientSecret(auth.id, auth.secret)) {
          jsonError(res, 401, 'invalid_client'); return
        }
      }
      const stored = store.lookupToken(token)
      if (stored && stored.client_id === auth.id) store.revokeToken(token)
      res.status(200).json({})
    } finally {
      closeDb(db)
    }
  })

  return router
}

/**
 * Verify an OAuth bearer token and return the associated user.
 * Returns null if token is invalid, expired, or revoked.
 */
export function verifyOAuthBearer(skillbrainRoot: string, token: string): { userId: string; clientId: string; scopes: string[] } | null {
  const db = openDb(skillbrainRoot)
  try {
    const store = new OAuthStore(db)
    const stored = store.lookupToken(token)
    if (!stored || stored.token_type !== 'access') return null
    return { userId: stored.user_id, clientId: stored.client_id, scopes: stored.scopes }
  } finally {
    closeDb(db)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  )
}

function renderConsentPage(p: {
  clientName: string
  clientUri: string | null
  logoUri: string | null
  scopes: string[]
  requestId: string
}): string {
  const name = escapeHtml(p.clientName)
  const uri = p.clientUri ? escapeHtml(p.clientUri) : null
  const logo = p.logoUri ? escapeHtml(p.logoUri) : null
  const scopeList = p.scopes.map((s) => `<li>${escapeHtml(s)}</li>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Authorize ${name} — SkillBrain</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#08080d;color:#d0d0d0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}
.card{background:#0e0e16;border:1px solid #1a1a2a;border-radius:12px;padding:32px;width:100%;max-width:440px}
h1{font-size:20px;margin-bottom:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sub{color:#777;font-size:13px;margin-bottom:24px}
.app{display:flex;align-items:center;gap:12px;padding:16px;background:#111118;border:1px solid #1a1a2a;border-radius:8px;margin-bottom:20px}
.app img{width:48px;height:48px;border-radius:8px;background:#1a1a2a}
.app .name{font-weight:600;color:#fff}
.app .uri{font-size:12px;color:#666;margin-top:2px}
.scopes{background:#111118;border:1px solid #1a1a2a;border-radius:8px;padding:16px;margin-bottom:20px}
.scopes h3{font-size:13px;color:#888;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px}
.scopes ul{list-style:none;padding-left:0}
.scopes li{padding:6px 0;color:#d0d0d0;font-size:14px;display:flex;align-items:center;gap:8px}
.scopes li::before{content:"✓";color:#22c55e}
.warn{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:#fca5a5;padding:12px;border-radius:8px;margin-bottom:20px;font-size:13px;line-height:1.5}
.actions{display:flex;gap:12px}
button{flex:1;padding:12px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;border:none}
.deny{background:#1a1a2a;color:#999}
.deny:hover{background:#232338}
.approve{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
.approve:hover{opacity:.92}
form{display:contents}
</style></head><body>
<div class="card">
<h1>Authorize access</h1>
<div class="sub">A third-party app is requesting access to your SkillBrain account.</div>
<div class="app">
${logo ? `<img src="${logo}" alt="">` : `<div style="width:48px;height:48px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-weight:700">${name.charAt(0).toUpperCase()}</div>`}
<div><div class="name">${name}</div>${uri ? `<div class="uri">${uri}</div>` : ''}</div>
</div>
<div class="scopes">
<h3>This app will be able to:</h3>
<ul>${scopeList || '<li>Use the MCP server on your behalf</li>'}</ul>
</div>
<div class="warn">Only approve if you trust this app. It will be able to read and write your SkillBrain memories, skills, and project data.</div>
<form method="post" action="/oauth/authorize/consent">
<input type="hidden" name="request_id" value="${escapeHtml(p.requestId)}">
<div class="actions">
<button type="submit" name="decision" value="deny" class="deny">Deny</button>
<button type="submit" name="decision" value="approve" class="approve">Approve</button>
</div>
</form>
</div>
</body></html>`
}
