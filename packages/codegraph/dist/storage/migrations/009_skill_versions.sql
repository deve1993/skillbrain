-- Skill version history: snapshot at every update to allow rollback
CREATE TABLE IF NOT EXISTS skill_versions (
  id              TEXT PRIMARY KEY,
  skill_name      TEXT NOT NULL,
  version_number  INTEGER NOT NULL,
  content         TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  tags            TEXT,
  changed_by      TEXT,
  change_reason   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (skill_name) REFERENCES skills(name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skill_versions_skill ON skill_versions(skill_name, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_skill_versions_changed_by ON skill_versions(changed_by);
