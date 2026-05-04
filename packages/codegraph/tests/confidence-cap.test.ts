import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb } from '@skillbrain/storage'
import { runMigrations } from '@skillbrain/storage'
import { MemoryStore } from '@skillbrain/storage'

describe('MemoryStore.add — confidence cap', () => {
  let dir: string
  let db: any
  let store: MemoryStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-cap-'))
    db = openDb(dir)
    runMigrations(db)
    store = new MemoryStore(db)
  })
  afterEach(() => {
    closeDb(db)
    rmSync(dir, { recursive: true, force: true })
  })

  it('caps Pattern confidence at 8 even if 10 is passed', () => {
    const m = store.add({
      type: 'Pattern',
      context: 'c',
      problem: '',
      solution: '',
      reason: '',
      tags: [],
      confidence: 10,
    })
    expect(m.confidence).toBe(8)
  })

  it('caps Fact confidence at 6 even if 10 is passed', () => {
    const m = store.add({
      type: 'Fact',
      context: 'c',
      problem: '',
      solution: '',
      reason: '',
      tags: [],
      confidence: 10,
    })
    expect(m.confidence).toBe(6)
  })

  it('caps BugFix confidence at 8', () => {
    const m = store.add({
      type: 'BugFix',
      context: 'c',
      problem: '',
      solution: '',
      reason: '',
      tags: [],
      confidence: 9,
    })
    expect(m.confidence).toBe(8)
  })

  it('caps Goal confidence at 8', () => {
    const m = store.add({
      type: 'Goal',
      context: 'c',
      problem: '',
      solution: '',
      reason: '',
      tags: [],
      confidence: 9,
    })
    expect(m.confidence).toBe(8)
  })

  it('caps Todo confidence at 8', () => {
    const m = store.add({
      type: 'Todo',
      context: 'c',
      problem: '',
      solution: '',
      reason: '',
      tags: [],
      confidence: 9,
    })
    expect(m.confidence).toBe(8)
  })

  it('allows Decision confidence at 10', () => {
    const m = store.add({
      type: 'Decision',
      context: 'c',
      problem: '',
      solution: '',
      reason: '',
      tags: [],
      confidence: 10,
    })
    expect(m.confidence).toBe(10)
  })

  it('allows AntiPattern confidence at 10', () => {
    const m = store.add({
      type: 'AntiPattern',
      context: 'c',
      problem: '',
      solution: '',
      reason: '',
      tags: [],
      confidence: 10,
    })
    expect(m.confidence).toBe(10)
  })

  it('caps Preference confidence at 8 (like Pattern)', () => {
    const m = store.add({
      type: 'Preference',
      context: 'c',
      problem: '',
      solution: '',
      reason: '',
      tags: [],
      confidence: 10,
    })
    expect(m.confidence).toBe(8)
  })

  it('preserves lower confidence values', () => {
    const m = store.add({
      type: 'Pattern',
      context: 'c',
      problem: '',
      solution: '',
      reason: '',
      tags: [],
      confidence: 4,
    })
    expect(m.confidence).toBe(4)
  })

  it('uses default confidence if not provided', () => {
    const m = store.add({
      type: 'Pattern',
      context: 'c',
      problem: '',
      solution: '',
      reason: '',
      tags: [],
    })
    expect(m.confidence).toBe(1)
  })
})
