CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT,
  role       TEXT NOT NULL DEFAULT 'member',
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  key_hash     TEXT NOT NULL UNIQUE,
  label        TEXT NOT NULL,
  last_used_at TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  revoked_at   TEXT
);
