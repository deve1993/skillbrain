-- 021_memory_dismissals.sql
-- Track dismissals so retrieval can penalize wrong/outdated memories.

CREATE TABLE IF NOT EXISTS memory_dismissals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id   TEXT NOT NULL,
  reason      TEXT,
  user_id     TEXT,
  ts          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_dismissals_memory ON memory_dismissals(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_dismissals_ts     ON memory_dismissals(ts);
