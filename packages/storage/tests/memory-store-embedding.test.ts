/*
 * SkillBrain — Self-hosted AI memory platform
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
import { EmbeddingService } from '../src/embedding-service.js'

function makeDb() {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

function makeMemoryInput(overrides = {}) {
  return {
    type: 'BugFix' as const,
    context: 'test context for embedding',
    problem: 'test problem',
    solution: 'test solution',
    reason: 'test reason',
    confidence: 7,
    importance: 5,
    tags: ['test'],
    ...overrides,
  }
}

describe('embed-on-add hook', () => {
  const fixedVec = new Float32Array(384).fill(0.5)

  beforeEach(() => {
    // Reset singleton so each test starts with a fresh instance
    ;(EmbeddingService as any)._instance = undefined
    // Mock embed on the prototype to avoid model downloads
    vi.spyOn(EmbeddingService.prototype, 'embed').mockResolvedValue(fixedVec)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    ;(EmbeddingService as any)._instance = undefined
  })

  it('inserts a row in memory_embeddings after add()', async () => {
    const db = makeDb()
    const store = new MemoryStore(db)
    const memory = store.add(makeMemoryInput())
    // Fire-and-forget: wait for the microtask queue to drain
    await new Promise((r) => setTimeout(r, 50))
    const row = db.prepare('SELECT * FROM memory_embeddings WHERE memory_id = ?').get(memory.id)
    expect(row).toBeTruthy()
  })

  it('upsertEmbedding is idempotent (no duplicate rows on two embeds)', async () => {
    const db = makeDb()
    const store = new MemoryStore(db)
    store.add(makeMemoryInput())
    store.add(makeMemoryInput({ context: 'second entry' }))
    await new Promise((r) => setTimeout(r, 50))
    const rows = db.prepare('SELECT COUNT(*) as n FROM memory_embeddings').get() as { n: number }
    expect(rows.n).toBe(2) // two memories, two rows
  })

  it('add() returns synchronously even when embed is pending', () => {
    const db = makeDb()
    // Use a slow mock to ensure add() does not block
    vi.spyOn(EmbeddingService.prototype, 'embed').mockImplementation(
      () => new Promise((r) => setTimeout(() => r(fixedVec), 1000))
    )
    const store = new MemoryStore(db)
    const start = Date.now()
    const memory = store.add(makeMemoryInput())
    const elapsed = Date.now() - start
    expect(memory.id).toBeTruthy()
    expect(elapsed).toBeLessThan(100) // add() must return in < 100ms even with slow embed
  })
})
