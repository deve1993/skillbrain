-- OAuth 2.0 server tables for MCP clients (ChatGPT, Claude Desktop, etc.)
-- Implements RFC 7591 dynamic client registration + RFC 6749 authorization code flow with PKCE.

-- Registered OAuth clients (one row per app that integrates SkillBrain)
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id                  TEXT PRIMARY KEY,
  client_secret_hash         TEXT,                        -- sha256 of secret; NULL for public clients
  client_secret_expires_at   INTEGER,                     -- seconds since epoch, NULL = never
  client_name                TEXT,
  client_uri                 TEXT,
  logo_uri                   TEXT,
  redirect_uris              TEXT NOT NULL DEFAULT '[]',  -- JSON array
  grant_types                TEXT NOT NULL DEFAULT '["authorization_code","refresh_token"]',
  response_types             TEXT NOT NULL DEFAULT '["code"]',
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'client_secret_basic',
  scope                      TEXT,
  software_id                TEXT,
  software_version           TEXT,
  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  user_id                    TEXT                         -- owner of the client (admin who registered)
);

CREATE INDEX IF NOT EXISTS idx_oauth_clients_user ON oauth_clients(user_id);

-- Authorization codes (short-lived, single-use, PKCE-bound)
CREATE TABLE IF NOT EXISTS oauth_auth_codes (
  code                 TEXT PRIMARY KEY,
  client_id            TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri         TEXT NOT NULL,
  code_challenge       TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  scopes               TEXT NOT NULL DEFAULT '[]',
  resource             TEXT,
  expires_at           INTEGER NOT NULL,                  -- seconds since epoch
  consumed_at          TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_client ON oauth_auth_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_expires ON oauth_auth_codes(expires_at);

-- Access + refresh tokens (hashed at rest)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  token_hash    TEXT PRIMARY KEY,                         -- sha256 of the bearer token
  token_type    TEXT NOT NULL CHECK(token_type IN ('access','refresh')),
  client_id     TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scopes        TEXT NOT NULL DEFAULT '[]',
  resource      TEXT,
  expires_at    INTEGER,                                  -- seconds since epoch, NULL = no expiry (refresh)
  revoked_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  parent_hash   TEXT                                      -- refresh token that minted this access token
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_client ON oauth_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_type ON oauth_tokens(token_type);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);

-- Authorization requests in flight (between /authorize page render and user approval)
CREATE TABLE IF NOT EXISTS oauth_auth_requests (
  id                    TEXT PRIMARY KEY,
  client_id             TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri          TEXT NOT NULL,
  state                 TEXT,
  scopes                TEXT NOT NULL DEFAULT '[]',
  code_challenge        TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  resource              TEXT,
  expires_at            INTEGER NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_oauth_auth_requests_expires ON oauth_auth_requests(expires_at);
