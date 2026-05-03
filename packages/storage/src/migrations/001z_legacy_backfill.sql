-- Legacy backfill: fills in tables and columns that are missing from
-- pre-versioning DBs (where 000_bootstrap was skipped because session_log
-- already existed). Safe to run on any DB:
--   - CREATE … IF NOT EXISTS is a no-op on tables/indexes that already exist
--   - duplicate-column ALTERs are tolerated by the migrator's per-statement retry

-- ── CodeGraph core ──
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT,
  start_line INTEGER,
  end_line INTEGER,
  is_exported INTEGER DEFAULT 0,
  properties TEXT
);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  reason TEXT,
  step INTEGER,
  UNIQUE(source_id, target_id, type)
);

CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  symbol_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_type   ON edges(type);
CREATE INDEX IF NOT EXISTS idx_nodes_label  ON nodes(label);
CREATE INDEX IF NOT EXISTS idx_nodes_name   ON nodes(name);
CREATE INDEX IF NOT EXISTS idx_nodes_file   ON nodes(file_path);

CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
  name, file_path, search_text,
  content='nodes', content_rowid='rowid'
);

-- ── Memory graph ──
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN (
    'Fact', 'Preference', 'Decision', 'Pattern',
    'AntiPattern', 'BugFix', 'Goal', 'Todo'
  )),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN (
    'active', 'pending-review', 'deprecated'
  )),
  scope TEXT NOT NULL DEFAULT 'global' CHECK(scope IN (
    'global', 'project-specific'
  )),
  project TEXT,
  skill TEXT,
  context TEXT NOT NULL,
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  reason TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 1 CHECK(confidence >= 1 AND confidence <= 10),
  importance INTEGER NOT NULL DEFAULT 5 CHECK(importance >= 1 AND importance <= 10),
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_validated TEXT,
  sessions_since_validation INTEGER NOT NULL DEFAULT 0,
  validated_by TEXT NOT NULL DEFAULT '[]',
  valid_until_version TEXT,
  source_file TEXT,
  source_session TEXT,
  migrated_from TEXT
);

CREATE TABLE IF NOT EXISTS memory_edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN (
    'RelatedTo', 'Updates', 'Contradicts', 'CausedBy', 'PartOf'
  )),
  reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(source_id, target_id, type)
);

CREATE INDEX IF NOT EXISTS idx_memories_type        ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_status      ON memories(status);
CREATE INDEX IF NOT EXISTS idx_memories_scope       ON memories(scope);
CREATE INDEX IF NOT EXISTS idx_memories_project     ON memories(project);
CREATE INDEX IF NOT EXISTS idx_memories_skill       ON memories(skill);
CREATE INDEX IF NOT EXISTS idx_memories_confidence  ON memories(confidence);
CREATE INDEX IF NOT EXISTS idx_memory_edges_source  ON memory_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_memory_edges_target  ON memory_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_memory_edges_type    ON memory_edges(type);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  context, problem, solution, reason, tags,
  content='memories', content_rowid='rowid'
);

-- ── Notifications ──
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT,
  sent_at TEXT NOT NULL,
  success INTEGER DEFAULT 1,
  error TEXT,
  consecutive_failures INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_notif_channel ON notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notif_sent    ON notifications(sent_at);

-- ── Skills catalog ──
CREATE TABLE IF NOT EXISTS skills (
  name TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN (
    'domain', 'lifecycle', 'process', 'agent', 'command'
  )),
  tags TEXT NOT NULL DEFAULT '[]',
  lines INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_type     ON skills(type);

CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
  name, description, content, tags,
  content='skills', content_rowid='rowid'
);

-- ── Projects registry ──
CREATE TABLE IF NOT EXISTS projects (
  name TEXT PRIMARY KEY,
  display_name TEXT,
  description TEXT,
  client_name TEXT,
  category TEXT,
  started_at TEXT,
  ended_at TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','archived','completed')),
  repo_url TEXT,
  main_branch TEXT DEFAULT 'main',
  workspace_path TEXT,
  stack TEXT DEFAULT '[]',
  language TEXT,
  package_manager TEXT,
  node_version TEXT,
  db_type TEXT,
  db_reference TEXT,
  db_admin_url TEXT,
  cms_type TEXT,
  cms_admin_url TEXT,
  deploy_platform TEXT,
  live_url TEXT,
  deploy_status TEXT,
  last_deploy TEXT,
  has_ci INTEGER DEFAULT 0,
  domain_primary TEXT,
  domains_extra TEXT DEFAULT '[]',
  integrations TEXT DEFAULT '{}',
  legal_cookie_banner TEXT,
  legal_privacy_url TEXT,
  legal_terms_url TEXT,
  aliases TEXT DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  team_lead TEXT,
  team_members TEXT DEFAULT '[]'
);

-- Backfill projects columns for legacy 3-column tables (duplicate-column tolerated)
ALTER TABLE projects ADD COLUMN display_name TEXT;
ALTER TABLE projects ADD COLUMN description TEXT;
ALTER TABLE projects ADD COLUMN client_name TEXT;
ALTER TABLE projects ADD COLUMN category TEXT;
ALTER TABLE projects ADD COLUMN started_at TEXT;
ALTER TABLE projects ADD COLUMN ended_at TEXT;
ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE projects ADD COLUMN repo_url TEXT;
ALTER TABLE projects ADD COLUMN main_branch TEXT DEFAULT 'main';
ALTER TABLE projects ADD COLUMN workspace_path TEXT;
ALTER TABLE projects ADD COLUMN stack TEXT DEFAULT '[]';
ALTER TABLE projects ADD COLUMN language TEXT;
ALTER TABLE projects ADD COLUMN package_manager TEXT;
ALTER TABLE projects ADD COLUMN node_version TEXT;
ALTER TABLE projects ADD COLUMN db_type TEXT;
ALTER TABLE projects ADD COLUMN db_reference TEXT;
ALTER TABLE projects ADD COLUMN db_admin_url TEXT;
ALTER TABLE projects ADD COLUMN cms_type TEXT;
ALTER TABLE projects ADD COLUMN cms_admin_url TEXT;
ALTER TABLE projects ADD COLUMN deploy_platform TEXT;
ALTER TABLE projects ADD COLUMN live_url TEXT;
ALTER TABLE projects ADD COLUMN deploy_status TEXT;
ALTER TABLE projects ADD COLUMN last_deploy TEXT;
ALTER TABLE projects ADD COLUMN has_ci INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN domain_primary TEXT;
ALTER TABLE projects ADD COLUMN domains_extra TEXT DEFAULT '[]';
ALTER TABLE projects ADD COLUMN integrations TEXT DEFAULT '{}';
ALTER TABLE projects ADD COLUMN legal_cookie_banner TEXT;
ALTER TABLE projects ADD COLUMN legal_privacy_url TEXT;
ALTER TABLE projects ADD COLUMN legal_terms_url TEXT;
ALTER TABLE projects ADD COLUMN aliases TEXT DEFAULT '[]';
ALTER TABLE projects ADD COLUMN notes TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_name);

-- ── Project environment variables ──
CREATE TABLE IF NOT EXISTS project_env_vars (
  id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL REFERENCES projects(name) ON DELETE CASCADE,
  var_name TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  is_secret INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_name, var_name)
);

-- ── session_log column backfill ──
-- (duplicate-column errors are tolerated by the migrator's per-statement retry)
ALTER TABLE session_log ADD COLUMN ended_at TEXT;
ALTER TABLE session_log ADD COLUMN summary TEXT;
ALTER TABLE session_log ADD COLUMN memories_created INTEGER DEFAULT 0;
ALTER TABLE session_log ADD COLUMN memories_validated INTEGER DEFAULT 0;
ALTER TABLE session_log ADD COLUMN files_changed TEXT DEFAULT '[]';
ALTER TABLE session_log ADD COLUMN project TEXT;
ALTER TABLE session_log ADD COLUMN workspace_path TEXT;
ALTER TABLE session_log ADD COLUMN task_description TEXT;
ALTER TABLE session_log ADD COLUMN status TEXT DEFAULT 'completed';
ALTER TABLE session_log ADD COLUMN next_steps TEXT;
ALTER TABLE session_log ADD COLUMN blockers TEXT;
ALTER TABLE session_log ADD COLUMN commits TEXT DEFAULT '[]';
ALTER TABLE session_log ADD COLUMN branch TEXT;
ALTER TABLE session_log ADD COLUMN work_type TEXT;
ALTER TABLE session_log ADD COLUMN deliverables TEXT;
ALTER TABLE session_log ADD COLUMN last_heartbeat TEXT;

CREATE INDEX IF NOT EXISTS idx_session_started ON session_log(started_at);
CREATE INDEX IF NOT EXISTS idx_session_name    ON session_log(session_name);
CREATE INDEX IF NOT EXISTS idx_session_project ON session_log(project);
CREATE INDEX IF NOT EXISTS idx_session_status  ON session_log(status);
