-- Migration 031: Expand design_systems with 7 new token category columns
ALTER TABLE design_systems ADD COLUMN palette         TEXT NOT NULL DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN semantic_colors TEXT NOT NULL DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN shadows         TEXT NOT NULL DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN typography      TEXT NOT NULL DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN effects         TEXT NOT NULL DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN components      TEXT NOT NULL DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN assets          TEXT NOT NULL DEFAULT '{}';
