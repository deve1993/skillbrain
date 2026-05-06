-- Whiteboard read-only share tokens.
-- When set, anyone with the token can GET (read) the board without auth.
-- Generated server-side; revoked by setting back to NULL.

ALTER TABLE whiteboards ADD COLUMN share_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_whiteboards_share_token
  ON whiteboards(share_token) WHERE share_token IS NOT NULL;
