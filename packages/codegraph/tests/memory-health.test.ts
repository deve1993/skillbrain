/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb } from '@skillbrain/storage'
import { runMigrations } from '@skillbrain/storage'
import { MemoryStore } from '@skillbrain/storage'

describe('MemoryStore.memoryHealth', () => {
  let dir: string, db: any, store: MemoryStore
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-mh-'))
    db = openDb(dir); runMigrations(db); store = new MemoryStore(db)
  })
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('returns counts by status', () => {
    store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [] })
    store.add({ type: 'Pattern', context: 'b', problem: '', solution: 's', reason: '', tags: [] })
    const h = store.memoryHealth()
    expect(h.totals.active).toBe(2)
    expect(h.totals.deprecated ?? 0).toBe(0)
  })

  it('lists at-risk memories (low confidence + stale)', () => {
    const m = store.add({ type: 'Pattern', context: 'r', problem: '', solution: 's', reason: '', tags: [], confidence: 2 })
    db.prepare("UPDATE memories SET sessions_since_validation = 10 WHERE id = ?").run(m.id)
    const h = store.memoryHealth()
    expect(h.atRisk.find((x: any) => x.id === m.id)).toBeDefined()
  })

  it('lists Contradicts edges as contradictions', () => {
    const longContext = 'In Next.js, when using server actions with redirect() in form handlers'
    store.add({ type: 'Pattern', context: longContext, problem: '', solution: 's', reason: '', tags: [], project: 'P' })
    store.add({ type: 'AntiPattern', context: longContext, problem: '', solution: 's', reason: '', tags: [], project: 'P' })
    // Phase 1 auto-derive should create a Contradicts edge
    const h = store.memoryHealth()
    expect(h.contradictions.length).toBeGreaterThanOrEqual(1)
    expect(h.contradictions[0].type).toBe('Contradicts')
  })

  it('returns pending review count', () => {
    store.add({ type: 'Pattern', context: 'p1', problem: '', solution: 's', reason: '', tags: [], status: 'pending-review' })
    store.add({ type: 'Pattern', context: 'p2', problem: '', solution: 's', reason: '', tags: [], status: 'pending-review' })
    const h = store.memoryHealth()
    expect(h.pendingReview).toBe(2)
  })

  it('returns top decay candidates ordered by sessionsStale desc', () => {
    const m1 = store.add({ type: 'Pattern', context: 'd1', problem: '', solution: 's', reason: '', tags: [] })
    const m2 = store.add({ type: 'Pattern', context: 'd2', problem: '', solution: 's', reason: '', tags: [] })
    db.prepare("UPDATE memories SET sessions_since_validation = 5 WHERE id = ?").run(m1.id)
    db.prepare("UPDATE memories SET sessions_since_validation = 12 WHERE id = ?").run(m2.id)
    const h = store.memoryHealth()
    expect(h.topDecayCandidates[0].id).toBe(m2.id) // most stale first
    expect(h.topDecayCandidates.length).toBeGreaterThanOrEqual(2)
  })
})
