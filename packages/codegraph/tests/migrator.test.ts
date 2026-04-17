import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations, getAppliedMigrations } from '../src/storage/migrator.js'

describe('migrator', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
  })

  it('applies all migrations on fresh DB and records them', () => {
    runMigrations(db)
    const applied = getAppliedMigrations(db)
    expect(applied).toContain('000_bootstrap')
    expect(applied).toContain('001_session_log_tracking')
    expect(applied).toContain('002_projects_team')
  })

  it('is idempotent — running twice is a no-op', () => {
    runMigrations(db)
    const first = getAppliedMigrations(db)
    runMigrations(db)
    const second = getAppliedMigrations(db)
    expect(first).toEqual(second)
  })

  it('migrates legacy DB with existing tables but no schema_migrations row', () => {
    db.exec(`CREATE TABLE session_log (id TEXT PRIMARY KEY, session_name TEXT NOT NULL, started_at TEXT NOT NULL)`)
    db.exec(`CREATE TABLE projects (name TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)
    runMigrations(db)
    const cols = db.prepare(`PRAGMA table_info(session_log)`).all() as { name: string }[]
    expect(cols.map((c) => c.name)).toContain('work_type')
    expect(cols.map((c) => c.name)).toContain('last_heartbeat')
  })
})
