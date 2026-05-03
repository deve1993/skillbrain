-- Skill confidence tracking + co-occurrence for Phase 3 learning loop
ALTER TABLE skills ADD COLUMN confidence INTEGER NOT NULL DEFAULT 5;
ALTER TABLE skills ADD COLUMN last_validated TEXT;
ALTER TABLE skills ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN useful_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN sessions_since_validation INTEGER NOT NULL DEFAULT 0;

-- Also add useful column to skill_usage (in case 015 was applied without it)
ALTER TABLE skill_usage ADD COLUMN useful INTEGER;

CREATE TABLE IF NOT EXISTS skill_cooccurrence (
  skill_a TEXT NOT NULL,
  skill_b TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  last_ts TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (skill_a, skill_b)
);

CREATE INDEX IF NOT EXISTS idx_cooc_a ON skill_cooccurrence(skill_a, count DESC);
CREATE INDEX IF NOT EXISTS idx_cooc_b ON skill_cooccurrence(skill_b, count DESC);
