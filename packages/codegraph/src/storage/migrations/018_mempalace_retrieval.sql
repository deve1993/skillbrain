-- 018_mempalace_retrieval.sql
-- Applies MemPalace retrieval principles to SkillBrain:
--   1. Trigram FTS5 tokenizer for partial/prefix matching
--   2. Session chunks for verbatim session content search

-- ── 1. FTS5 trigram index for memories ─────────────────────────────────────
-- Parallel to memories_fts (unicode61) — both coexist for backward compat.
-- Trigram tokenizer: "serv" matches "server", "service", etc.
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts_trgm USING fts5(
  context,
  problem,
  solution,
  reason,
  tags,
  content='memories',
  content_rowid='rowid',
  tokenize='trigram'
);

-- Backfill from existing memories
INSERT INTO memories_fts_trgm(rowid, context, problem, solution, reason, tags)
SELECT rowid, context, problem, solution, reason, tags FROM memories;

-- ── 2. Session chunks table ─────────────────────────────────────────────────
-- Stores verbatim 800-char chunks of session summaries, searchable via FTS5.
CREATE TABLE IF NOT EXISTS session_chunks (
  id          TEXT    PRIMARY KEY,
  session_id  TEXT    NOT NULL REFERENCES session_log(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT    NOT NULL,
  project     TEXT,
  started_at  TEXT,
  UNIQUE(session_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_session_chunks_session ON session_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_session_chunks_project ON session_chunks(project);

-- FTS5 trigram index for session chunks
CREATE VIRTUAL TABLE IF NOT EXISTS session_chunks_fts USING fts5(
  content,
  content='session_chunks',
  content_rowid='rowid',
  tokenize='trigram'
);
