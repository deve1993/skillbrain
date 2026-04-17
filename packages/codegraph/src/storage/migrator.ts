import type Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

const SCHEMA_MIGRATIONS_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`

function listMigrations(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return []
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

export function getAppliedMigrations(db: Database.Database): string[] {
  db.exec(SCHEMA_MIGRATIONS_SQL)
  const rows = db
    .prepare(`SELECT name FROM schema_migrations ORDER BY name`)
    .all() as { name: string }[]
  return rows.map((r) => r.name)
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(name)
  return !!row
}

export function runMigrations(db: Database.Database): void {
  db.exec(SCHEMA_MIGRATIONS_SQL)
  const applied = new Set(getAppliedMigrations(db))
  const files = listMigrations()

  for (const file of files) {
    const name = file.replace(/\.sql$/, '')
    if (applied.has(name)) continue

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')

    // Legacy DB support: if bootstrap and core tables already exist
    // (DB created before versioning existed), skip re-running CREATEs
    // but record the row so later migrations run normally.
    if (
      name === '000_bootstrap' &&
      tableExists(db, 'session_log') &&
      tableExists(db, 'projects')
    ) {
      db.prepare(
        `INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`
      ).run(name, new Date().toISOString())
      continue
    }

    const tx = db.transaction(() => {
      try {
        // Execute the whole file as one batch — preserves multi-line statements
        // and FTS5 virtual table definitions that don't split cleanly on ';'.
        db.exec(sql)
      } catch (err) {
        const msg = (err as Error).message ?? ''
        // Legacy DBs may already have some columns from the pre-versioning
        // ALTER TABLE fallback. Fall back to per-statement execution so we
        // can tolerate duplicate-column errors without aborting the batch.
        if (!msg.includes('duplicate column')) throw err
        const statements = sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith('--'))
        for (const stmt of statements) {
          try {
            db.exec(stmt)
          } catch (innerErr) {
            const innerMsg = (innerErr as Error).message ?? ''
            if (!innerMsg.includes('duplicate column')) throw innerErr
          }
        }
      }
      db.prepare(
        `INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`
      ).run(name, new Date().toISOString())
    })
    tx()
  }
}
