-- Add 'personal', 'team', 'project' to scope CHECK.
-- SQLite doesn't support ALTER CHECK CONSTRAINT directly so we swap the table.
-- Historical values 'global' and 'project-specific' remain valid for backward compat.
-- In code: treat 'global' as alias for 'team', 'project-specific' as alias for 'project'.

-- Drop the FTS virtual table first (its shadow tables would block DROP TABLE)
DROP TABLE IF EXISTS memories_fts;

CREATE TABLE memories_new (
  id                        TEXT PRIMARY KEY,
  type                      TEXT NOT NULL CHECK(type IN ('Fact','Preference','Decision','Pattern','AntiPattern','BugFix','Goal','Todo')),
  status                    TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','pending-review','deprecated')),
  scope                     TEXT NOT NULL DEFAULT 'team' CHECK(scope IN ('personal','team','project','global','project-specific')),
  project                   TEXT,
  skill                     TEXT,
  context                   TEXT NOT NULL,
  problem                   TEXT NOT NULL,
  solution                  TEXT NOT NULL,
  reason                    TEXT NOT NULL,
  confidence                INTEGER NOT NULL DEFAULT 1 CHECK(confidence >= 1 AND confidence <= 10),
  importance                INTEGER NOT NULL DEFAULT 5 CHECK(importance >= 1 AND importance <= 10),
  tags                      TEXT NOT NULL DEFAULT '[]',
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  last_validated            TEXT,
  sessions_since_validation INTEGER NOT NULL DEFAULT 0,
  validated_by              TEXT NOT NULL DEFAULT '[]',
  valid_until_version       TEXT,
  source_file               TEXT,
  source_session            TEXT,
  migrated_from             TEXT,
  created_by_user_id        TEXT,
  updated_by_user_id        TEXT
);

INSERT INTO memories_new (
  id, type, status, scope, project, skill,
  context, problem, solution, reason,
  confidence, importance, tags,
  created_at, updated_at, last_validated,
  sessions_since_validation, validated_by,
  valid_until_version, source_file, source_session, migrated_from,
  created_by_user_id, updated_by_user_id
)
SELECT
  id, type, status, scope, project, skill,
  context, problem, solution, reason,
  confidence, importance, tags,
  created_at, updated_at, last_validated,
  sessions_since_validation, validated_by,
  valid_until_version, source_file, source_session, migrated_from,
  created_by_user_id, updated_by_user_id
FROM memories;

DROP TABLE memories;
ALTER TABLE memories_new RENAME TO memories;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_memories_type       ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_status     ON memories(status);
CREATE INDEX IF NOT EXISTS idx_memories_scope      ON memories(scope);
CREATE INDEX IF NOT EXISTS idx_memories_project    ON memories(project);
CREATE INDEX IF NOT EXISTS idx_memories_skill      ON memories(skill);
CREATE INDEX IF NOT EXISTS idx_memories_confidence ON memories(confidence);
CREATE INDEX IF NOT EXISTS idx_memories_created_by ON memories(created_by_user_id);

-- Recreate FTS virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  context,
  problem,
  solution,
  reason,
  tags,
  content='memories',
  content_rowid='rowid'
);

-- Rebuild FTS index from restored content
INSERT INTO memories_fts(memories_fts) VALUES('rebuild');
