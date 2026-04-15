import Database from 'better-sqlite3'
import { SCHEMA_SQL, FTS_SCHEMA_SQL, FTS_TRIGGERS_SQL } from './schema.js'
import { MEMORY_SCHEMA_SQL, MEMORY_FTS_SQL, SESSION_LOG_SQL, SESSION_LOG_MIGRATE_SQL, NOTIFICATIONS_SQL, SKILLS_SCHEMA_SQL, SKILLS_FTS_SQL } from './memory-schema.js'
import path from 'node:path'
import fs from 'node:fs'

const DB_FILENAME = 'graph.db'
const CODEGRAPH_DIR = '.codegraph'

export function getDbPath(repoPath: string): string {
  return path.join(repoPath, CODEGRAPH_DIR, DB_FILENAME)
}

export function getCodegraphDir(repoPath: string): string {
  return path.join(repoPath, CODEGRAPH_DIR)
}

export function openDb(repoPath: string): Database.Database {
  const dir = getCodegraphDir(repoPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const dbPath = getDbPath(repoPath)
  const db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  db.exec(SCHEMA_SQL)
  db.exec(FTS_SCHEMA_SQL)
  db.exec(FTS_TRIGGERS_SQL)
  db.exec(MEMORY_SCHEMA_SQL)
  db.exec(MEMORY_FTS_SQL)
  db.exec(SESSION_LOG_SQL)
  // Safe migration: add new columns (silently ignores if they already exist)
  for (const stmt of SESSION_LOG_MIGRATE_SQL.split(';').filter(s => s.trim())) {
    try { db.exec(stmt) } catch { /* column already exists */ }
  }
  db.exec(NOTIFICATIONS_SQL)
  db.exec(SKILLS_SCHEMA_SQL)
  db.exec(SKILLS_FTS_SQL)

  return db
}

export function clearDb(db: Database.Database): void {
  db.exec(`
    DELETE FROM edges;
    DELETE FROM nodes;
    DELETE FROM files;
  `)
}

export function closeDb(db: Database.Database): void {
  db.close()
}
