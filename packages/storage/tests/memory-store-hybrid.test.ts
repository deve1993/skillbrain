/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/migrator.js'
import { MemoryStore } from '../src/memory-store.js'
import { EmbeddingService, vectorToBlob } from '../src/embedding-service.js'

function makeDb() {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

function makeMemoryInput(context: string, solution: string) {
  return {
    type: 'BugFix' as const,
    context,
    problem: 'test problem',
    solution,
    reason: 'test reason',
    confidence: 7,
    importance: 5,
    tags: ['test'],
  }
}

describe('MemoryStore.searchAsync() — hybrid retrieval', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    ;(EmbeddingService as any)._instance = undefined
  })

  it('returns BM25-only results when qVec is null (graceful degradation)', async () => {
    const db = makeDb()
    // Mock embed to return null (model unavailable)
    vi.spyOn(EmbeddingService.prototype, 'embed').mockResolvedValue(null)
    const store = new MemoryStore(db)
    store.add(makeMemoryInput('typescript async await pattern', 'use async/await'))
    store.add(makeMemoryInput('python list comprehension', 'use list comp'))
    // disable embed-on-add side effects
    await new Promise((r) => setTimeout(r, 20))

    const results = await store.searchAsync('typescript async', 10)
    expect(results.length).toBeGreaterThan(0)
    // Results should still come back (BM25 fallback)
    expect(results[0].memory.context).toContain('typescript')
  })

  it('hybrid scoring changes result order when embeddings exist', async () => {
    const db = makeDb()
    vi.spyOn(EmbeddingService.prototype, 'embed').mockResolvedValue(new Float32Array(384).fill(0))
    const store = new MemoryStore(db)

    // Add two memories
    const m1 = store.add(makeMemoryInput('react hooks useState pattern', 'use useState hook'))
    const m2 = store.add(makeMemoryInput('react hooks useEffect pattern', 'use useEffect hook'))
    await new Promise((r) => setTimeout(r, 20))

    // Inject a high-cosine embedding for m1 (vec pointing towards query vec)
    const highSim = new Float32Array(384).fill(1 / Math.sqrt(384))
    const lowSim = new Float32Array(384).fill(0)
    db.prepare('INSERT OR REPLACE INTO memory_embeddings (memory_id, embedding) VALUES (?, ?)').run(m1.id, vectorToBlob(highSim))
    db.prepare('INSERT OR REPLACE INTO memory_embeddings (memory_id, embedding) VALUES (?, ?)').run(m2.id, vectorToBlob(lowSim))

    // Mock query embed to return the same high-sim vector (cosine = 1 with m1)
    vi.spyOn(EmbeddingService.prototype, 'embed').mockResolvedValue(highSim)

    const results = await store.searchAsync('react hooks', 10)
    expect(results.length).toBeGreaterThan(0)
    // m1 should rank higher due to cosine boost
    const m1Rank = results.findIndex((r) => r.memory.id === m1.id)
    const m2Rank = results.findIndex((r) => r.memory.id === m2.id)
    if (m1Rank !== -1 && m2Rank !== -1) {
      expect(m1Rank).toBeLessThan(m2Rank)
    }
  })

  it('returns empty array for empty query', async () => {
    const db = makeDb()
    vi.spyOn(EmbeddingService.prototype, 'embed').mockResolvedValue(new Float32Array(384).fill(0.1))
    const store = new MemoryStore(db)
    const results = await store.searchAsync('', 10)
    expect(results).toEqual([])
  })

  it('result count is bounded by limit', async () => {
    const db = makeDb()
    vi.spyOn(EmbeddingService.prototype, 'embed').mockResolvedValue(new Float32Array(384).fill(0.1))
    const store = new MemoryStore(db)
    // Add 10 memories with similar content
    for (let i = 0; i < 10; i++) {
      store.add(makeMemoryInput(`test memory number ${i} about typescript`, `solution ${i}`))
    }
    await new Promise((r) => setTimeout(r, 20))
    const results = await store.searchAsync('typescript', 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })
})
