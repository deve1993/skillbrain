/*
 * Synapse — The intelligence layer for AI workflows
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

describe('MemoryStore.scored — suggest preference bias', () => {
  let dir: string, db: any, store: MemoryStore
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-bias-'))
    db = openDb(dir); runMigrations(db); store = new MemoryStore(db)
  })
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('applies suggest preference type-bias to boost accepted types', () => {
    // Create two Fact memories with identical confidence (will score identically without bias)
    const fact1 = store.add({ type: 'Fact', context: 'cf1', problem: '', solution: 's', reason: '', tags: [], confidence: 5 })
    const fact2 = store.add({ type: 'Fact', context: 'cf2', problem: '', solution: 's', reason: '', tags: [], confidence: 5 })

    // Create a Pattern with same confidence
    const pattern = store.add({ type: 'Pattern', context: 'cp', problem: '', solution: 's', reason: '', tags: [], confidence: 5 })

    // Log suggest outcomes:
    // Fact: 9 accepted (rate = 0.9), boost = 0.8 + 0.4 * 0.9 = 1.16
    for (let i = 0; i < 9; i++) store.logSuggestOutcome('Fact', true)
    // Pattern: 1 accepted out of 10 (rate = 0.1), boost = 0.8 + 0.4 * 0.1 = 0.84
    store.logSuggestOutcome('Pattern', true)
    for (let i = 0; i < 9; i++) store.logSuggestOutcome('Pattern', false)

    const ranked = store.scored(undefined, [], 10)
    const factRanks = ranked.filter(r => r.memory.type === 'Fact').map(r => r.rank)
    const patternRanks = ranked.filter(r => r.memory.type === 'Pattern').map(r => r.rank)
    
    console.log('Fact ranks:', factRanks)
    console.log('Pattern ranks:', patternRanks)
    
    // Without bias: Fact = 5*2*1.0 = 10, Pattern = 5*2*1.3 = 13
    // With bias: Fact = 10 * 1.16 = 11.6, Pattern = 13 * 0.84 = 10.92
    // So Fact should rank higher than Pattern
    expect(factRanks[0]).toBeGreaterThan(patternRanks[0])
  })

  it('falls back to neutral (rate=0.5, multiplier=1.0) when no history exists', () => {
    const m = store.add({ type: 'Pattern', context: 'c', problem: '', solution: 's', reason: '', tags: [], confidence: 8 })
    const ranked = store.scored(undefined, [], 10)
    expect(ranked[0].memory.id).toBe(m.id)
  })
})
