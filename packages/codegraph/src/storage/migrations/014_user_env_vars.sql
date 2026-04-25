-- Per-user master.env: each user has their own credentials, MCP configs,
-- integrations and preferences, encrypted with the same ENCRYPTION_KEY
-- (isolation via user_id, not via separate keys).

CREATE TABLE IF NOT EXISTS user_env_vars (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  var_name        TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  iv              TEXT NOT NULL,
  auth_tag        TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'api_key'
    CHECK(category IN ('api_key','mcp_config','integration','preference')),
  service         TEXT,
  is_secret       INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  source          TEXT NOT NULL DEFAULT 'manual',
  last_used_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, var_name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_env_user ON user_env_vars(user_id);
CREATE INDEX IF NOT EXISTS idx_user_env_user_cat ON user_env_vars(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_env_user_service ON user_env_vars(user_id, service);

-- Extend review_audit to accept user_env entity + reveal action.
-- SQLite cannot ALTER CHECK constraints in place, so we recreate the table.
-- Existing rows are preserved (the new CHECK is a strict superset of the old one).
CREATE TABLE IF NOT EXISTS review_audit_v2 (
  id              TEXT PRIMARY KEY,
  entity_type     TEXT NOT NULL CHECK(entity_type IN ('memory','skill','component','proposal','design_scan','user_env')),
  entity_id       TEXT NOT NULL,
  action          TEXT NOT NULL CHECK(action IN ('approve','reject','generate','apply','dismiss','rollback','reveal','create','update','delete','import','export')),
  reviewed_by     TEXT NOT NULL,
  notes           TEXT,
  metadata        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO review_audit_v2 (id, entity_type, entity_id, action, reviewed_by, notes, metadata, created_at)
  SELECT id, entity_type, entity_id, action, reviewed_by, notes, metadata, created_at FROM review_audit;

DROP TABLE review_audit;
ALTER TABLE review_audit_v2 RENAME TO review_audit;

CREATE INDEX IF NOT EXISTS idx_review_audit_entity ON review_audit(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_review_audit_reviewer ON review_audit(reviewed_by, created_at DESC);
