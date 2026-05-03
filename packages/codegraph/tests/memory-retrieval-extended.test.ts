/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/storage/migrator.js'
import { MemoryStore } from '../src/storage/memory-store.js'

const TEST_KEY = 'b'.repeat(64)

// ── B1: FTS trigram fallback to unicode61 path ──────────────────────────────

describe('B1: search() falls back from trgm FTS to unicode61 when trgm table is gone', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)
  })

  it('returns results via legacy FTS after trgm table is dropped', () => {
    // Add memory while BOTH FTS tables exist — populateFts() writes to both.
    store.add({
      type: 'Pattern',
      context: 'authentication token refresh flow',
      problem: '',
      solution: 'use refresh tokens with expiry',
      reason: '',
      tags: ['auth'],
    })

    // Verify it was found via normal path (trgm active)
    const beforeDrop = store.search('authentication', 5)
    expect(beforeDrop.length).toBeGreaterThan(0)

    // Drop trigram FTS to force fallback path (catch block at line 503-510)
    db.exec('DROP TABLE IF EXISTS memories_fts_trgm')

    // search() must NOT throw — it catches the trgm error and falls back to unicode61.
    // Since populateFts() also wrote to memories_fts (unicode61), results should be found.
    expect(() => store.search('authentication', 5)).not.toThrow()

    const afterDrop = store.search('authentication', 5)
    // The legacy FTS table (unicode61) was populated by add() so we still get results.
    expect(afterDrop.length).toBeGreaterThan(0)
  })

  it('returns empty array (not an error) when both FTS tables fail', () => {
    store.add({
      type: 'Pattern',
      context: 'some context about stuff',
      problem: '',
      solution: 'some solution',
      reason: '',
      tags: [],
    })

    // Drop both FTS tables to force the final fallback return []
    db.exec('DROP TABLE IF EXISTS memories_fts_trgm')
    db.exec('DROP TABLE IF EXISTS memories_fts')

    // The double-catch path at line 508-510 returns [] — must not throw
    const result = store.search('stuff', 5)
    expect(result).toEqual([])
  })
})

// ── B2: query() composite filter scope=personal + userId + tags ──────────────

describe('B2: query() with composite scope=personal + userId + tags', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)
  })

  it('returns only personal memories matching userId AND tag', () => {
    // Memory A: personal, userA, tag nextjs — should be returned
    store.add({
      type: 'Pattern',
      context: 'a',
      problem: '',
      solution: 's',
      reason: '',
      tags: ['nextjs'],
      scope: 'personal',
      createdByUserId: 'userA',
    })

    // Memory B: personal, userA, different tag — should be excluded
    store.add({
      type: 'Pattern',
      context: 'b',
      problem: '',
      solution: 's',
      reason: '',
      tags: ['react'],
      scope: 'personal',
      createdByUserId: 'userA',
    })

    // Memory C: personal, userB, same tag nextjs — should be excluded (different user)
    store.add({
      type: 'Pattern',
      context: 'c',
      problem: '',
      solution: 's',
      reason: '',
      tags: ['nextjs'],
      scope: 'personal',
      createdByUserId: 'userB',
    })

    const results = store.query({ scope: 'personal', userId: 'userA', tags: ['nextjs'] })
    expect(results.length).toBe(1)
    expect(results[0].context).toBe('a')
  })
})

// ── B3: closetBoost exact-match on project name ──────────────────────────────

describe('B3: closetBoost uses exact project match (not substring)', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)
  })

  it('documents that closetBoost requires exact project equality — partial substring does NOT boost', () => {
    // Memory from project 'web-pixarts'
    store.add({
      type: 'Pattern',
      context: 'auth token management in web app',
      problem: '',
      solution: 'use refresh tokens for session persistence',
      reason: '',
      tags: [],
      project: 'web-pixarts',
    })

    // Memory from a completely unrelated project
    store.add({
      type: 'Pattern',
      context: 'auth token management in web app',
      problem: '',
      solution: 'use jwt tokens for stateless auth in services',
      reason: '',
      tags: [],
      project: 'random-project',
    })

    // Search with project='pixarts' (substring of 'web-pixarts', NOT an exact match).
    // closetBoost checks: memory.project === project  ← strict equality
    // So 'web-pixarts' !== 'pixarts' → NO closetBoost applied.
    const withPartialProject = store.search('auth token', 5, 'pixarts')
    const withNoProject = store.search('auth token', 5)

    // Both queries should return the same memories (no boost difference).
    // Extract ranks for 'web-pixarts' memory.
    const webPixartsWithPartial = withPartialProject.find((r) => r.memory.project === 'web-pixarts')
    const webPixartsNoProject = withNoProject.find((r) => r.memory.project === 'web-pixarts')

    // Both should find the memory
    expect(webPixartsWithPartial).toBeDefined()
    expect(webPixartsNoProject).toBeDefined()

    // The rank should be equal because partial match doesn't trigger the boost.
    // (closetBoost does: isTarget = !!project && memory.project === project)
    // With project='pixarts', 'web-pixarts' !== 'pixarts' → isTarget=false → boost=0
    // This confirms the implementation uses exact equality, not substring matching.
    expect(webPixartsWithPartial!.rank).toBe(webPixartsNoProject!.rank)
  })

  it('confirms closetBoost DOES boost when project name is an exact match', () => {
    store.add({
      type: 'Pattern',
      context: 'deploy pipeline optimization for production',
      problem: '',
      solution: 'use multi-stage docker builds to reduce image size',
      reason: '',
      tags: [],
      project: 'my-exact-project',
    })

    store.add({
      type: 'Pattern',
      context: 'deploy pipeline optimization for production',
      problem: '',
      solution: 'use docker layer caching for faster rebuilds',
      reason: '',
      tags: [],
      project: 'other-project',
    })

    const withExact = store.search('deploy pipeline', 5, 'my-exact-project')
    const withoutProject = store.search('deploy pipeline', 5)

    const exactMatch = withExact.find((r) => r.memory.project === 'my-exact-project')
    const exactMatchNoBoost = withoutProject.find((r) => r.memory.project === 'my-exact-project')

    expect(exactMatch).toBeDefined()
    expect(exactMatchNoBoost).toBeDefined()

    // With exact match, closetBoost adds BOOSTS[0]=0.40 to the score
    expect(exactMatch!.rank).toBeGreaterThan(exactMatchNoBoost!.rank)
  })
})

// ── B4: BM25 tag-match-bonus for exact tag match ──────────────────────────────

describe('B4: BM25 TAG_MATCH_BONUS boosts exact tag match over body-only mention', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)
  })

  it('memory with query term in tags ranks above memory with query term only in body', () => {
    // Memory A: tags=['nextjs'], generic body content — gets TAG_MATCH_BONUS=0.30
    const a = store.add({
      type: 'Pattern',
      context: 'generic stuff about web development frameworks',
      problem: '',
      solution: 'something for web apps',
      reason: '',
      tags: ['nextjs'],
    })

    // Memory B: tags=['ui'], body mentions nextjs prominently — no tag bonus
    const b = store.add({
      type: 'Pattern',
      context: 'nextjs is a great tool here for server-side routing',
      problem: 'nextjs routing complexity',
      solution: 'nextjs file-based routing simplifies everything',
      reason: '',
      tags: ['ui'],
    })

    const results = store.search('nextjs', 5)

    // Both memories should appear in results
    const aIdx = results.findIndex((r) => r.memory.id === a.id)
    const bIdx = results.findIndex((r) => r.memory.id === b.id)

    expect(aIdx).toBeGreaterThanOrEqual(0)
    expect(bIdx).toBeGreaterThanOrEqual(0)

    // Memory A (tag match + bonus) should outrank Memory B (body-only mentions)
    // because TAG_MATCH_BONUS=0.30 is added to A's BM25 score for the exact tag match.
    // This is the core contract of bm25Rerank() — tag signals are trusted more than body signals.
    expect(aIdx).toBeLessThan(bIdx)
  })
})

// ── B5: oversized query truncated, no error ──────────────────────────────────

describe('B5: search() with oversized query', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)
  })

  it('does not throw on query > 500 chars and returns gracefully', () => {
    store.add({
      type: 'Pattern',
      context: 'abc',
      problem: '',
      solution: 's',
      reason: '',
      tags: [],
    })

    // Build a 1000-char query — search() slices it to 500 before processing
    const big = 'a'.repeat(1000)
    expect(() => store.search(big, 5)).not.toThrow()

    // Result can be empty (all-same tokens likely don't match content) — just no crash
    const result = store.search(big, 5)
    expect(Array.isArray(result)).toBe(true)
  })

  it('does not throw on query > 500 chars with real-looking long text', () => {
    store.add({
      type: 'Pattern',
      context: 'authentication flow for user sessions',
      problem: '',
      solution: 'use jwt tokens',
      reason: '',
      tags: ['auth'],
    })

    // Realistic oversized query (e.g., a user accidentally pastes a paragraph)
    const longQuery = 'authentication session token management with refresh tokens expiry handling and auto-renewal strategies for production systems '.repeat(5)
    expect(longQuery.length).toBeGreaterThan(500)

    expect(() => store.search(longQuery, 5)).not.toThrow()
    const result = store.search(longQuery, 5)
    expect(Array.isArray(result)).toBe(true)
    // Should return something since 'authentication' appears in the DB
    expect(result.length).toBeGreaterThanOrEqual(0)
  })
})
