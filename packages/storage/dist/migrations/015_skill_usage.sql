-- Skill usage telemetry: track every routed/loaded/applied event so we can
-- observe which skills are actually serving the user and feed future scoring.
-- Schema is intentionally lean: no FK on skill_name (skill can be renamed,
-- usage history should survive). The `useful` column is populated later by
-- explicit feedback or implicit signals (Phase 3).

CREATE TABLE IF NOT EXISTS skill_usage (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_name       TEXT NOT NULL,
  session_id       TEXT,
  project          TEXT,
  task_description TEXT,
  action           TEXT NOT NULL CHECK(action IN ('routed','loaded','applied')),
  ts               TEXT NOT NULL DEFAULT (datetime('now')),
  user_id          TEXT,
  useful           INTEGER  -- NULL = unknown, 1 = yes, 0 = no
);

CREATE INDEX IF NOT EXISTS idx_skill_usage_name    ON skill_usage(skill_name);
CREATE INDEX IF NOT EXISTS idx_skill_usage_ts      ON skill_usage(ts);
CREATE INDEX IF NOT EXISTS idx_skill_usage_session ON skill_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_skill_usage_action  ON skill_usage(action);
