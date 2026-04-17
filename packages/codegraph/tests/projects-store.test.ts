import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/storage/migrator.js'
import { ProjectsStore } from '../src/storage/projects-store.js'

const TEST_KEY = 'b'.repeat(64)

describe('ProjectsStore.merge', () => {
  let db: Database.Database
  let store: ProjectsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new ProjectsStore(db)
  })

  it('moves sessions from alias to primary and deletes alias', () => {
    const now = new Date().toISOString()
    store.upsert({ name: 'primary' })
    store.upsert({ name: 'alias' })

    db.prepare(`INSERT INTO session_log (id, session_name, started_at, project) VALUES (?, ?, ?, ?)`)
      .run('S-1', 'test', now, 'alias')
    db.prepare(`INSERT INTO session_log (id, session_name, started_at, project) VALUES (?, ?, ?, ?)`)
      .run('S-2', 'test', now, 'alias')

    store.merge('primary', ['alias'])

    const aliasSessions = db.prepare(`SELECT COUNT(*) as n FROM session_log WHERE project = ?`).get('alias') as { n: number }
    const primarySessions = db.prepare(`SELECT COUNT(*) as n FROM session_log WHERE project = ?`).get('primary') as { n: number }
    expect(aliasSessions.n).toBe(0)
    expect(primarySessions.n).toBe(2)
    expect(store.get('alias')).toBeUndefined()
    expect(store.get('primary')).not.toBeUndefined()
  })

  it('moves memories from alias to primary', () => {
    const now = new Date().toISOString()
    store.upsert({ name: 'primary' })
    store.upsert({ name: 'alias' })

    db.prepare(
      `INSERT INTO memories (id, type, context, problem, solution, reason, created_at, updated_at, project)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('M-1', 'Fact', 'c', 'p', 's', 'r', now, now, 'alias')

    store.merge('primary', ['alias'])
    const m = db.prepare(`SELECT project FROM memories WHERE id = ?`).get('M-1') as { project: string }
    expect(m.project).toBe('primary')
  })

  it('moves encrypted env vars from alias to primary (no decrypt needed)', () => {
    store.upsert({ name: 'primary' })
    store.upsert({ name: 'alias' })

    store.setEnv('alias', 'API_KEY', 'secret-value')
    store.merge('primary', ['alias'])

    const val = store.getEnv('primary', 'API_KEY')
    expect(val).toBe('secret-value')
    expect(store.getEnv('alias', 'API_KEY')).toBeUndefined()
  })

  it('throws when primary does not exist', () => {
    store.upsert({ name: 'alias' })
    expect(() => store.merge('nonexistent', ['alias'])).toThrow()
  })
})
