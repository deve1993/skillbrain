import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/storage/migrator.js'
import { SkillsStore } from '../src/storage/skills-store.js'

const TEST_KEY = 'b'.repeat(64)

describe('SkillsStore.recordUsage and aggregate queries', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    // Seed a couple of skills so deadSkills has something to compare against
    const now = new Date().toISOString()
    store.upsert({
      name: 'alpha', category: 'frontend', description: 'a', content: '',
      type: 'domain', tags: [], lines: 0, updatedAt: now,
    })
    store.upsert({
      name: 'beta', category: 'frontend', description: 'b', content: '',
      type: 'domain', tags: [], lines: 0, updatedAt: now,
    })
  })

  it('migration 015 created skill_usage with the expected columns', () => {
    const cols = db.prepare(`PRAGMA table_info(skill_usage)`).all() as { name: string }[]
    const names = cols.map((c) => c.name).sort()
    expect(names).toEqual([
      'action', 'id', 'project', 'session_id', 'skill_name', 'task_description', 'ts', 'useful', 'user_id',
    ])
  })

  it('records routed/loaded/applied actions and counts them', () => {
    store.recordUsage('alpha', 'routed', { sessionId: 's1', project: 'p', task: 't' })
    store.recordUsage('alpha', 'loaded', { sessionId: 's1', project: 'p', task: 't' })
    store.recordUsage('beta',  'routed', { sessionId: 's1', project: 'p' })

    const total = store.totalUsageSince(24)
    expect(total).toBe(3)

    const routed = store.topRouted(24, 10)
    expect(routed.length).toBe(2)
    expect(routed.find((r) => r.skillName === 'alpha')?.count).toBe(1)
    expect(routed.find((r) => r.skillName === 'beta')?.count).toBe(1)

    const loaded = store.topLoaded(24, 10)
    expect(loaded.length).toBe(1)
    expect(loaded[0].skillName).toBe('alpha')
  })

  it('dedupes same (name, action, sessionId) within 1 second window', () => {
    store.recordUsage('alpha', 'loaded', { sessionId: 's1' })
    store.recordUsage('alpha', 'loaded', { sessionId: 's1' })  // dedup'd
    store.recordUsage('alpha', 'loaded', { sessionId: 's2' })  // different session, kept

    const loaded = store.topLoaded(24, 10)
    expect(loaded[0].skillName).toBe('alpha')
    expect(loaded[0].count).toBe(2)
  })

  it('deadSkills returns active skills routed but never loaded', () => {
    store.recordUsage('alpha', 'routed', { sessionId: 's1' })
    store.recordUsage('alpha', 'routed', { sessionId: 's2' })
    store.recordUsage('beta',  'routed', { sessionId: 's1' })
    store.recordUsage('beta',  'loaded', { sessionId: 's1' })

    const dead = store.deadSkills(7, 10)
    const names = dead.map((d) => d.skillName)
    expect(names).toContain('alpha')
    expect(names).not.toContain('beta')
  })

  it('lastUsedMap contains last load/apply timestamp per skill', () => {
    store.recordUsage('alpha', 'loaded', { sessionId: 's1' })
    store.recordUsage('alpha', 'applied', { sessionId: 's2' })
    store.recordUsage('beta',  'routed', { sessionId: 's1' })  // routed should not appear

    const map = store.lastUsedMap()
    expect(map.has('alpha')).toBe(true)
    expect(map.has('beta')).toBe(false)
  })

  it('ignores empty skill name without throwing', () => {
    expect(() => store.recordUsage('', 'loaded')).not.toThrow()
    expect(store.totalUsageSince(24)).toBe(0)
  })
})
