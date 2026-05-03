import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb } from '@skillbrain/storage'
import { runMigrations } from '@skillbrain/storage'
import { MemoryStore } from '@skillbrain/storage'

describe('MemoryStore.search — edge expansion', () => {
  let dir: string
  let db: any
  let store: MemoryStore
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-edge-exp-'))
    db = openDb(dir); runMigrations(db); store = new MemoryStore(db)
  })
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('surfaces edge-linked memories that do not match the query lexically', () => {
    const a = store.add({
      type: 'Pattern',
      context: 'AAAA-unique-term',
      problem: '',
      solution: 'AAAA-unique-term solution',
      reason: '',
      tags: ['xtagone', 'xtagtwo'],
      project: 'projX',
    })
    const b = store.add({
      type: 'Pattern',
      context: 'BBBB-completely-different',
      problem: '',
      solution: 'BBBB-completely-different solution',
      reason: '',
      tags: ['xtagone', 'xtagtwo'],
      project: 'projX',
    })
    // a and b are auto-linked via RelatedTo by Phase 1 derivation
    // (same project + 2 tag overlap: xtagone + xtagtwo)

    // Manually verify edge was created
    const edges = store.getEdges(a.id)
    expect(edges.some((e) => e.targetId === b.id || e.sourceId === b.id)).toBe(true)

    // Query that lexically matches A but NOT B — B has zero tokens in common
    const results = store.search('AAAA-unique-term', 10)
    const ids = results.map((r) => r.memory.id)
    expect(ids).toContain(a.id)
    expect(ids).toContain(b.id) // must surface via edge expansion
  })

  it('expanded results have lower rank than direct hits', () => {
    const a = store.add({
      type: 'Pattern',
      context: 'CCCC-keyword context',
      problem: '',
      solution: 'CCCC-keyword solution',
      reason: '',
      tags: ['ytagone', 'ytagtwo'],
      project: 'projY',
    })
    const b = store.add({
      type: 'Pattern',
      context: 'DDDD-totally-different context',
      problem: '',
      solution: 'DDDD-totally-different solution',
      reason: '',
      tags: ['ytagone', 'ytagtwo'],
      project: 'projY',
    })
    const results = store.search('CCCC-keyword', 10)
    const aR = results.find((r) => r.memory.id === a.id)
    const bR = results.find((r) => r.memory.id === b.id)
    if (aR && bR) expect(aR.rank).toBeGreaterThan(bR.rank)
  })

  it('does not exceed limit*2 results', () => {
    for (let i = 0; i < 20; i++) {
      store.add({
        type: 'Pattern',
        context: 'ZZZZ-shared-context-' + i,
        problem: '',
        solution: 'ZZZZ-ks' + i,
        reason: '',
        tags: ['ztagone', 'ztagtwo'],
        project: 'projZ',
      })
    }
    const results = store.search('ZZZZ-shared-context-1', 5)
    expect(results.length).toBeLessThanOrEqual(10)
  })
})
