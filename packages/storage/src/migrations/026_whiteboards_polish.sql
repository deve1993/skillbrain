-- Phase E: list page polish + data integrity additions.
-- - pinned_at: when set, board appears in user's "pinned" section
-- - last_opened_at: last time anyone opened this board (for "recent")
-- - tags: JSON array of free-form tags for organization
-- - description: short user-provided summary
-- - deleted_at: soft delete (null = active, timestamp = trashed)

ALTER TABLE whiteboards ADD COLUMN pinned_at TEXT;
ALTER TABLE whiteboards ADD COLUMN last_opened_at TEXT;
ALTER TABLE whiteboards ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE whiteboards ADD COLUMN description TEXT;
ALTER TABLE whiteboards ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_whiteboards_pinned ON whiteboards(pinned_at) WHERE pinned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whiteboards_last_opened ON whiteboards(last_opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_whiteboards_deleted ON whiteboards(deleted_at);

-- Snapshots: store periodic state copies for time-travel restore
CREATE TABLE IF NOT EXISTS whiteboard_snapshots (
  id          TEXT PRIMARY KEY,
  board_id    TEXT NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  state_json  TEXT NOT NULL,
  state_version INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  created_by  TEXT,
  reason      TEXT  -- 'auto' | 'manual' | 'pre-merge' | 'pre-restore'
);
CREATE INDEX IF NOT EXISTS idx_wb_snap_board_time ON whiteboard_snapshots(board_id, created_at DESC);

-- Activity log: who did what when on a board
CREATE TABLE IF NOT EXISTS whiteboard_activity (
  id          TEXT PRIMARY KEY,
  board_id    TEXT NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  user_email  TEXT NOT NULL,
  action      TEXT NOT NULL,  -- 'created' | 'edited' | 'commented' | 'restored' | 'shared' | ...
  detail      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wb_activity_board_time ON whiteboard_activity(board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wb_activity_user ON whiteboard_activity(user_email);

-- Notifications inbox (used for @mentions, comment replies, etc.)
CREATE TABLE IF NOT EXISTS whiteboard_notifications (
  id            TEXT PRIMARY KEY,
  user_email    TEXT NOT NULL,
  type          TEXT NOT NULL,   -- 'mention' | 'reply' | 'shared'
  board_id      TEXT,
  node_id       TEXT,
  body          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  read_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_wb_notif_user_unread ON whiteboard_notifications(user_email, read_at);

-- Heartbeat / presence: who's currently viewing/editing what
CREATE TABLE IF NOT EXISTS whiteboard_presence (
  board_id    TEXT NOT NULL,
  user_email  TEXT NOT NULL,
  last_seen   TEXT NOT NULL,
  PRIMARY KEY (board_id, user_email)
);
CREATE INDEX IF NOT EXISTS idx_wb_presence_seen ON whiteboard_presence(last_seen);
