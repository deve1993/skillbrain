import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/storage/migrator.js'
import { MemoryStore } from '../src/storage/memory-store.js'

const TEST_KEY = 'b'.repeat(64)

describe('MemoryStore.search() cluster boost', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)

    // Memory from project-a (same stack as our target project-b)
    store.add({
      type: 'Pattern', context: 'In Next.js App Router, when building server components',
      problem: 'Data fetching fails silently', solution: 'Use async components with error boundaries for reliable data fetching',
      reason: 'RSC errors are swallowed', tags: ['nextjs', 'rsc'],
      project: 'project-a', scope: 'project',
    })

    // Memory from unrelated project
    store.add({
      type: 'Pattern', context: 'In React Native Expo, when building mobile apps',
      problem: 'Navigation stack issues', solution: 'Use expo-router for file-based mobile routing',
      reason: 'Consistent with web patterns', tags: ['react-native', 'expo'],
      project: 'mobile-app', scope: 'project',
    })
  })

  it('memories from sibling projects (same skill tags) get a reduced closet boost', () => {
    // Search from project-b which also uses nextjs
    const results = store.search('server components data fetching', 10, 'project-b', ['nextjs'])
    // The project-a memory should appear (it shares skill context)
    const projectAMemory = results.find((r) => r.memory.project === 'project-a')
    expect(projectAMemory).toBeDefined()
    expect(projectAMemory!.rank).toBeGreaterThan(0)
  })
})

describe('MemoryStore.search() tag bonus', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)

    // Memory with exact tag match
    store.add({
      type: 'BugFix', context: 'In a web application framework',
      problem: 'Build fails on deploy', solution: 'Clear the build cache and rebuild',
      reason: 'Stale cache causes conflicts', tags: ['nextjs', 'deploy'],
      scope: 'global',
    })

    // Memory that mentions nextjs in content but not in tags
    store.add({
      type: 'BugFix', context: 'In nextjs app router when building pages',
      problem: 'Build fails on deploy', solution: 'Clear the build cache and rebuild from scratch',
      reason: 'Stale nextjs cache causes conflicts', tags: ['build', 'deploy'],
      scope: 'global',
    })
  })

  it('memories with exact tag match rank higher than content-only match', () => {
    const results = store.search('nextjs deploy issue', 5)
    expect(results.length).toBe(2)
    // The one with tag 'nextjs' should rank first
    expect(results[0].memory.tags).toContain('nextjs')
  })
})

describe('MemoryStore.scored() type weights', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)

    // Same confidence, importance, scope — only type differs
    const base = {
      context: 'In Next.js when building apps',
      problem: 'Something happens', solution: 'Do something about it',
      reason: 'Because reasons', tags: ['nextjs'],
      confidence: 5, importance: 5, scope: 'global' as const,
    }

    store.add({ ...base, type: 'Fact' })
    store.add({ ...base, type: 'BugFix' })
    store.add({ ...base, type: 'AntiPattern' })
    store.add({ ...base, type: 'Goal' })
  })

  it('BugFix and AntiPattern rank higher than Fact and Goal at equal confidence', () => {
    const results = store.scored(undefined, undefined, 10)
    const types = results.map((r) => r.memory.type)

    const bugfixIdx = types.indexOf('BugFix')
    const antiIdx = types.indexOf('AntiPattern')
    const factIdx = types.indexOf('Fact')
    const goalIdx = types.indexOf('Goal')

    expect(bugfixIdx).toBeLessThan(factIdx)
    expect(antiIdx).toBeLessThan(goalIdx)
  })
})

describe('MemoryStore.findDuplicate()', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)

    store.add({
      type: 'BugFix',
      context: 'In Next.js App Router, when using Server Actions with cookies',
      problem: 'Cookies are not accessible in Server Actions',
      solution: 'Use headers() to pass cookies explicitly to Server Actions instead of relying on request context',
      reason: 'Server Actions run in a different execution context than RSCs',
      tags: ['nextjs', 'server-actions', 'cookies'],
      scope: 'global',
    })
  })

  it('detects near-duplicate by solution similarity', () => {
    const dupe = store.findDuplicate({
      type: 'BugFix',
      context: 'In Next.js when working with Server Actions and cookie access',
      problem: 'Cannot read cookies in server action',
      solution: 'Pass cookies via headers() explicitly instead of using request context in Server Actions',
      reason: 'Different execution context',
      tags: ['nextjs', 'server-actions'],
    })

    expect(dupe).toBeDefined()
    expect(dupe!.type).toBe('BugFix')
  })

  it('returns null for genuinely different memories', () => {
    const dupe = store.findDuplicate({
      type: 'Pattern',
      context: 'In PostgreSQL when optimizing queries',
      problem: 'Slow query on large table',
      solution: 'Add partial index on frequently filtered column with WHERE clause',
      reason: 'Partial indexes are smaller and faster to scan',
      tags: ['postgres', 'performance'],
    })

    expect(dupe).toBeNull()
  })
})

describe('session lifecycle', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)
  })

  const getSession = (id: string) => {
    const row = db.prepare('SELECT * FROM session_log WHERE id = ?').get(id) as any
    return row ?? undefined
  }

  it('starts and ends a session with full lifecycle', () => {
    const session = store.startSession('test-session', 'my-project', undefined, 'build feature')
    expect(session.id).toBeDefined()
    expect(session.status).toBe('in-progress')
    expect(session.project).toBe('my-project')

    store.endSession(session.id, 'Built the feature', 2, 1, ['src/a.ts'], 'Deploy next')
    const ended = getSession(session.id)
    expect(ended?.status).toBe('completed')
    expect(ended?.summary).toBe('Built the feature')
    expect(ended?.memories_created).toBe(2)
  })

  it('auto-closes stale in-progress sessions', () => {
    const session = store.startSession('stale-session', 'proj')
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    db.prepare('UPDATE session_log SET started_at = ?, last_heartbeat = NULL WHERE id = ?')
      .run(past, session.id)

    const closed = store.autoCloseStale(30)
    expect(closed).toBe(1)

    const updated = getSession(session.id)
    expect(updated?.status).toBe('paused')
  })

  it('cleanupOrphanedSessions deletes old paused sessions with no memories', () => {
    const session = store.startSession('orphan', 'proj')
    const past = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    db.prepare(`UPDATE session_log SET status = 'paused', ended_at = ?, summary = NULL, memories_created = 0 WHERE id = ?`)
      .run(past, session.id)

    const deleted = store.cleanupOrphanedSessions(7)
    expect(deleted).toBe(1)
    expect(getSession(session.id)).toBeUndefined()
  })

  it('cleanupOrphanedSessions preserves sessions with memories', () => {
    const session = store.startSession('useful', 'proj')
    const past = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    db.prepare(`UPDATE session_log SET status = 'paused', ended_at = ?, summary = NULL, memories_created = 3 WHERE id = ?`)
      .run(past, session.id)

    const deleted = store.cleanupOrphanedSessions(7)
    expect(deleted).toBe(0)
    expect(getSession(session.id)).toBeDefined()
  })
})

describe('memory CRUD', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)
  })

  it('updates memory fields and syncs FTS', () => {
    const mem = store.add({
      type: 'BugFix', context: 'original context',
      problem: 'original problem', solution: 'original solution',
      reason: 'original reason', tags: ['tag1'],
      scope: 'global',
    })

    store.updateMemory(mem.id, { solution: 'updated solution', tags: ['tag1', 'tag2'] })
    const updated = store.get(mem.id)
    expect(updated?.solution).toBe('updated solution')
    expect(updated?.tags).toContain('tag2')

    const results = store.search('updated solution', 5)
    expect(results.some((r) => r.memory.id === mem.id)).toBe(true)
  })

  it('deletes memory', () => {
    const mem = store.add({
      type: 'Fact', context: 'ctx', problem: 'p',
      solution: 's', reason: 'r', tags: [], scope: 'global',
    })

    store.delete(mem.id)
    expect(store.get(mem.id)).toBeUndefined()
  })

  it('manages edges between memories', () => {
    const m1 = store.add({
      type: 'Fact', context: 'c1', problem: 'p1',
      solution: 's1', reason: 'r1', tags: [], scope: 'global',
    })
    const m2 = store.add({
      type: 'Fact', context: 'c2', problem: 'p2',
      solution: 's2', reason: 'r2', tags: [], scope: 'global',
    })

    store.addEdge(m1.id, m2.id, 'RelatedTo')
    const edges = store.getEdges(m1.id)
    expect(edges.length).toBe(1)
    expect(edges[0].targetId).toBe(m2.id)
    expect(edges[0].type).toBe('RelatedTo')
  })
})
