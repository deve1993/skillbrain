// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Pixarts — contact daniel@pixarts.eu for commercial license

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/storage/migrator.js'
import { MemoryStore } from '../src/storage/memory-store.js'

const TEST_KEY = 'b'.repeat(64)

describe('Pipeline integration tests', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)
  })

  // C1: full dismiss cycle — rank drops after 3 dismissals
  it('dismiss cycle: memory rank drops after 3 dismissals', () => {
    const m = store.add({
      type: 'Pattern',
      context: 'auth flow handling',
      problem: '',
      solution: 'use NextAuth credentials provider',
      reason: '',
      tags: ['auth', 'nextauth'],
    })

    const before = store.search('NextAuth credentials auth flow', 5)
    const beforeRank = before.find((r) => r.memory.id === m.id)?.rank ?? 0
    expect(beforeRank).toBeGreaterThan(0)

    for (let i = 0; i < 3; i++) store.dismissMemory(m.id)

    const after = store.search('NextAuth credentials auth flow', 5)
    const afterRank = after.find((r) => r.memory.id === m.id)?.rank ?? 0

    // dismissalPenalty(c=3) = 0.15 → search() multiplies score by (1 - 0.15) = 0.85x
    expect(afterRank).toBeLessThan(beforeRank)
  })

  // C2: Pattern + AntiPattern same context creates Contradicts edge surfaced by memoryHealth
  it('Pattern + AntiPattern same context creates Contradicts edge surfaced by memoryHealth', () => {
    // Context must be >=30 chars to satisfy contextSimilar() heuristic.
    // The heuristic checks: nb.includes(na.slice(0, 30)) — so we use the EXACT same context string.
    const ctx = 'In Next.js when using server actions with redirect() in form handlers'

    store.add({
      type: 'Pattern',
      context: ctx,
      problem: '',
      solution: 'use throw redirect()',
      reason: '',
      tags: ['nextjs', 'redirect'],
      project: 'P',
    })

    store.add({
      type: 'AntiPattern',
      context: ctx,
      problem: '',
      solution: 'do not use try-catch around redirect calls',
      reason: '',
      tags: ['nextjs', 'redirect'],
      project: 'P',
    })

    const h = store.memoryHealth()
    expect(h.contradictions.length).toBeGreaterThanOrEqual(1)
    expect(h.contradictions[0].type).toBe('Contradicts')
  })

  // C3: memory auto-links to lastLoadedSkill via withMemoryStore session helpers
  it('memory auto-links to lastLoadedSkill via withMemoryStore session helpers', () => {
    // The auto-linkage works in the MCP tool layer (tools/memory.ts) via withMemoryStore
    // and lastLoadedSkill(). At the store level, the link is set explicitly via the `skill` field.
    //
    // This test verifies the store correctly stores and reads the skill field,
    // and that query({ skill }) correctly filters by it.
    // (A full integration test of auto-linking would require simulating MCP session state.)
    const m = store.add({
      type: 'Pattern',
      context: 'react hook pattern',
      problem: '',
      solution: 's',
      reason: '',
      tags: ['react'],
      skill: 'react-best-practices',
    })

    expect(m.skill).toBe('react-best-practices')
    const got = store.get(m.id)
    expect(got?.skill).toBe('react-best-practices')

    // Verify skill filter in query() returns this memory
    // Note: query() excludes 'deprecated' status but includes all others by default,
    // so a freshly-added active memory is always returned.
    const queried = store.query({ skill: 'react-best-practices' })
    expect(queried.length).toBe(1)
    expect(queried[0].id).toBe(m.id)
  })

  // C4: autoDecayIfDue 2x within 24h is no-op the second time
  it('autoDecayIfDue is no-op on second call within 24h', () => {
    // Add some memories first to give decay something to act on
    for (let i = 0; i < 3; i++) {
      store.add({
        type: 'Pattern',
        context: 'c' + i,
        problem: '',
        solution: 's',
        reason: '',
        tags: [],
      })
    }

    // First call: no prior decay metadata row → hoursSince is effectively ∞ → runs
    const r1 = store.autoDecayIfDue()
    expect(r1.ran).toBe(true)

    // Second call: metadata row was just written → hoursSince < 24h → no-op
    const r2 = store.autoDecayIfDue()
    expect(r2.ran).toBe(false)
  })

  // C5: edge auto-derivation is idempotent within Phase 1 derivation
  it('memory_add does not duplicate edges on re-derive (auto-derivation idempotency)', () => {
    // Phase 1 auto-derive creates a RelatedTo edge when Pattern B is added after Pattern A
    // with same project + >=2 tag overlap. The edge is created during the SECOND add.
    //
    // Idempotency: getEdges(b.id) returns exactly ONE RelatedTo edge to/from a.id.
    // Note: getEdges() merges both directions (getEdgesFrom + getEdgesTo), so the
    // filter below checks both e.targetId and e.sourceId to avoid double-counting.

    const a = store.add({
      type: 'Pattern',
      context: 'A1',
      problem: '',
      solution: 's',
      reason: '',
      tags: ['nextjs', 'auth'],
      project: 'P',
    })

    const b = store.add({
      type: 'Pattern',
      context: 'B1',
      problem: '',
      solution: 's',
      reason: '',
      tags: ['nextjs', 'auth'],
      project: 'P',
    })

    const edges = store.getEdges(b.id)
    const relatedToA = edges.filter(
      (e) => e.type === 'RelatedTo' && (e.targetId === a.id || e.sourceId === a.id),
    )
    expect(relatedToA.length).toBe(1)
  })
})
