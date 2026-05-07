/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */
import { openDb, runMigrations } from '../src/index.js'
import { EmbeddingService, vectorToBlob } from '../src/embedding-service.js'

async function main() {
  const db = openDb()
  runMigrations(db)

  const memories = db.prepare(`
    SELECT id, context, solution FROM memories
    WHERE status != 'archived'
    AND id NOT IN (SELECT memory_id FROM memory_embeddings)
  `).all() as { id: string; context: string; solution: string | null }[]

  console.log(`Backfilling ${memories.length} memories...`)
  const svc = EmbeddingService.get()
  const BATCH = 32

  for (let i = 0; i < memories.length; i += BATCH) {
    const batch = memories.slice(i, i + BATCH)
    for (const m of batch) {
      const text = `${m.context}\n${m.solution ?? ''}`.slice(0, 2000)
      const vec = await svc.embed(text, 'passage')
      if (vec) {
        db.prepare(`INSERT OR IGNORE INTO memory_embeddings (memory_id, embedding) VALUES (?, ?)`).run(m.id, vectorToBlob(vec))
      }
    }
    if (i + BATCH < memories.length) {
      console.log(`  ${Math.min(i + BATCH, memories.length)}/${memories.length}`)
    }
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
