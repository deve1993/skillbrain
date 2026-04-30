-- Migration 017: Align project_env_vars with user_env_vars
-- Adds: category, service
-- Renames: notes → description
-- Fixes: source NULL → 'manual' for existing rows

-- 1. Add category with CHECK constraint (SQLite supports CHECK on ADD COLUMN in 3.37+)
ALTER TABLE project_env_vars ADD COLUMN category TEXT NOT NULL DEFAULT 'api_key'
  CHECK(category IN ('api_key','mcp_config','integration','preference'));

-- 2. Add service
ALTER TABLE project_env_vars ADD COLUMN service TEXT;

-- 3. Add description column (notes never existed in project_env_vars)
ALTER TABLE project_env_vars ADD COLUMN description TEXT;

-- 4. Backfill source = 'manual' for existing NULL rows
UPDATE project_env_vars SET source = 'manual' WHERE source IS NULL;
