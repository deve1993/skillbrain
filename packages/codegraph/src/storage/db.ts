import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { runMigrations } from './migrator.js'

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

  runMigrations(db)

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
