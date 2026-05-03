import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import { runMigrations } from '@skillbrain/storage'
import { OAuthStore } from '@skillbrain/storage'

const TEST_KEY = 'b'.repeat(64)

function createTestUser(db: Database.Database, id = 'user-1', name = 'Test') {
  db.prepare('INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)').run(id, name, `${id}@test.com`, 'admin')
}

describe('OAuthStore — client registration', () => {
  let db: Database.Database
  let store: OAuthStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new OAuthStore(db)
  })

  it('registers a confidential client with hashed secret', () => {
    const { clientId, clientSecret } = store.registerClient({
      redirectUris: ['http://localhost:3000/callback'],
      clientName: 'Test App',
    })
    expect(clientId).toMatch(/^mcp-/)
    expect(clientSecret).toMatch(/^sk-oauth-/)

    const row = store.getClient(clientId)!
    expect(row.client_name).toBe('Test App')
    expect(row.client_secret_hash).toBeTruthy()
    expect(row.client_secret_hash).not.toBe(clientSecret)
    expect(row.token_endpoint_auth_method).toBe('client_secret_basic')
  })

  it('registers a public client (PKCE-only) with no secret', () => {
    const { clientId, clientSecret } = store.registerClient({
      redirectUris: ['http://localhost:3000/callback'],
      tokenEndpointAuthMethod: 'none',
    })
    expect(clientSecret).toBeNull()
    const row = store.getClient(clientId)!
    expect(row.client_secret_hash).toBeNull()
    expect(row.token_endpoint_auth_method).toBe('none')
  })

  it('stores redirect_uris as JSON array', () => {
    const uris = ['http://localhost:3000/a', 'http://localhost:3000/b']
    const { clientId } = store.registerClient({ redirectUris: uris })
    const row = store.getClient(clientId)!
    expect(JSON.parse(row.redirect_uris)).toEqual(uris)
  })

  it('stores custom grant_types and response_types', () => {
    const { clientId } = store.registerClient({
      redirectUris: ['http://localhost:3000/callback'],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
    })
    const row = store.getClient(clientId)!
    expect(JSON.parse(row.grant_types)).toEqual(['authorization_code'])
    expect(JSON.parse(row.response_types)).toEqual(['code'])
  })

  it('listClients returns all registered clients', () => {
    store.registerClient({ redirectUris: ['http://a.com/cb'] })
    store.registerClient({ redirectUris: ['http://b.com/cb'] })
    expect(store.listClients()).toHaveLength(2)
  })

  it('deleteClient removes the client', () => {
    const { clientId } = store.registerClient({ redirectUris: ['http://a.com/cb'] })
    store.deleteClient(clientId)
    expect(store.getClient(clientId)).toBeUndefined()
  })
})

describe('OAuthStore — client secret verification', () => {
  let db: Database.Database
  let store: OAuthStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new OAuthStore(db)
  })

  it('verifies correct secret', () => {
    const { clientId, clientSecret } = store.registerClient({
      redirectUris: ['http://localhost/cb'],
    })
    expect(store.verifyClientSecret(clientId, clientSecret!)).toBe(true)
  })

  it('rejects wrong secret', () => {
    const { clientId } = store.registerClient({
      redirectUris: ['http://localhost/cb'],
    })
    expect(store.verifyClientSecret(clientId, 'wrong-secret')).toBe(false)
  })

  it('returns false for public client (no hash stored)', () => {
    const { clientId } = store.registerClient({
      redirectUris: ['http://localhost/cb'],
      tokenEndpointAuthMethod: 'none',
    })
    expect(store.verifyClientSecret(clientId, 'anything')).toBe(false)
  })

  it('returns false for unknown client', () => {
    expect(store.verifyClientSecret('nonexistent', 'secret')).toBe(false)
  })

  it('uses timing-safe comparison', () => {
    const { clientId, clientSecret } = store.registerClient({
      redirectUris: ['http://localhost/cb'],
    })
    const almostRight = clientSecret!.slice(0, -1) + 'X'
    expect(store.verifyClientSecret(clientId, almostRight)).toBe(false)
  })
})

describe('OAuthStore — authorization requests', () => {
  let db: Database.Database
  let store: OAuthStore
  let clientId: string

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new OAuthStore(db)
    clientId = store.registerClient({ redirectUris: ['http://localhost/cb'] }).clientId
  })

  it('creates and consumes an auth request', () => {
    const id = store.createAuthRequest({
      clientId,
      redirectUri: 'http://localhost/cb',
      state: 'xstate',
      scopes: ['mcp'],
      codeChallenge: 'challenge123',
      codeChallengeMethod: 'S256',
    })
    expect(id).toMatch(/^ar_/)

    const req = store.consumeAuthRequest(id)!
    expect(req.client_id).toBe(clientId)
    expect(req.redirect_uri).toBe('http://localhost/cb')
    expect(req.state).toBe('xstate')
    expect(req.scopes).toEqual(['mcp'])
    expect(req.code_challenge).toBe('challenge123')
  })

  it('consume is single-use — second consume returns undefined', () => {
    const id = store.createAuthRequest({
      clientId,
      redirectUri: 'http://localhost/cb',
      scopes: ['mcp'],
      codeChallenge: 'ch',
    })
    store.consumeAuthRequest(id)
    expect(store.consumeAuthRequest(id)).toBeUndefined()
  })

  it('returns undefined for unknown request id', () => {
    expect(store.consumeAuthRequest('nonexistent')).toBeUndefined()
  })
})

describe('OAuthStore — authorization codes', () => {
  let db: Database.Database
  let store: OAuthStore
  let clientId: string

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new OAuthStore(db)
    clientId = store.registerClient({ redirectUris: ['http://localhost/cb'] }).clientId
  })

  it('creates and retrieves an auth code', () => {
    const code = store.createAuthCode({
      clientId,
      userId: 'user-1',
      redirectUri: 'http://localhost/cb',
      codeChallenge: 'ch',
      codeChallengeMethod: 'S256',
      scopes: ['mcp'],
    })
    expect(code).toMatch(/^ac_/)

    const stored = store.getAuthCode(code)!
    expect(stored.client_id).toBe(clientId)
    expect(stored.user_id).toBe('user-1')
    expect(stored.code_challenge).toBe('ch')
    expect(stored.scopes).toEqual(['mcp'])
  })

  it('consumed codes are not retrievable', () => {
    const code = store.createAuthCode({
      clientId,
      userId: 'user-1',
      redirectUri: 'http://localhost/cb',
      codeChallenge: 'ch',
      codeChallengeMethod: 'S256',
      scopes: ['mcp'],
    })
    store.consumeAuthCode(code)
    expect(store.getAuthCode(code)).toBeUndefined()
  })

  it('returns undefined for unknown code', () => {
    expect(store.getAuthCode('nonexistent')).toBeUndefined()
  })
})

describe('OAuthStore — token lifecycle', () => {
  let db: Database.Database
  let store: OAuthStore
  let clientId: string

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new OAuthStore(db)
    clientId = store.registerClient({ redirectUris: ['http://localhost/cb'] }).clientId
  })

  it('issues access + refresh tokens', () => {
    const { accessToken, refreshToken, expiresIn } = store.issueTokens({
      clientId,
      userId: 'user-1',
      scopes: ['mcp'],
    })
    expect(accessToken).toMatch(/^at_/)
    expect(refreshToken).toMatch(/^rt_/)
    expect(expiresIn).toBe(3600)
  })

  it('looks up access token by value', () => {
    const { accessToken } = store.issueTokens({
      clientId,
      userId: 'user-1',
      scopes: ['mcp'],
    })
    const stored = store.lookupToken(accessToken)!
    expect(stored.token_type).toBe('access')
    expect(stored.client_id).toBe(clientId)
    expect(stored.user_id).toBe('user-1')
    expect(stored.scopes).toEqual(['mcp'])
  })

  it('looks up refresh token by value', () => {
    const { refreshToken } = store.issueTokens({
      clientId,
      userId: 'user-1',
      scopes: ['mcp'],
    })
    const stored = store.lookupToken(refreshToken)!
    expect(stored.token_type).toBe('refresh')
  })

  it('tokens are stored hashed — raw token not in DB', () => {
    const { accessToken } = store.issueTokens({
      clientId,
      userId: 'user-1',
      scopes: ['mcp'],
    })
    const row = db.prepare('SELECT token_hash FROM oauth_tokens WHERE token_type = ?').get('access') as any
    expect(row.token_hash).not.toBe(accessToken)
    const expectedHash = crypto.createHash('sha256').update(accessToken).digest('hex')
    expect(row.token_hash).toBe(expectedHash)
  })

  it('revoked token returns undefined on lookup', () => {
    const { accessToken } = store.issueTokens({
      clientId,
      userId: 'user-1',
      scopes: ['mcp'],
    })
    store.revokeToken(accessToken)
    expect(store.lookupToken(accessToken)).toBeUndefined()
  })

  it('revokeClientTokens revokes all tokens for a client', () => {
    const { accessToken, refreshToken } = store.issueTokens({
      clientId,
      userId: 'user-1',
      scopes: ['mcp'],
    })
    store.revokeClientTokens(clientId)
    expect(store.lookupToken(accessToken)).toBeUndefined()
    expect(store.lookupToken(refreshToken)).toBeUndefined()
  })

  it('unknown token returns undefined', () => {
    expect(store.lookupToken('at_nonexistent')).toBeUndefined()
  })
})

describe('OAuthStore — full PKCE flow', () => {
  let db: Database.Database
  let store: OAuthStore
  let clientId: string

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new OAuthStore(db)
    clientId = store.registerClient({
      redirectUris: ['http://localhost:3000/callback'],
      tokenEndpointAuthMethod: 'none',
    }).clientId
  })

  it('complete PKCE S256 authorization code flow', () => {
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

    const requestId = store.createAuthRequest({
      clientId,
      redirectUri: 'http://localhost:3000/callback',
      state: 'st',
      scopes: ['mcp'],
      codeChallenge,
      codeChallengeMethod: 'S256',
    })

    const authReq = store.consumeAuthRequest(requestId)!
    expect(authReq.code_challenge).toBe(codeChallenge)

    const code = store.createAuthCode({
      clientId: authReq.client_id,
      userId: 'user-1',
      redirectUri: authReq.redirect_uri,
      codeChallenge: authReq.code_challenge,
      codeChallengeMethod: authReq.code_challenge_method,
      scopes: authReq.scopes,
    })

    const storedCode = store.getAuthCode(code)!
    const actualChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
    expect(actualChallenge).toBe(storedCode.code_challenge)

    store.consumeAuthCode(code)
    const { accessToken, refreshToken } = store.issueTokens({
      clientId: storedCode.client_id,
      userId: storedCode.user_id,
      scopes: storedCode.scopes,
    })

    expect(store.lookupToken(accessToken)!.token_type).toBe('access')
    expect(store.lookupToken(refreshToken)!.token_type).toBe('refresh')
  })

  it('refresh token rotation: old refresh is revoked, new pair issued', () => {
    const { refreshToken } = store.issueTokens({
      clientId,
      userId: 'user-1',
      scopes: ['mcp'],
    })

    store.revokeToken(refreshToken)
    const { accessToken: newAccess, refreshToken: newRefresh } = store.issueTokens({
      clientId,
      userId: 'user-1',
      scopes: ['mcp'],
    })

    expect(store.lookupToken(refreshToken)).toBeUndefined()
    expect(store.lookupToken(newAccess)!.token_type).toBe('access')
    expect(store.lookupToken(newRefresh)!.token_type).toBe('refresh')
  })
})

describe('OAuthStore — cleanup', () => {
  let db: Database.Database
  let store: OAuthStore
  let clientId: string

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new OAuthStore(db)
    clientId = store.registerClient({ redirectUris: ['http://localhost/cb'] }).clientId
  })

  it('cleanupExpired removes expired auth codes and requests', () => {
    const pastExpiry = Math.floor(Date.now() / 1000) - 3600
    db.prepare(`INSERT INTO oauth_auth_requests (id, client_id, redirect_uri, code_challenge, code_challenge_method, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('ar_expired', clientId, 'http://localhost/cb', 'ch', 'S256', pastExpiry)
    db.prepare(`INSERT INTO oauth_auth_codes (code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('ac_expired', clientId, 'user-1', 'http://localhost/cb', 'ch', 'S256', pastExpiry)

    store.cleanupExpired()

    const req = db.prepare('SELECT * FROM oauth_auth_requests WHERE id = ?').get('ar_expired')
    const code = db.prepare('SELECT * FROM oauth_auth_codes WHERE code = ?').get('ac_expired')
    expect(req).toBeUndefined()
    expect(code).toBeUndefined()
  })

  it('cleanupExpired does not remove non-expired entries', () => {
    const futureExpiry = Math.floor(Date.now() / 1000) + 3600
    db.prepare(`INSERT INTO oauth_auth_requests (id, client_id, redirect_uri, code_challenge, code_challenge_method, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('ar_valid', clientId, 'http://localhost/cb', 'ch', 'S256', futureExpiry)

    store.cleanupExpired()

    const req = db.prepare('SELECT * FROM oauth_auth_requests WHERE id = ?').get('ar_valid')
    expect(req).toBeTruthy()
  })
})
