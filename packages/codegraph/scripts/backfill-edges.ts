/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

/**
 * Backfill memory edges for all existing memories.
 *
 * Runs deriveEdgeCandidates against the full memory set for each memory
 * that has no outgoing edges yet. Idempotent: skips memories that already
 * have edges (from OR to them).
 *
 * Usage:
 *   pnpm backfill:edges
 *   pnpm backfill:edges -- --dry
 *   SKILLBRAIN_ROOT=/path/to/data pnpm backfill:edges
 *   SKILLBRAIN_ROOT=/path/to/data pnpm backfill:edges -- --dry
 */

import { openDb, closeDb } from '../src/storage/db.js'
import { MemoryStore } from '../src/storage/memory-store.js'
import { deriveEdgeCandidates } from '../src/storage/memory-edge-derivation.js'

const dry = process.argv.includes('--dry')
const root = process.env.SKILLBRAIN_ROOT ?? process.cwd()
console.log(`[backfill-edges] target: ${root}${dry ? ' (DRY RUN)' : ''}`)

const db = openDb(root)

try {
  const store = new MemoryStore(db)

  const all = store.query({ limit: 10000 })
  console.log(`[backfill-edges] scanning ${all.length} memories…`)

  let created = 0
  let skipped = 0

  for (const subject of all) {
    const existing = store.getEdges(subject.id)
    if (existing.length > 0) { skipped++; continue }

    const candidates = all.filter((m) => m.id !== subject.id)
    const edges = deriveEdgeCandidates(subject, candidates)
    for (const e of edges) {
      if (!dry) store.addEdge(subject.id, e.targetId, e.type, e.reason)
      created++
    }
  }

  const verb = dry ? 'would create' : 'created'
  console.log(`[backfill-edges] ${verb} ${created} edges, skipped ${skipped} memories with existing edges`)
} finally {
  closeDb(db)
}
