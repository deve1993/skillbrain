-- Add pinned flag to projects table for server-side pin persistence.
ALTER TABLE projects ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_projects_pinned ON projects(pinned) WHERE pinned = 1;
