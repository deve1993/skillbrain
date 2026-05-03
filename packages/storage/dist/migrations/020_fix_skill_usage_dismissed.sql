-- Fix: CHECK constraint on skill_usage.action was missing 'dismissed'.
-- skill_dismiss MCP tool silently failed on every call because the INSERT
-- violated the constraint and was caught by a generic catch block.
-- SQLite cannot ALTER CHECK constraints, so we recreate the table.

CREATE TABLE IF NOT EXISTS skill_usage_new (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_name       TEXT NOT NULL,
  session_id       TEXT,
  project          TEXT,
  task_description TEXT,
  action           TEXT NOT NULL CHECK(action IN ('routed','loaded','applied','dismissed')),
  ts               TEXT NOT NULL DEFAULT (datetime('now')),
  user_id          TEXT,
  useful           INTEGER
);

INSERT INTO skill_usage_new (id, skill_name, session_id, project, task_description, action, ts, user_id, useful)
  SELECT id, skill_name, session_id, project, task_description, action, ts, user_id, useful
  FROM skill_usage;

DROP TABLE IF EXISTS skill_usage;
ALTER TABLE skill_usage_new RENAME TO skill_usage;

CREATE INDEX IF NOT EXISTS idx_skill_usage_name    ON skill_usage(skill_name);
CREATE INDEX IF NOT EXISTS idx_skill_usage_ts      ON skill_usage(ts);
CREATE INDEX IF NOT EXISTS idx_skill_usage_session ON skill_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_skill_usage_action  ON skill_usage(action);
