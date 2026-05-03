-- UI Component Catalog + Design Systems storage
-- Tracks reusable UI sections per project and per-client design tokens

CREATE TABLE IF NOT EXISTS ui_components (
  id            TEXT PRIMARY KEY,
  project       TEXT NOT NULL,
  name          TEXT NOT NULL,
  section_type  TEXT NOT NULL CHECK(section_type IN (
    'hero', 'navbar', 'footer', 'cta', 'pricing', 'features',
    'testimonials', 'faq', 'comparison', 'process', 'gallery',
    'demo', 'form', 'card', 'other'
  )),
  description   TEXT,
  file_path     TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',
  props_schema  TEXT NOT NULL DEFAULT '{}',
  code_snippet  TEXT,
  design_tokens TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_uc_project      ON ui_components(project);
CREATE INDEX IF NOT EXISTS idx_uc_section_type ON ui_components(section_type);
CREATE INDEX IF NOT EXISTS idx_uc_name         ON ui_components(name);

CREATE VIRTUAL TABLE IF NOT EXISTS ui_components_fts USING fts5(
  name,
  description,
  tags,
  section_type,
  content='ui_components',
  content_rowid='rowid'
);

CREATE TABLE IF NOT EXISTS design_systems (
  id             TEXT PRIMARY KEY,
  project        TEXT NOT NULL UNIQUE,
  client_name    TEXT,
  colors         TEXT NOT NULL DEFAULT '{}',
  fonts          TEXT NOT NULL DEFAULT '{}',
  spacing        TEXT NOT NULL DEFAULT '{}',
  radius         TEXT NOT NULL DEFAULT '{}',
  animations     TEXT NOT NULL DEFAULT '[]',
  dark_mode      INTEGER NOT NULL DEFAULT 0,
  color_format   TEXT NOT NULL DEFAULT 'hex',
  tailwind_config TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ds_project ON design_systems(project);
