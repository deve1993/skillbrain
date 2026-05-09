-- Fix nodes_fts: drop content-backed FTS and recreate as standalone.
-- The original definition used content='nodes', but search_text is a computed
-- field (camelCase-expanded) that does not exist as a column in nodes.
-- Any call to `INSERT INTO nodes_fts(nodes_fts) VALUES('rebuild')` therefore
-- fails with "no such column: T.search_text". Standalone FTS avoids this.
DROP TABLE IF EXISTS nodes_fts;

CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
  name,
  file_path,
  search_text
);

-- Repopulate from current nodes with a basic search_text approximation.
-- Full camelCase expansion is done by graph-store.ts on the next codegraph upload.
INSERT INTO nodes_fts(rowid, name, file_path, search_text)
SELECT
  rowid,
  name,
  COALESCE(file_path, ''),
  name || ' ' || REPLACE(REPLACE(LOWER(name), '_', ' '), '-', ' ') || ' ' || COALESCE(file_path, '')
FROM nodes;
