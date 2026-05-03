-- 022_memory_usage.sql
-- Track memory loads/applies per session. Mirror of skill_usage (migration 015).

CREATE TABLE IF NOT EXISTS memory_usage (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id   TEXT NOT NULL,
  session_id  TEXT,
  project     TEXT,
  action      TEXT NOT NULL CHECK(action IN ('loaded','applied')),
  ts          TEXT NOT NULL DEFAULT (datetime('now')),
  user_id     TEXT,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_usage_memory  ON memory_usage(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_usage_session ON memory_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_usage_ts      ON memory_usage(ts);
