import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import http from 'node:http'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/storage/migrator.js'
import { createOAuthRouter, verifyOAuthBearer, type OAuthRouterDeps } from '../src/mcp/oauth-router.js'
import { OAuthStore } from '../src/storage/oauth-store.js'

const TEST_KEY = 'd'.repeat(64)

function createTestUser(db: Database.Database, id = 'user-1') {
  db.prepare('INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)').run(id, 'Test', `${id}@t.com`, 'admin')
}

function fetch(port: number, method: string, path: string, opts: {
  body?: string | Record<string, string>
  headers?: Record<string, string>
  followRedirects?: boolean
} = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; raw: string }> {
  return new Promise((resolve, reject) => {
    const isForm = typeof opts.body === 'object' && !opts.headers?.['content-type']?.includes('json')
    let payload: string | undefined
    const headers: Record<string, string> = { ...opts.headers }

    if (opts.body) {
      if (typeof opts.body === 'string') {
        payload = opts.body
      } else if (isForm) {
        payload = new URLSearchParams(opts.body as Record<string, string>).toString()
        headers['content-type'] = 'application/x-www-form-urlencoded'
      } else {
        payload = JSON.stringify(opts.body)
        headers['content-type'] = 'application/json'
      }
      headers['content-length'] = Buffer.byteLength(payload).toString()
    }

    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
      let raw = ''
      res.on('data', (c) => { raw += c })
      res.on('end', () => {
        let body: any = raw
        try { body = JSON.parse(raw) } catch { /* keep raw */ }
        resolve({ status: res.statusCode!, headers: res.headers, body, raw })
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function createApp(skillbrainRoot: string, loggedInUser: string | null = null): express.Express {
  const app = express()
  const deps: OAuthRouterDeps = {
    skillbrainRoot,
    issuer: 'https://memory.test',
    getUserIdFromRequest: () => loggedInUser,
  }
  app.use(createOAuthRouter(deps))
  return app
}

async function withServer(app: express.Express, fn: (port: number) => Promise<void>) {
  const server = http.createServer(app)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const port = (server.address() as any).port
  try {
    await fn(port)
  } finally {
    server.close()
  }
}

describe('OAuth router — discovery endpoints', () => {
  let tmpDir: string

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    tmpDir = `/tmp/oauth-test-${Date.now()}`
    require('node:fs').mkdirSync(`${tmpDir}/.codegraph`, { recursive: true })
    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    runMigrations(db)
    createTestUser(db)
    db.close()
  })

  afterEach(() => {
    require('node:fs').rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns authorization server metadata', async () => {
    const app = createApp(tmpDir)
    await withServer(app, async (port) => {
      const res = await fetch(port, 'GET', '/.well-known/oauth-authorization-server')
      expect(res.status).toBe(200)
      expect(res.body.issuer).toBe('https://memory.test')
      expect(res.body.code_challenge_methods_supported).toEqual(['S256'])
      expect(res.body.grant_types_supported).toContain('authorization_code')
      expect(res.body.grant_types_supported).toContain('refresh_token')
    })
  })

  it('returns protected resource metadata for /mcp', async () => {
    const app = createApp(tmpDir)
    await withServer(app, async (port) => {
      const res = await fetch(port, 'GET', '/.well-known/oauth-protected-resource')
      expect(res.status).toBe(200)
      expect(res.body.resource).toBe('https://memory.test/mcp')
      expect(res.body.bearer_methods_supported).toEqual(['header'])
    })
  })

  it('sets X-Frame-Options: DENY on all responses', async () => {
    const app = createApp(tmpDir)
    await withServer(app, async (port) => {
      const res = await fetch(port, 'GET', '/.well-known/oauth-authorization-server')
      expect(res.headers['x-frame-options']).toBe('DENY')
    })
  })
})

describe('OAuth router — dynamic client registration', () => {
  let tmpDir: string

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    tmpDir = `/tmp/oauth-test-${Date.now()}`
    require('node:fs').mkdirSync(`${tmpDir}/.codegraph`, { recursive: true })
    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    runMigrations(db)
    createTestUser(db)
    db.close()
  })

  afterEach(() => {
    require('node:fs').rmSync(tmpDir, { recursive: true, force: true })
  })

  it('registers a client with redirect_uris', async () => {
    const app = createApp(tmpDir)
    await withServer(app, async (port) => {
      const res = await fetch(port, 'POST', '/oauth/register', {
        body: JSON.stringify({
          redirect_uris: ['http://localhost:3000/callback'],
          client_name: 'Test Client',
        }),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(201)
      expect(res.body.client_id).toMatch(/^mcp-/)
      expect(res.body.client_secret).toMatch(/^sk-oauth-/)
      expect(res.body.client_name).toBe('Test Client')
      expect(res.body.redirect_uris).toEqual(['http://localhost:3000/callback'])
    })
  })

  it('rejects registration without redirect_uris', async () => {
    const app = createApp(tmpDir)
    await withServer(app, async (port) => {
      const res = await fetch(port, 'POST', '/oauth/register', {
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_client_metadata')
    })
  })

  it('registers a public client with auth method none', async () => {
    const app = createApp(tmpDir)
    await withServer(app, async (port) => {
      const res = await fetch(port, 'POST', '/oauth/register', {
        body: JSON.stringify({
          redirect_uris: ['http://localhost:3000/callback'],
          token_endpoint_auth_method: 'none',
        }),
        headers: { 'content-type': 'application/json' },
      })
      expect(res.status).toBe(201)
      expect(res.body.client_secret).toBeUndefined()
      expect(res.body.token_endpoint_auth_method).toBe('none')
    })
  })
})

describe('OAuth router — authorize endpoint', () => {
  let tmpDir: string
  let clientId: string

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    tmpDir = `/tmp/oauth-test-${Date.now()}`
    require('node:fs').mkdirSync(`${tmpDir}/.codegraph`, { recursive: true })
    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    runMigrations(db)
    createTestUser(db)
    const store = new OAuthStore(db)
    clientId = store.registerClient({
      redirectUris: ['http://localhost:3000/callback'],
      tokenEndpointAuthMethod: 'none',
    }).clientId
    db.close()
  })

  afterEach(() => {
    require('node:fs').rmSync(tmpDir, { recursive: true, force: true })
  })

  it('rejects missing required params', async () => {
    const app = createApp(tmpDir, 'user-1')
    await withServer(app, async (port) => {
      const res = await fetch(port, 'GET', '/oauth/authorize')
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_request')
    })
  })

  it('rejects unsupported response_type', async () => {
    const app = createApp(tmpDir, 'user-1')
    await withServer(app, async (port) => {
      const qs = `?client_id=${clientId}&redirect_uri=${encodeURIComponent('http://localhost:3000/callback')}&response_type=token&code_challenge=ch&code_challenge_method=S256`
      const res = await fetch(port, 'GET', `/oauth/authorize${qs}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('unsupported_response_type')
    })
  })

  it('rejects unknown client_id', async () => {
    const app = createApp(tmpDir, 'user-1')
    await withServer(app, async (port) => {
      const qs = `?client_id=bad&redirect_uri=${encodeURIComponent('http://localhost:3000/callback')}&response_type=code&code_challenge=ch&code_challenge_method=S256`
      const res = await fetch(port, 'GET', `/oauth/authorize${qs}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_client')
    })
  })

  it('rejects mismatched redirect_uri', async () => {
    const app = createApp(tmpDir, 'user-1')
    await withServer(app, async (port) => {
      const qs = `?client_id=${clientId}&redirect_uri=${encodeURIComponent('http://evil.com/callback')}&response_type=code&code_challenge=ch&code_challenge_method=S256`
      const res = await fetch(port, 'GET', `/oauth/authorize${qs}`)
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_request')
    })
  })

  it('redirects to login when user not authenticated', async () => {
    const app = createApp(tmpDir, null)
    await withServer(app, async (port) => {
      const qs = `?client_id=${clientId}&redirect_uri=${encodeURIComponent('http://localhost:3000/callback')}&response_type=code&code_challenge=ch&code_challenge_method=S256`
      const res = await fetch(port, 'GET', `/oauth/authorize${qs}`)
      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('return_to=')
    })
  })

  it('shows consent page when user is authenticated', async () => {
    const app = createApp(tmpDir, 'user-1')
    await withServer(app, async (port) => {
      const qs = `?client_id=${clientId}&redirect_uri=${encodeURIComponent('http://localhost:3000/callback')}&response_type=code&code_challenge=ch&code_challenge_method=S256`
      const res = await fetch(port, 'GET', `/oauth/authorize${qs}`)
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/html')
      expect(res.raw).toContain('Authorize access')
      expect(res.raw).toContain('request_id')
    })
  })
})

describe('OAuth router — token endpoint', () => {
  let tmpDir: string
  let clientId: string
  let clientSecret: string

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    tmpDir = `/tmp/oauth-test-${Date.now()}`
    require('node:fs').mkdirSync(`${tmpDir}/.codegraph`, { recursive: true })
    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    runMigrations(db)
    createTestUser(db)
    const store = new OAuthStore(db)
    const reg = store.registerClient({
      redirectUris: ['http://localhost:3000/callback'],
    })
    clientId = reg.clientId
    clientSecret = reg.clientSecret!
    db.close()
  })

  afterEach(() => {
    require('node:fs').rmSync(tmpDir, { recursive: true, force: true })
  })

  it('rejects token request without client_id', async () => {
    const app = createApp(tmpDir, 'user-1')
    await withServer(app, async (port) => {
      const res = await fetch(port, 'POST', '/oauth/token', {
        body: { grant_type: 'authorization_code' },
      })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_client')
    })
  })

  it('rejects unknown client', async () => {
    const app = createApp(tmpDir, 'user-1')
    await withServer(app, async (port) => {
      const res = await fetch(port, 'POST', '/oauth/token', {
        body: { grant_type: 'authorization_code', client_id: 'mcp-bad', client_secret: 'x' },
      })
      expect(res.status).toBe(401)
      expect(res.body.error).toBe('invalid_client')
    })
  })

  it('rejects wrong client_secret for confidential client', async () => {
    const app = createApp(tmpDir, 'user-1')
    await withServer(app, async (port) => {
      const res = await fetch(port, 'POST', '/oauth/token', {
        body: { grant_type: 'authorization_code', client_id: clientId, client_secret: 'wrong' },
      })
      expect(res.status).toBe(401)
      expect(res.body.error).toBe('invalid_client')
    })
  })

  it('rejects unsupported grant_type', async () => {
    const app = createApp(tmpDir, 'user-1')
    await withServer(app, async (port) => {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      const res = await fetch(port, 'POST', '/oauth/token', {
        body: { grant_type: 'password' },
        headers: { authorization: `Basic ${basicAuth}` },
      })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('unsupported_grant_type')
    })
  })

  it('full authorization_code exchange with PKCE', async () => {
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    const store = new OAuthStore(db)
    const code = store.createAuthCode({
      clientId,
      userId: 'user-1',
      redirectUri: 'http://localhost:3000/callback',
      codeChallenge,
      codeChallengeMethod: 'S256',
      scopes: ['mcp'],
    })
    db.close()

    const app = createApp(tmpDir, 'user-1')
    await withServer(app, async (port) => {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      const res = await fetch(port, 'POST', '/oauth/token', {
        body: {
          grant_type: 'authorization_code',
          code,
          code_verifier: codeVerifier,
          redirect_uri: 'http://localhost:3000/callback',
        },
        headers: { authorization: `Basic ${basicAuth}` },
      })
      expect(res.status).toBe(200)
      expect(res.body.access_token).toMatch(/^at_/)
      expect(res.body.refresh_token).toMatch(/^rt_/)
      expect(res.body.token_type).toBe('Bearer')
      expect(res.body.expires_in).toBe(3600)
      expect(res.body.scope).toBe('mcp')
    })
  })

  it('rejects invalid PKCE verifier', async () => {
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    const store = new OAuthStore(db)
    const code = store.createAuthCode({
      clientId,
      userId: 'user-1',
      redirectUri: 'http://localhost:3000/callback',
      codeChallenge,
      codeChallengeMethod: 'S256',
      scopes: ['mcp'],
    })
    db.close()

    const app = createApp(tmpDir, 'user-1')
    await withServer(app, async (port) => {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      const res = await fetch(port, 'POST', '/oauth/token', {
        body: {
          grant_type: 'authorization_code',
          code,
          code_verifier: 'wrong-verifier',
          redirect_uri: 'http://localhost:3000/callback',
        },
        headers: { authorization: `Basic ${basicAuth}` },
      })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('invalid_grant')
      expect(res.body.error_description).toContain('PKCE')
    })
  })

  it('refresh token rotation', async () => {
    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    const store = new OAuthStore(db)
    const { refreshToken } = store.issueTokens({
      clientId,
      userId: 'user-1',
      scopes: ['mcp'],
    })
    db.close()

    const app = createApp(tmpDir, 'user-1')
    await withServer(app, async (port) => {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      const res = await fetch(port, 'POST', '/oauth/token', {
        body: { grant_type: 'refresh_token', refresh_token: refreshToken },
        headers: { authorization: `Basic ${basicAuth}` },
      })
      expect(res.status).toBe(200)
      expect(res.body.access_token).toMatch(/^at_/)
      expect(res.body.refresh_token).toMatch(/^rt_/)
      expect(res.body.refresh_token).not.toBe(refreshToken)
    })
  })
})

describe('OAuth router — revocation', () => {
  let tmpDir: string
  let clientId: string
  let clientSecret: string

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    tmpDir = `/tmp/oauth-test-${Date.now()}`
    require('node:fs').mkdirSync(`${tmpDir}/.codegraph`, { recursive: true })
    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    runMigrations(db)
    createTestUser(db)
    const store = new OAuthStore(db)
    const reg = store.registerClient({ redirectUris: ['http://localhost/cb'] })
    clientId = reg.clientId
    clientSecret = reg.clientSecret!
    db.close()
  })

  afterEach(() => {
    require('node:fs').rmSync(tmpDir, { recursive: true, force: true })
  })

  it('revokes an access token', async () => {
    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    const store = new OAuthStore(db)
    const { accessToken } = store.issueTokens({ clientId, userId: 'user-1', scopes: ['mcp'] })
    db.close()

    const app = createApp(tmpDir)
    await withServer(app, async (port) => {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      const res = await fetch(port, 'POST', '/oauth/revoke', {
        body: { token: accessToken },
        headers: { authorization: `Basic ${basicAuth}` },
      })
      expect(res.status).toBe(200)

      const db2 = new Database(`${tmpDir}/.codegraph/graph.db`)
      const store2 = new OAuthStore(db2)
      expect(store2.lookupToken(accessToken)).toBeUndefined()
      db2.close()
    })
  })

  it('returns 200 for unknown token (RFC 7009)', async () => {
    const app = createApp(tmpDir)
    await withServer(app, async (port) => {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      const res = await fetch(port, 'POST', '/oauth/revoke', {
        body: { token: 'at_nonexistent' },
        headers: { authorization: `Basic ${basicAuth}` },
      })
      expect(res.status).toBe(200)
    })
  })

  it('returns 200 for empty token (RFC 7009)', async () => {
    const app = createApp(tmpDir)
    await withServer(app, async (port) => {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      const res = await fetch(port, 'POST', '/oauth/revoke', {
        body: {},
        headers: { authorization: `Basic ${basicAuth}` },
      })
      expect(res.status).toBe(200)
    })
  })
})

describe('verifyOAuthBearer', () => {
  let tmpDir: string

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    tmpDir = `/tmp/oauth-test-${Date.now()}`
    require('node:fs').mkdirSync(`${tmpDir}/.codegraph`, { recursive: true })
    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    runMigrations(db)
    createTestUser(db)
    db.close()
  })

  afterEach(() => {
    require('node:fs').rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns user info for valid access token', () => {
    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    const store = new OAuthStore(db)
    const { clientId } = store.registerClient({ redirectUris: ['http://localhost/cb'] })
    const { accessToken } = store.issueTokens({ clientId, userId: 'user-1', scopes: ['mcp'] })
    db.close()

    const result = verifyOAuthBearer(tmpDir, accessToken)
    expect(result).not.toBeNull()
    expect(result!.userId).toBe('user-1')
    expect(result!.clientId).toBe(clientId)
    expect(result!.scopes).toEqual(['mcp'])
  })

  it('returns null for refresh token', () => {
    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    const store = new OAuthStore(db)
    const { clientId } = store.registerClient({ redirectUris: ['http://localhost/cb'] })
    const { refreshToken } = store.issueTokens({ clientId, userId: 'user-1', scopes: ['mcp'] })
    db.close()

    expect(verifyOAuthBearer(tmpDir, refreshToken)).toBeNull()
  })

  it('returns null for revoked token', () => {
    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    const store = new OAuthStore(db)
    const { clientId } = store.registerClient({ redirectUris: ['http://localhost/cb'] })
    const { accessToken } = store.issueTokens({ clientId, userId: 'user-1', scopes: ['mcp'] })
    store.revokeToken(accessToken)
    db.close()

    expect(verifyOAuthBearer(tmpDir, accessToken)).toBeNull()
  })

  it('returns null for invalid token', () => {
    expect(verifyOAuthBearer(tmpDir, 'at_invalid')).toBeNull()
  })
})
