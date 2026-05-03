-- Track memory_suggest outcomes for personalization
CREATE TABLE IF NOT EXISTS suggest_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT,
  suggested_type TEXT NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0,
  ts TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_suggest_log_type ON suggest_log(suggested_type, accepted);
