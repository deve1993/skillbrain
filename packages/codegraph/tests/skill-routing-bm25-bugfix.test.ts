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
import { SkillsStore } from '@skillbrain/storage'

describe('SkillsStore.route — BM25 normalization regression', () => {
  let dir: string, db: any, store: SkillsStore
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-bm25-'))
    db = openDb(dir); runMigrations(db); store = new SkillsStore(db)
  })
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('best lexical match ranks above weaker match (BM25 not inverted)', () => {
    const now = new Date().toISOString()
    // Skill A: description heavily mentions "nextjs server actions revalidate"
    store.upsert({
      name: 'nextjs-cache',
      category: 'Frontend',
      description: 'nextjs server actions cache revalidateTag revalidatePath',
      content: 'nextjs server actions cache revalidateTag revalidatePath',
      type: 'process',
      tags: ['nextjs', 'cache'],
      lines: 1,
      updatedAt: now,
    })
    // Skill B: description has only one weak match
    store.upsert({
      name: 'unrelated-tool',
      category: 'Frontend',
      description: 'random tool that mentions nextjs once',
      content: 'random tool that mentions nextjs once',
      type: 'process',
      tags: ['other'],
      lines: 1,
      updatedAt: now,
    })

    const ranked = store.route('nextjs server actions revalidate cache')
    const aIdx = ranked.findIndex((s) => s.name === 'nextjs-cache')
    const bIdx = ranked.findIndex((s) => s.name === 'unrelated-tool')
    expect(aIdx).toBeGreaterThanOrEqual(0)
    expect(bIdx).toBeGreaterThanOrEqual(0)
    expect(aIdx).toBeLessThan(bIdx)
  })
})
