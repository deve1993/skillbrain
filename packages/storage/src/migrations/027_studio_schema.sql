CREATE TABLE IF NOT EXISTS studio_conversations (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','generating','done','error')),
  brief_json   TEXT,
  skill_id     TEXT,
  ds_id        TEXT,
  direction_id TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS studio_messages (
  id            TEXT PRIMARY KEY,
  conv_id       TEXT NOT NULL REFERENCES studio_conversations(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK(role IN ('user','assistant','artifact')),
  content       TEXT NOT NULL,
  artifact_html TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS studio_jobs (
  id              TEXT PRIMARY KEY,
  conv_id         TEXT NOT NULL REFERENCES studio_conversations(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','done','error')),
  agent_model     TEXT NOT NULL,
  critique_model  TEXT NOT NULL,
  prompt_snapshot TEXT NOT NULL DEFAULT '',
  artifact_html   TEXT,
  critique_json   TEXT,
  error_msg       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS studio_design_systems (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL UNIQUE,
  category           TEXT NOT NULL DEFAULT 'general',
  source_url         TEXT,
  tokens_json        TEXT NOT NULL DEFAULT '{}',
  guidelines_json    TEXT NOT NULL DEFAULT '[]',
  custom_tokens_json TEXT,
  custom_notes       TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS studio_ds_versions (
  id           TEXT PRIMARY KEY,
  ds_id        TEXT NOT NULL REFERENCES studio_design_systems(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  change_json  TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS studio_skills (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'web',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS studio_directions (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  description    TEXT NOT NULL,
  moodboard_json TEXT NOT NULL DEFAULT '[]',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS studio_media_templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK(type IN ('image','video','hyperframe','audio')),
  prompt_template TEXT NOT NULL,
  category        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS studio_audit_log (
  id          TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,
  actor_email TEXT,
  detail_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_studio_conv_updated ON studio_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_conv_status ON studio_conversations(status);
CREATE INDEX IF NOT EXISTS idx_studio_msg_conv ON studio_messages(conv_id, created_at);
CREATE INDEX IF NOT EXISTS idx_studio_job_conv ON studio_jobs(conv_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_job_status ON studio_jobs(status);
CREATE INDEX IF NOT EXISTS idx_studio_ds_name ON studio_design_systems(name);
CREATE INDEX IF NOT EXISTS idx_studio_ds_category ON studio_design_systems(category);
CREATE INDEX IF NOT EXISTS idx_studio_dsv_ds ON studio_ds_versions(ds_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_skill_cat ON studio_skills(category);
CREATE INDEX IF NOT EXISTS idx_studio_media_type ON studio_media_templates(type);
CREATE INDEX IF NOT EXISTS idx_studio_audit_entity ON studio_audit_log(entity_type, entity_id, created_at DESC);
