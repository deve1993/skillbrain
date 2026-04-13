export const SCHEMA_SQL = `
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
  CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
  CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(label);
  CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);
  CREATE INDEX IF NOT EXISTS idx_nodes_file ON nodes(file_path);
`

export const FTS_SCHEMA_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
    name,
    file_path,
    search_text,
    content='nodes',
    content_rowid='rowid'
  );
`

// FTS triggers are NOT used — we populate FTS manually after insert
// with expanded camelCase tokens for better search
export const FTS_TRIGGERS_SQL = ``
