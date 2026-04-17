import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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

  it('tolerates duplicate-column errors when replaying ALTER migrations on upgraded DB', () => {
    // Start with a DB that has the 001/002 columns but no schema_migrations row for 001/002
    db.exec(`CREATE TABLE session_log (
      id TEXT PRIMARY KEY,
      session_name TEXT NOT NULL,
      started_at TEXT NOT NULL,
      work_type TEXT,
      deliverables TEXT,
      last_heartbeat TEXT
    )`)
    db.exec(`CREATE TABLE projects (
      name TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      team_lead TEXT,
      team_members TEXT DEFAULT '[]'
    )`)

    // Must not throw even though ALTERs would fail with "duplicate column"
    expect(() => runMigrations(db)).not.toThrow()

    const applied = getAppliedMigrations(db)
    expect(applied).toContain('001_session_log_tracking')
    expect(applied).toContain('002_projects_team')
  })

  it('rolls back transaction on invalid SQL and does not record migration', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'migrator-test-'))
    try {
      // Valid first migration
      fs.writeFileSync(path.join(tmp, '000_good.sql'), `CREATE TABLE good (id INTEGER PRIMARY KEY);`)
      // Broken second migration — nonexistent column reference, fails mid-transaction
      fs.writeFileSync(path.join(tmp, '001_bad.sql'), `CREATE TABLE bad (id INTEGER PRIMARY KEY); INSERT INTO no_such_table VALUES (1);`)

      expect(() => runMigrations(db, tmp)).toThrow()

      const applied = getAppliedMigrations(db)
      expect(applied).toContain('000_good')
      expect(applied).not.toContain('001_bad')

      // Verify `bad` table was NOT created (transaction rolled back)
      const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='bad'`).get()
      expect(row).toBeUndefined()
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
})
