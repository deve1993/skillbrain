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

  it('preserves primary pre-existing env vars during merge (catches INSERT OR REPLACE cascade bug)', () => {
    store.upsert({ name: 'primary' })
    store.upsert({ name: 'alias' })

    // Primary already has its own env vars
    store.setEnv('primary', 'EXISTING_KEY', 'primary-value')
    store.setEnv('primary', 'SHARED_KEY', 'primary-shared')

    // Alias has its own and a colliding one
    store.setEnv('alias', 'ALIAS_KEY', 'alias-value')
    store.setEnv('alias', 'SHARED_KEY', 'alias-shared')

    store.merge('primary', ['alias'])

    // All primary pre-existing env vars survive
    expect(store.getEnv('primary', 'EXISTING_KEY')).toBe('primary-value')
    // Alias's unique env var moved
    expect(store.getEnv('primary', 'ALIAS_KEY')).toBe('alias-value')
    // Collision resolves to alias's value (UPDATE OR REPLACE semantics — document behavior)
    expect(store.getEnv('primary', 'SHARED_KEY')).toBe('alias-shared')

    // Alias is gone
    expect(store.get('alias')).toBeUndefined()
  })
})

describe('ProjectsStore.sanitizeNotes', () => {
  it('redacts notes containing API key patterns', () => {
    expect(ProjectsStore.sanitizeNotes('sk-ant-api03-XXXXXXXXXXXXXXXXXXXXXXXX'))
      .toBe('[REDACTED — contains secrets]')
  })

  it('redacts notes containing JWT tokens', () => {
    expect(ProjectsStore.sanitizeNotes('token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx'))
      .toBe('[REDACTED — contains secrets]')
  })

  it('redacts notes with KEY=value patterns', () => {
    const cases = [
      'ANTHROPIC_API_KEY=sk-ant-xxx',
      'SMTP_PASS = mypassword123',
      'JWT_SECRET=super-secret-key',
      'API_KEY=abc123',
      'PASSWORD=hunter2',
    ]
    for (const note of cases) {
      expect(ProjectsStore.sanitizeNotes(note)).toBe('[REDACTED — contains secrets]')
    }
  })

  it('passes through safe notes unchanged', () => {
    expect(ProjectsStore.sanitizeNotes('This is a normal project note')).toBe('This is a normal project note')
    expect(ProjectsStore.sanitizeNotes('Build failed on CI, needs debugging')).toBe('Build failed on CI, needs debugging')
  })

  it('returns undefined/empty for empty input', () => {
    expect(ProjectsStore.sanitizeNotes(undefined)).toBeUndefined()
    expect(ProjectsStore.sanitizeNotes('')).toBe('')
  })
})

describe('ProjectsStore.listSanitized / getSanitized', () => {
  let db: Database.Database
  let store: ProjectsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new ProjectsStore(db)
  })

  it('listSanitized redacts notes with secrets', () => {
    store.upsert({ name: 'safe-proj', notes: 'Normal notes' })
    store.upsert({ name: 'leaked-proj', notes: 'ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx' })

    const projects = store.listSanitized()
    const safe = projects.find((p) => p.name === 'safe-proj')
    const leaked = projects.find((p) => p.name === 'leaked-proj')

    expect(safe?.notes).toBe('Normal notes')
    expect(leaked?.notes).toBe('[REDACTED — contains secrets]')
  })

  it('getSanitized redacts notes with secrets', () => {
    store.upsert({ name: 'secret-proj', notes: 'JWT_SECRET=my-secret-value' })

    const project = store.getSanitized('secret-proj')
    expect(project?.notes).toBe('[REDACTED — contains secrets]')
  })

  it('getSanitized returns undefined for nonexistent project', () => {
    expect(store.getSanitized('nonexistent')).toBeUndefined()
  })
})
