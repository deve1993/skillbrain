-- Component comments
CREATE TABLE IF NOT EXISTS component_comments (
  id           TEXT PRIMARY KEY,
  component_id TEXT NOT NULL,
  user_id      TEXT,
  user_email   TEXT,
  text         TEXT NOT NULL,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ccomments_component ON component_comments(component_id);
