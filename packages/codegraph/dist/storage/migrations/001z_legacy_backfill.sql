-- Legacy backfill: creates tables and adds columns missing from pre-versioning DBs.
-- Safe to run on any DB — duplicate column errors are tolerated by the migrator,
-- and CREATE TABLE IF NOT EXISTS is a no-op when the table already exists.

-- Create projects table for DBs that skipped bootstrap
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

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_name);

-- Create project_env_vars if missing
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

-- Add missing session_log columns (duplicate column errors are tolerated)
ALTER TABLE session_log ADD COLUMN task_description TEXT;
ALTER TABLE session_log ADD COLUMN status TEXT DEFAULT 'completed';
ALTER TABLE session_log ADD COLUMN next_steps TEXT;
ALTER TABLE session_log ADD COLUMN blockers TEXT;
ALTER TABLE session_log ADD COLUMN commits TEXT;
ALTER TABLE session_log ADD COLUMN branch TEXT;
