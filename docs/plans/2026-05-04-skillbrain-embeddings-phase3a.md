# Phase 3a — Vector Embeddings Implementation Plan

**Date:** 2026-05-04
**Branch:** feat/skillbrain-pecche-phase1
**Worktree:** `.worktrees/skillbrain-pecche-phase1`
**Baseline:** 231 tests passing (run `pnpm test` from root to verify)
**Design spec:** `docs/superpowers/specs/2026-05-04-skillbrain-embeddings-design.md`

---

## Goal

Add semantic search to memory retrieval via local vector embeddings.
Hybrid retrieval: `final_score = 0.5 * bm25_norm + 0.5 * cosine_similarity`.

---

## Model

`Xenova/multilingual-e5-small` via `@huggingface/transformers`
- 118MB, 384 dims, IT+EN, CPU-only ONNX
- **Required prefixes**: `"query: "` for search queries, `"passage: "` for stored docs

---

## Task Breakdown

### Task 1 — Infrastructure: dep + migration + EmbeddingService + tests

**Files to create/edit:**

1. **`packages/storage/package.json`** — add dependency:
   ```json
   "@huggingface/transformers": "^3.5.0"
   ```

2. **`packages/storage/src/migrations/023_memory_embeddings.sql`** — new migration:
   ```sql
   CREATE TABLE IF NOT EXISTS memory_embeddings (
     memory_id TEXT PRIMARY KEY,
     embedding  BLOB NOT NULL,
     model      TEXT NOT NULL DEFAULT 'multilingual-e5-small',
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
   );
   CREATE INDEX IF NOT EXISTS idx_mem_emb_model ON memory_embeddings(model);
   ```

3. **`packages/storage/src/embedding-service.ts`** — new file:
   ```typescript
   import type { Database } from 'better-sqlite3'

   function vectorToBlob(v: Float32Array): Buffer {
     return Buffer.from(v.buffer, v.byteOffset, v.byteLength)
   }
   function blobToVector(b: Buffer): Float32Array {
     return new Float32Array(b.buffer, b.byteOffset, 384)
   }
   export function cosine(a: Float32Array, b: Float32Array): number {
     let s = 0
     for (let i = 0; i < a.length; i++) s += a[i] * b[i]
     return s
   }
   export { vectorToBlob, blobToVector }

   export class EmbeddingService {
     private static _instance?: EmbeddingService
     private pipeline?: any

     static get(): EmbeddingService {
       if (!EmbeddingService._instance) EmbeddingService._instance = new EmbeddingService()
       return EmbeddingService._instance
     }

     async embed(text: string, kind: 'query' | 'passage'): Promise<Float32Array | null> {
       try {
         if (!this.pipeline) {
           const { pipeline } = await import('@huggingface/transformers')
           this.pipeline = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small')
         }
         const prefix = kind === 'query' ? 'query: ' : 'passage: '
         const out = await this.pipeline(prefix + text, { pooling: 'mean', normalize: true })
         return new Float32Array(out.data)
       } catch (err) {
         console.error('[embedding-service] embed failed', err)
         return null
       }
     }

     async embedMany(texts: string[], kind: 'passage'): Promise<(Float32Array | null)[]> {
       const results: (Float32Array | null)[] = []
       for (const text of texts) {
         results.push(await this.embed(text, kind))
       }
       return results
     }
   }
   ```

4. **`packages/storage/src/index.ts`** — add exports:
   ```typescript
   export { EmbeddingService, cosine, vectorToBlob, blobToVector } from './embedding-service.js'
   ```

5. **`packages/storage/tests/embedding-service.test.ts`** — new test file:
   - Test `vectorToBlob` round-trips through `blobToVector` correctly (pure math, no model)
   - Test `cosine` of identical vectors = 1.0, orthogonal = 0.0
   - Test `EmbeddingService.get()` returns same singleton
   - Test `embed` returns Float32Array with 384 elements (requires model download — skip in CI with `SKIP_EMBEDDING_TESTS=1`)
   - Expected: +4 tests

**After Task 1:**
- Run `pnpm --filter @skillbrain/storage install` to install the new dep
- Run `pnpm test` — should still have 231 passing + 4 new = ~235

---

### Task 2 — Embed-on-add hook in MemoryStore

**File:** `packages/storage/src/memory-store.ts`

In `add()`, after the existing `populateFts(memory)` call and edge derivation block, add:

```typescript
// async fire-and-forget — never blocks add() return
try {
  const svc = EmbeddingService.get()
  const text = `${memory.context}\n${memory.solution ?? ''}`.slice(0, 2000)
  svc.embed(text, 'passage').then((vec) => {
    if (vec) this.upsertEmbedding(memory.id, vec)
  }).catch((err) => console.error('[memory-store] embed on-add failed', err))
} catch { /* swallow */ }
```

Also add private method `upsertEmbedding(memoryId: string, vec: Float32Array): void`:

```typescript
private upsertEmbedding(memoryId: string, vec: Float32Array): void {
  const { vectorToBlob } = await import('./embedding-service.js')  // static import at top instead
  this.db.prepare(`
    INSERT INTO memory_embeddings (memory_id, embedding) VALUES (?, ?)
    ON CONFLICT(memory_id) DO UPDATE SET embedding = excluded.embedding, created_at = datetime('now')
  `).run(memoryId, vectorToBlob(vec))
}
```

**Note:** Use static import of `vectorToBlob` at the top of memory-store.ts.

**Tests for Task 2:** `packages/storage/tests/memory-store-embedding.test.ts`
- Verify that after `store.add(...)`, a row appears in `memory_embeddings` (use small delay / mock EmbeddingService)
- Mock EmbeddingService to return a fixed Float32Array(384).fill(0.5)
- Verify `upsertEmbedding` is idempotent (calling twice doesn't duplicate)
- Expected: +3 tests

---

### Task 3 — Hybrid retrieval in MemoryStore.search()

**File:** `packages/storage/src/memory-store.ts`

Modify `search(query, opts)` to:

1. Run existing BM25/FTS pipeline → top `limit * 3` candidates with normalized scores
2. Compute query embedding once: `const qVec = await EmbeddingService.get().embed(query, 'query')`
3. If `qVec` is null (model unavailable) → return BM25-only results (existing behavior, no change)
4. For each BM25 candidate: fetch its embedding from `memory_embeddings`, compute cosine
5. `finalScore = 0.5 * bm25Norm + 0.5 * cosineSim` (cosine = 0 if no embedding yet)
6. Sort by finalScore desc, slice to `limit`, return

Helper to fetch embedding for one memory:
```typescript
private getEmbedding(memoryId: string): Float32Array | null {
  const row = this.db.prepare('SELECT embedding FROM memory_embeddings WHERE memory_id = ?').get(memoryId) as { embedding: Buffer } | undefined
  return row ? blobToVector(row.embedding) : null
}
```

**Note:** `search()` must remain sync for callers that don't await. If search already returns a Promise, keep it async. If it's sync, make it async (check current signature).

**Tests for Task 3:** `packages/storage/tests/memory-store-hybrid.test.ts`
- Add 3 memories to an in-memory DB, inject mock embeddings directly via `INSERT INTO memory_embeddings`
- Call `search()` with mock EmbeddingService (via vi.mock or constructor injection)
- Verify that result order reflects combined score, not just BM25
- Verify BM25-only fallback when qVec is null
- Expected: +4 tests

---

### Task 4 — Backfill script

**File:** `packages/storage/scripts/backfill-embeddings.ts`

```typescript
import { openDb, runMigrations } from '../src/index.js'
import { EmbeddingService, vectorToBlob } from '../src/embedding-service.js'

async function main() {
  const db = openDb()
  await runMigrations(db)

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
    if ((i + BATCH) % 50 < BATCH) console.log(`  ${Math.min(i + BATCH, memories.length)}/${memories.length}`)
  }

  console.log('Done.')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

**Add to `packages/storage/package.json` scripts:**
```json
"backfill:embeddings": "tsx scripts/backfill-embeddings.ts"
```

**Also add to root `package.json` scripts:**
```json
"backfill:embeddings": "pnpm --filter @skillbrain/storage backfill:embeddings"
```

---

### Task 5 — End-to-end smoke + final verification

1. Build: `pnpm build` from root
2. Run full test suite: `pnpm test` — target ≥ 242 tests (231 baseline + ~11 new)
3. Run typecheck: `pnpm --filter @skillbrain/storage typecheck`
4. Smoke test (optional, requires model download):
   ```bash
   cd packages/storage
   tsx scripts/backfill-embeddings.ts
   ```

---

## Acceptance Criteria

- [ ] `023_memory_embeddings.sql` migration exists and is applied on DB open
- [ ] `EmbeddingService` singleton: lazy-loads model, returns null gracefully if unavailable
- [ ] `cosine`, `vectorToBlob`, `blobToVector` exported from `@skillbrain/storage`
- [ ] `MemoryStore.add()` fires embed-on-add (best-effort async, never blocks)
- [ ] `MemoryStore.search()` uses hybrid scoring when model available, falls back to BM25-only
- [ ] Backfill script is idempotent (safe to re-run)
- [ ] All existing 231 tests still pass
- [ ] At least 11 new tests added (embedding-service + on-add hook + hybrid search)
- [ ] No TypeScript errors (`tsc --noEmit`)

---

## Notes for executor

- Work in worktree: `/Users/dan/Desktop/progetti-web/MASTER_Fullstack session/.worktrees/skillbrain-pecche-phase1`
- Branch: `feat/skillbrain-pecche-phase1`
- The `@huggingface/transformers` package uses dynamic ESM — add `"type": "module"` is already set on storage package
- Model downloads to HuggingFace cache on first use (~118MB) — CI should set `TRANSFORMERS_CACHE` or skip model-dependent tests
- `search()` in memory-store.ts: check whether it's currently sync or async before modifying signature
- After adding the dep, run `pnpm install` from root (not just the package) to update lockfile
