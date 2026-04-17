// Memory Graph Schema — inspired by Spacebot's typed memory system
// Extends CodeGraph with structured memory storage for learnings

export const MEMORY_SCHEMA_SQL = `
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

    -- Core content
    context TEXT NOT NULL,
    problem TEXT NOT NULL,
    solution TEXT NOT NULL,
    reason TEXT NOT NULL,

    -- Scoring
    confidence INTEGER NOT NULL DEFAULT 1 CHECK(confidence >= 1 AND confidence <= 10),
    importance INTEGER NOT NULL DEFAULT 5 CHECK(importance >= 1 AND importance <= 10),

    -- Tags (JSON array)
    tags TEXT NOT NULL DEFAULT '[]',

    -- Temporal
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_validated TEXT,
    sessions_since_validation INTEGER NOT NULL DEFAULT 0,
    validated_by TEXT NOT NULL DEFAULT '[]',

    -- Version tracking
    valid_until_version TEXT,

    -- Source tracking
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

  CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
  CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
  CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
  CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project);
  CREATE INDEX IF NOT EXISTS idx_memories_skill ON memories(skill);
  CREATE INDEX IF NOT EXISTS idx_memories_confidence ON memories(confidence);
  CREATE INDEX IF NOT EXISTS idx_memory_edges_source ON memory_edges(source_id);
  CREATE INDEX IF NOT EXISTS idx_memory_edges_target ON memory_edges(target_id);
  CREATE INDEX IF NOT EXISTS idx_memory_edges_type ON memory_edges(type);
`

export const SESSION_LOG_SQL = `
  CREATE TABLE IF NOT EXISTS session_log (
    id TEXT PRIMARY KEY,
    session_name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    summary TEXT,
    memories_created INTEGER DEFAULT 0,
    memories_validated INTEGER DEFAULT 0,
    files_changed TEXT DEFAULT '[]',
    project TEXT,
    workspace_path TEXT,
    task_description TEXT,
    status TEXT DEFAULT 'completed' CHECK(status IN ('in-progress','completed','paused','blocked')),
    next_steps TEXT,
    blockers TEXT,
    commits TEXT DEFAULT '[]',
    branch TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_session_started ON session_log(started_at);
  CREATE INDEX IF NOT EXISTS idx_session_name ON session_log(session_name);
  CREATE INDEX IF NOT EXISTS idx_session_project ON session_log(project);
  CREATE INDEX IF NOT EXISTS idx_session_status ON session_log(status);
`

export const NOTIFICATIONS_SQL = `
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
  CREATE INDEX IF NOT EXISTS idx_notif_sent ON notifications(sent_at);
`

export const SKILLS_SCHEMA_SQL = `
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
  CREATE INDEX IF NOT EXISTS idx_skills_type ON skills(type);
`

export const SKILLS_FTS_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
    name,
    description,
    content,
    tags,
    content='skills',
    content_rowid='rowid'
  );
`

export const PROJECTS_SCHEMA_SQL = `
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

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
  CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_name);
`

export const PROJECT_ENV_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS project_env_vars (
    id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL REFERENCES projects(name) ON DELETE CASCADE,
    var_name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    environment TEXT DEFAULT 'production',
    source TEXT,
    is_secret INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_name, var_name, environment)
  );

  CREATE INDEX IF NOT EXISTS idx_env_project ON project_env_vars(project_name);
  CREATE INDEX IF NOT EXISTS idx_env_environment ON project_env_vars(environment);
`

export const MEMORY_FTS_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    context,
    problem,
    solution,
    reason,
    tags,
    content='memories',
    content_rowid='rowid'
  );
`
