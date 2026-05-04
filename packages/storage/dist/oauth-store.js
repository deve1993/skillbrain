/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */
import crypto from 'node:crypto';
const AUTH_REQUEST_TTL_SEC = 10 * 60; // 10 min to complete login + consent
const AUTH_CODE_TTL_SEC = 60; // 60s to exchange the code for a token
const ACCESS_TOKEN_TTL_SEC = 60 * 60; // 1h
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 3600; // 30 days
export class OAuthStore {
    db;
    constructor(db) {
        this.db = db;
    }
    // ── Clients ────────────────────────────────────────────────────────────
    registerClient(input) {
        const clientId = 'mcp-' + crypto.randomBytes(12).toString('hex');
        const authMethod = input.tokenEndpointAuthMethod ?? 'client_secret_basic';
        // Public clients (PKCE-only, e.g. native apps) don't get a secret
        const isPublic = authMethod === 'none';
        const clientSecret = isPublic ? null : 'sk-oauth-' + crypto.randomBytes(24).toString('hex');
        const secretHash = clientSecret
            ? crypto.createHash('sha256').update(clientSecret).digest('hex')
            : null;
        this.db.prepare(`
      INSERT INTO oauth_clients (
        client_id, client_secret_hash, client_name, client_uri, logo_uri,
        redirect_uris, grant_types, response_types,
        token_endpoint_auth_method, scope, software_id, software_version, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(clientId, secretHash, input.clientName ?? null, input.clientUri ?? null, input.logoUri ?? null, JSON.stringify(input.redirectUris), JSON.stringify(input.grantTypes ?? ['authorization_code', 'refresh_token']), JSON.stringify(input.responseTypes ?? ['code']), authMethod, input.scope ?? null, input.softwareId ?? null, input.softwareVersion ?? null, input.userId ?? null);
        return { clientId, clientSecret };
    }
    getClient(clientId) {
        return this.db
            .prepare(`SELECT * FROM oauth_clients WHERE client_id = ?`)
            .get(clientId);
    }
    verifyClientSecret(clientId, clientSecret) {
        const row = this.getClient(clientId);
        if (!row?.client_secret_hash)
            return false;
        const hash = crypto.createHash('sha256').update(clientSecret).digest('hex');
        const a = Buffer.from(hash, 'hex');
        const b = Buffer.from(row.client_secret_hash, 'hex');
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    }
    listClients() {
        return this.db
            .prepare(`SELECT * FROM oauth_clients ORDER BY created_at DESC`)
            .all();
    }
    deleteClient(clientId) {
        this.db.prepare(`DELETE FROM oauth_clients WHERE client_id = ?`).run(clientId);
    }
    // ── Authorization requests (pre-consent) ──────────────────────────────
    createAuthRequest(input) {
        const id = 'ar_' + crypto.randomBytes(16).toString('hex');
        const expiresAt = Math.floor(Date.now() / 1000) + AUTH_REQUEST_TTL_SEC;
        this.db.prepare(`
      INSERT INTO oauth_auth_requests (
        id, client_id, redirect_uri, state, scopes,
        code_challenge, code_challenge_method, resource, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.clientId, input.redirectUri, input.state ?? null, JSON.stringify(input.scopes), input.codeChallenge, input.codeChallengeMethod ?? 'S256', input.resource ?? null, expiresAt);
        return id;
    }
    consumeAuthRequest(id) {
        const row = this.db.prepare(`SELECT * FROM oauth_auth_requests WHERE id = ?`).get(id);
        if (!row)
            return undefined;
        this.db.prepare(`DELETE FROM oauth_auth_requests WHERE id = ?`).run(id);
        if (row.expires_at < Math.floor(Date.now() / 1000))
            return undefined;
        return {
            id: row.id,
            client_id: row.client_id,
            redirect_uri: row.redirect_uri,
            state: row.state,
            scopes: JSON.parse(row.scopes || '[]'),
            code_challenge: row.code_challenge,
            code_challenge_method: row.code_challenge_method,
            resource: row.resource,
            expires_at: row.expires_at,
        };
    }
    // ── Authorization codes ───────────────────────────────────────────────
    createAuthCode(input) {
        const code = 'ac_' + crypto.randomBytes(24).toString('hex');
        const expiresAt = Math.floor(Date.now() / 1000) + AUTH_CODE_TTL_SEC;
        this.db.prepare(`
      INSERT INTO oauth_auth_codes (
        code, client_id, user_id, redirect_uri,
        code_challenge, code_challenge_method, scopes, resource, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, input.clientId, input.userId, input.redirectUri, input.codeChallenge, input.codeChallengeMethod, JSON.stringify(input.scopes), input.resource ?? null, expiresAt);
        return code;
    }
    getAuthCode(code) {
        const row = this.db.prepare(`
      SELECT * FROM oauth_auth_codes WHERE code = ? AND consumed_at IS NULL
    `).get(code);
        if (!row)
            return undefined;
        if (row.expires_at < Math.floor(Date.now() / 1000))
            return undefined;
        return {
            code: row.code,
            client_id: row.client_id,
            user_id: row.user_id,
            redirect_uri: row.redirect_uri,
            code_challenge: row.code_challenge,
            code_challenge_method: row.code_challenge_method,
            scopes: JSON.parse(row.scopes || '[]'),
            resource: row.resource,
            expires_at: row.expires_at,
        };
    }
    consumeAuthCode(code) {
        this.db.prepare(`
      UPDATE oauth_auth_codes SET consumed_at = datetime('now') WHERE code = ?
    `).run(code);
    }
    // ── Tokens ────────────────────────────────────────────────────────────
    issueTokens(input) {
        const accessToken = 'at_' + crypto.randomBytes(32).toString('hex');
        const refreshToken = 'rt_' + crypto.randomBytes(32).toString('hex');
        const accessHash = crypto.createHash('sha256').update(accessToken).digest('hex');
        const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const now = Math.floor(Date.now() / 1000);
        const scopesJson = JSON.stringify(input.scopes);
        const insert = this.db.prepare(`
      INSERT INTO oauth_tokens (
        token_hash, token_type, client_id, user_id, scopes, resource, expires_at, parent_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        insert.run(accessHash, 'access', input.clientId, input.userId, scopesJson, input.resource ?? null, now + ACCESS_TOKEN_TTL_SEC, input.parentRefreshHash ?? null);
        insert.run(refreshHash, 'refresh', input.clientId, input.userId, scopesJson, input.resource ?? null, now + REFRESH_TOKEN_TTL_SEC, null);
        return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SEC };
    }
    lookupToken(token) {
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        const row = this.db.prepare(`
      SELECT * FROM oauth_tokens WHERE token_hash = ? AND revoked_at IS NULL
    `).get(hash);
        if (!row)
            return undefined;
        if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000))
            return undefined;
        return {
            token_hash: row.token_hash,
            token_type: row.token_type,
            client_id: row.client_id,
            user_id: row.user_id,
            scopes: JSON.parse(row.scopes || '[]'),
            resource: row.resource,
            expires_at: row.expires_at,
            revoked_at: row.revoked_at,
        };
    }
    revokeToken(token) {
        const hash = crypto.createHash('sha256').update(token).digest('hex');
        this.db.prepare(`
      UPDATE oauth_tokens SET revoked_at = datetime('now') WHERE token_hash = ?
    `).run(hash);
    }
    revokeClientTokens(clientId) {
        this.db.prepare(`
      UPDATE oauth_tokens SET revoked_at = datetime('now')
      WHERE client_id = ? AND revoked_at IS NULL
    `).run(clientId);
    }
    // Clean expired codes + tokens (optional maintenance hook)
    cleanupExpired() {
        const now = Math.floor(Date.now() / 1000);
        this.db.prepare(`DELETE FROM oauth_auth_codes WHERE expires_at < ?`).run(now);
        this.db.prepare(`DELETE FROM oauth_auth_requests WHERE expires_at < ?`).run(now);
        this.db.prepare(`DELETE FROM oauth_tokens WHERE expires_at IS NOT NULL AND expires_at < ?`).run(now - 7 * 24 * 3600);
    }
}
//# sourceMappingURL=oauth-store.js.map