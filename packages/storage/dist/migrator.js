/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SCHEMA_MIGRATIONS_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`;
function listMigrations(dir) {
    if (!fs.existsSync(dir))
        return [];
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
}
export function getAppliedMigrations(db) {
    db.exec(SCHEMA_MIGRATIONS_SQL);
    const rows = db
        .prepare(`SELECT name FROM schema_migrations ORDER BY name`)
        .all();
    return rows.map((r) => r.name);
}
function tableExists(db, name) {
    const row = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .get(name);
    return !!row;
}
export function runMigrations(db, dir = MIGRATIONS_DIR) {
    db.exec(SCHEMA_MIGRATIONS_SQL);
    const applied = new Set(getAppliedMigrations(db));
    const files = listMigrations(dir);
    for (const file of files) {
        const name = file.replace(/\.sql$/, '');
        if (applied.has(name))
            continue;
        const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
        // Legacy DB support: if a pre-versioning DB already has session_log,
        // skip 000_bootstrap (which would fail on CREATE INDEX over columns the
        // legacy table lacks) and let 001z_legacy_backfill create the still-missing
        // tables and columns.
        if (name === '000_bootstrap' &&
            tableExists(db, 'session_log')) {
            db.prepare(`INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`).run(name, new Date().toISOString());
            continue;
        }
        const tx = db.transaction(() => {
            try {
                // Execute the whole file as one batch — preserves multi-line statements
                // and FTS5 virtual table definitions that don't split cleanly on ';'.
                db.exec(sql);
            }
            catch (err) {
                const msg = err.message ?? '';
                // Legacy DBs may already have some columns from the pre-versioning
                // ALTER TABLE fallback. Fall back to per-statement execution so we
                // can tolerate duplicate-column errors without aborting the batch.
                if (!msg.includes('duplicate column'))
                    throw err;
                const statements = sql
                    .split(';')
                    .map((s) => s.trim())
                    .filter((s) => s && !s.startsWith('--'));
                for (const stmt of statements) {
                    try {
                        db.exec(stmt);
                    }
                    catch (innerErr) {
                        const innerMsg = innerErr.message ?? '';
                        if (!innerMsg.includes('duplicate column'))
                            throw innerErr;
                    }
                }
            }
            db.prepare(`INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`).run(name, new Date().toISOString());
        });
        tx();
    }
}
//# sourceMappingURL=migrator.js.map