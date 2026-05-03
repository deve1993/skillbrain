import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb } from '../src/storage/db.js'
import { runMigrations } from '../src/storage/migrator.js'
import { MemoryStore } from '../src/storage/memory-store.js'

describe('MemoryStore — memory_usage tracking', () => {
  let dir: string, db: any, store: MemoryStore
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-musage-'))
    db = openDb(dir); runMigrations(db); store = new MemoryStore(db)
  })
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('logMemoryUsage inserts a row', () => {
    const m = store.add({ type: 'Pattern', context: 'c', problem: '', solution: 's', reason: '', tags: [] })
    store.logMemoryUsage(m.id, 'session-1', 'loaded', 'P')
    const rows = db.prepare(`SELECT memory_id, session_id, action, project FROM memory_usage WHERE memory_id = ?`).all(m.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ memory_id: m.id, session_id: 'session-1', action: 'loaded', project: 'P' })
  })

  it('getMemoryUsageInSession returns rows for that session only', () => {
    const m1 = store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [] })
    const m2 = store.add({ type: 'Pattern', context: 'b', problem: '', solution: 's', reason: '', tags: [] })
    store.logMemoryUsage(m1.id, 'session-A', 'loaded')
    store.logMemoryUsage(m2.id, 'session-B', 'loaded')
    const a = store.getMemoryUsageInSession('session-A')
    expect(a).toHaveLength(1)
    expect(a[0].memoryId).toBe(m1.id)
  })

  it('action filter distinguishes loaded vs applied', () => {
    const m = store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [] })
    store.logMemoryUsage(m.id, 'S', 'loaded')
    store.logMemoryUsage(m.id, 'S', 'applied')
    const loaded = store.getMemoryUsageInSession('S', 'loaded')
    const applied = store.getMemoryUsageInSession('S', 'applied')
    expect(loaded).toHaveLength(1)
    expect(applied).toHaveLength(1)
  })

  it('CASCADE removes usage when memory deleted', () => {
    const m = store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [] })
    store.logMemoryUsage(m.id, 'S', 'loaded')
    store.delete(m.id)
    const rows = db.prepare(`SELECT * FROM memory_usage WHERE memory_id = ?`).all(m.id)
    expect(rows).toHaveLength(0)
  })

  it('null sessionId is allowed (anonymous usage)', () => {
    const m = store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [] })
    expect(() => store.logMemoryUsage(m.id, undefined, 'loaded')).not.toThrow()
  })

  it('memory_load tool logs loaded usage when sessionId is provided (store-level simulation)', () => {
    const m1 = store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [], confidence: 8 })
    const m2 = store.add({ type: 'Pattern', context: 'b', problem: '', solution: 's', reason: '', tags: [], confidence: 8 })
    
    // Simulate the tool's behavior: scored() then log each
    const results = store.scored(undefined, [], 5)
    expect(results.length).toBeGreaterThanOrEqual(2)
    
    for (const r of results) {
      store.logMemoryUsage(r.memory.id, 'sess-load-test', 'loaded')
    }
    
    const usage = store.getMemoryUsageInSession('sess-load-test', 'loaded')
    expect(usage.length).toBe(results.length)
  })
})
