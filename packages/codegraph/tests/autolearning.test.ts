import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@skillbrain/storage'
import { MemoryStore } from '@skillbrain/storage'
import { SkillsStore } from '@skillbrain/storage'

const TEST_KEY = 'b'.repeat(64)

describe('MemoryStore suggest personalization', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)
  })

  it('logSuggestOutcome stores accepted/rejected per type', () => {
    store.logSuggestOutcome('BugFix', true, 'project-a')
    store.logSuggestOutcome('BugFix', true, 'project-a')
    store.logSuggestOutcome('Fact', false, 'project-a')
    store.logSuggestOutcome('Fact', false, 'project-a')
    store.logSuggestOutcome('Fact', false, 'project-a')

    const prefs = store.suggestPreferences()
    expect(prefs.BugFix.accepted).toBe(2)
    expect(prefs.BugFix.total).toBe(2)
    expect(prefs.Fact.accepted).toBe(0)
    expect(prefs.Fact.total).toBe(3)
  })

  it('suggestPreferences returns acceptance rate per type', () => {
    store.logSuggestOutcome('Pattern', true)
    store.logSuggestOutcome('Pattern', true)
    store.logSuggestOutcome('Pattern', false)

    const prefs = store.suggestPreferences()
    expect(prefs.Pattern.rate).toBeCloseTo(0.667, 1)
  })
})

describe('Auto-linkage skill <-> memory', () => {
  let db: Database.Database
  let skillStore: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    skillStore = new SkillsStore(db)

    const now = new Date().toISOString()
    skillStore.upsert({
      name: 'nextjs', category: 'Frontend', description: 'Next.js guide',
      content: '', type: 'domain', tags: ['nextjs'], lines: 100, updatedAt: now,
    })
  })

  it('lastLoadedSkill returns the most recently loaded skill for a session', () => {
    skillStore.recordUsage('nextjs', 'loaded', { sessionId: 'sess-1' })

    const last = skillStore.lastLoadedSkill('sess-1')
    expect(last).toBe('nextjs')
  })

  it('lastLoadedSkill returns null when no skills loaded in session', () => {
    const last = skillStore.lastLoadedSkill('sess-unknown')
    expect(last).toBeNull()
  })
})

describe('Suggest outcome tracking', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)
  })

  it('logSuggestOutcome creates entries that suggestPreferences reads', () => {
    store.logSuggestOutcome('BugFix', true, 'proj')
    store.logSuggestOutcome('BugFix', true, 'proj')
    store.logSuggestOutcome('Fact', false, 'proj')

    const prefs = store.suggestPreferences()
    expect(prefs.BugFix.rate).toBe(1.0)
    expect(prefs.Fact.rate).toBe(0.0)
  })
})

describe('Full learning cycle integration', () => {
  let db: Database.Database
  let skillStore: SkillsStore
  let memStore: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    skillStore = new SkillsStore(db)
    memStore = new MemoryStore(db)

    const now = new Date().toISOString()
    skillStore.upsert({
      name: 'nextjs', category: 'Frontend', description: 'Next.js App Router guide',
      content: 'Full Next.js 15 guide with RSC, Server Actions, streaming',
      type: 'domain', tags: ['nextjs', 'react'], lines: 163, updatedAt: now,
    })
    skillStore.upsert({
      name: 'tailwind', category: 'Frontend', description: 'Tailwind CSS styling',
      content: 'Tailwind CSS utility classes and configuration',
      type: 'domain', tags: ['tailwind', 'css'], lines: 68, updatedAt: now,
    })
  })

  it('full cycle: route -> load -> memory_add (auto-linked) -> decay -> improved retrieval', () => {
    // 1. Route: find best skill for task
    const routed = skillStore.route('build nextjs page with server components', 3)
    expect(routed[0].name).toBe('nextjs')

    // 2. Load: record usage
    skillStore.recordUsage('nextjs', 'loaded', { sessionId: 'session-1' })
    skillStore.recordUsage('nextjs', 'applied', { sessionId: 'session-1' })

    // 3. Auto-link: lastLoadedSkill returns the loaded skill
    const linked = skillStore.lastLoadedSkill('session-1')
    expect(linked).toBe('nextjs')

    // 4. Add memory with auto-linked skill
    const mem = memStore.add({
      type: 'BugFix',
      context: 'In Next.js 15, when using Server Actions',
      problem: 'Cookie access fails silently',
      solution: 'Use headers() to explicitly pass cookies to Server Actions',
      reason: 'Different execution context for RSC vs Server Actions',
      tags: ['nextjs', 'server-actions'],
      skill: linked!,
      project: 'test-project',
      scope: 'project',
    })

    expect(mem.skill).toBe('nextjs')

    // 5. Decay: reinforce nextjs (it was useful)
    skillStore.applyDecay(['nextjs'])

    // 6. Verify scored() boosts memory with matching skill
    const scored = memStore.scored('test-project', ['nextjs'], 5)
    expect(scored.length).toBe(1)
    expect(scored[0].memory.skill).toBe('nextjs')
    // Score should include skill match bonus (+2)
    expect(scored[0].rank).toBeGreaterThan(10)

    // 7. Dedup: try adding same memory again
    const dupe = memStore.findDuplicate({
      type: 'BugFix',
      context: 'In Next.js when using server actions for cookies',
      problem: 'Cookie reading fails',
      solution: 'Pass cookies via headers() explicitly to server actions instead of request context',
      reason: 'Execution context differs',
      tags: ['nextjs'],
    })
    expect(dupe).toBeDefined()
    expect(dupe!.id).toBe(mem.id)
  })
})
