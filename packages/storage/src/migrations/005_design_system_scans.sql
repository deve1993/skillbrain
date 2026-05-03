CREATE TABLE IF NOT EXISTS design_system_scans (
  id          TEXT PRIMARY KEY,
  project     TEXT NOT NULL,
  scanned_at  TEXT NOT NULL DEFAULT (datetime('now')),
  sources     TEXT NOT NULL DEFAULT '[]',
  merged      TEXT NOT NULL DEFAULT '{}',
  conflicts   TEXT NOT NULL DEFAULT '[]',
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','applied','dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_dss_project ON design_system_scans(project);
CREATE INDEX IF NOT EXISTS idx_dss_status  ON design_system_scans(status);
