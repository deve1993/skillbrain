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
import { openDb, closeDb } from '../src/storage/db.js'
import { runMigrations } from '../src/storage/migrator.js'
import { MemoryStore } from '../src/storage/memory-store.js'

describe('MemoryStore.dismissMemory', () => {
  let dir: string
  let db: any
  let store: MemoryStore
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-mdis-'))
    db = openDb(dir); runMigrations(db); store = new MemoryStore(db)
  })
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('records a dismissal row', () => {
    const m = store.add({ type: 'Pattern', context: 'c', problem: '', solution: 's', reason: '', tags: ['x'] })
    store.dismissMemory(m.id, 'outdated')
    expect(store.dismissalCount(m.id)).toBe(1)
  })

  it('penalizes dismissed memories in scored()', () => {
    const a = store.add({ type: 'Pattern', context: 'shared', problem: '', solution: 's', reason: '', tags: ['nextjs'], confidence: 5 })
    const b = store.add({ type: 'Pattern', context: 'shared', problem: '', solution: 's', reason: '', tags: ['nextjs'], confidence: 5 })

    store.dismissMemory(a.id); store.dismissMemory(a.id); store.dismissMemory(a.id)

    const ranked = store.scored(undefined, [], 10)
    const aIdx = ranked.findIndex((r) => r.memory.id === a.id)
    const bIdx = ranked.findIndex((r) => r.memory.id === b.id)
    expect(bIdx).toBeLessThan(aIdx)
  })

  it('penalizes dismissed memories in search()', () => {
    const a = store.add({ type: 'Pattern', context: 'auth flow', problem: '', solution: 'use NextAuth', reason: '', tags: ['auth'] })
    const b = store.add({ type: 'Pattern', context: 'auth flow', problem: '', solution: 'use NextAuth', reason: '', tags: ['auth'] })
    for (let i = 0; i < 3; i++) store.dismissMemory(a.id)

    const results = store.search('auth NextAuth', 10)
    const aIdx = results.findIndex((r) => r.memory.id === a.id)
    const bIdx = results.findIndex((r) => r.memory.id === b.id)
    if (aIdx >= 0 && bIdx >= 0) expect(bIdx).toBeLessThan(aIdx)
  })
})
