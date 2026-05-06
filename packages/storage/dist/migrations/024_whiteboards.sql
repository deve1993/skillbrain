-- Whiteboards: collaborative async canvas (FigJam-like) for the team.
-- Boards are scoped to either a project or the global team workspace.
-- state_json is the full serialized canvas (nodes, connectors, viewport, votes).
-- state_version supports optimistic concurrency to avoid silent clobber on
-- concurrent saves from different browser tabs.

CREATE TABLE IF NOT EXISTS whiteboards (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  scope              TEXT NOT NULL CHECK(scope IN ('team', 'project')),
  project_name       TEXT,
  created_by         TEXT NOT NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  state_json         TEXT NOT NULL DEFAULT '{}',
  state_version      INTEGER NOT NULL DEFAULT 1,
  thumbnail_data_url TEXT,
  vote_pool          INTEGER NOT NULL DEFAULT 5
);

CREATE INDEX IF NOT EXISTS idx_whiteboards_updated ON whiteboards(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_whiteboards_project ON whiteboards(project_name) WHERE project_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whiteboards_creator ON whiteboards(created_by);

-- Threaded comments anchored to a logical node id inside the board's state_json.
CREATE TABLE IF NOT EXISTS whiteboard_comments (
  id           TEXT PRIMARY KEY,
  board_id     TEXT NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  node_id      TEXT NOT NULL,
  parent_id    TEXT,
  author_email TEXT NOT NULL,
  body         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wb_comments_board_node ON whiteboard_comments(board_id, node_id);
CREATE INDEX IF NOT EXISTS idx_wb_comments_created ON whiteboard_comments(created_at);
