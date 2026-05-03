-- Ownership tracking on core entities
ALTER TABLE memories ADD COLUMN created_by_user_id TEXT;
ALTER TABLE memories ADD COLUMN updated_by_user_id TEXT;

ALTER TABLE skills ADD COLUMN created_by_user_id TEXT;
ALTER TABLE skills ADD COLUMN updated_by_user_id TEXT;

ALTER TABLE ui_components ADD COLUMN created_by_user_id TEXT;
ALTER TABLE ui_components ADD COLUMN updated_by_user_id TEXT;

-- Audit trail for review queue actions
CREATE TABLE IF NOT EXISTS review_audit (
  id              TEXT PRIMARY KEY,
  entity_type     TEXT NOT NULL CHECK(entity_type IN ('memory','skill','component','proposal','design_scan')),
  entity_id       TEXT NOT NULL,
  action          TEXT NOT NULL CHECK(action IN ('approve','reject','generate','apply','dismiss','rollback')),
  reviewed_by     TEXT NOT NULL,
  notes           TEXT,
  metadata        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_review_audit_entity ON review_audit(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_review_audit_reviewer ON review_audit(reviewed_by, created_at DESC);
