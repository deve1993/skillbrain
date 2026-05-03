-- Add status to skills (existing rows default to 'active')
ALTER TABLE skills ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK(status IN ('active', 'pending', 'deprecated'));

-- Add status to ui_components (existing rows default to 'active')
ALTER TABLE ui_components ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK(status IN ('active', 'pending', 'deprecated'));

-- Skill proposals: nudges created at session_end when ≥2 memories share a skill tag
CREATE TABLE IF NOT EXISTS skill_proposals (
  id          TEXT PRIMARY KEY,
  skill_name  TEXT NOT NULL,
  session_id  TEXT,
  memory_ids  TEXT NOT NULL DEFAULT '[]',
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'dismissed')),
  proposed_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
