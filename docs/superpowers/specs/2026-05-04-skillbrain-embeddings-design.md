# SkillBrain — Phase 3a Vector Embeddings (Design)

**Date:** 2026-05-04
**Status:** Approved by user

## Goal

Add semantic search to memory retrieval via local embeddings. Memories with similar meaning surface even when they don't share keywords with the query.

## Decisions (5 user-approved)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Local model** (no API) | Self-hosted alignment, zero runtime cost, privacy |
| 2 | **BLOB + JS brute force** (no sqlite-vec) | Sufficient for current/near-term scale, zero native deps |
| 3 | **Memories only** (not skills) | Skills already work well via BM25; max ROI on memories |
| 4 | **Hybrid retrieval** (BM25 + vector summed) | Captures lexical + semantic |
| 5 | **Batch backfill** for existing 178 memories | One-time, ~6 seconds, runs after deploy |

## Model

`Xenova/multilingual-e5-small` via `@huggingface/transformers` (formerly `@xenova/transformers`).

- **Size**: ~118MB on disk
- **Dimension**: 384 floats
- **Languages**: IT, EN, plus 98 others (relevant: user writes mixed IT/EN content)
- **Throughput**: ~50-100 embeddings/sec on a typical Coolify VPS (CPU-only, ONNX runtime)
- **Required prefixes**: e5 family expects `"query: "` prefix for search queries and `"passage: "` for stored documents — must be applied at the right call site

## Architecture

### Storage

New table in migration `023_memory_embeddings.sql`:

```sql
CREATE TABLE IF NOT EXISTS memory_embeddings (
  memory_id TEXT PRIMARY KEY,
  embedding BLOB NOT NULL,          -- Float32Array(384) serialized = 1536 bytes
  model     TEXT NOT NULL DEFAULT 'multilingual-e5-small',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mem_emb_model ON memory_embeddings(model);
```

`model` column allows future model swap without losing track. Per-memory rebuild on model change.

### EmbeddingService (new module)

`packages/storage/src/embedding-service.ts`:

```typescript
export class EmbeddingService {
  private static instance?: EmbeddingService
  private pipeline?: any  // lazy-loaded

  static get(): EmbeddingService { ... singleton ... }

  async embed(text: string, kind: 'query' | 'passage'): Promise<Float32Array> {
    const prefix = kind === 'query' ? 'query: ' : 'passage: '
    const out = await this.pipeline(prefix + text, { pooling: 'mean', normalize: true })
    return new Float32Array(out.data)
  }

  async embedMany(texts: string[], kind: 'passage'): Promise<Float32Array[]> { ... }
}
```

- Lazy-loads model on first call (fail gracefully if model not on disk → log + return null)
- Uses `pooling: 'mean'` and `normalize: true` for cosine-ready vectors
- Singleton: model loaded once per process

### Serialization helpers

```typescript
function vectorToBlob(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength)
}
function blobToVector(b: Buffer): Float32Array {
  return new Float32Array(b.buffer, b.byteOffset, 384)
}
function cosine(a: Float32Array, b: Float32Array): number {
  // both already normalized → dot product == cosine similarity
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}
```

### Integration into MemoryStore.add()

After `populateFts(memory)` and edge derivation (best-effort, never blocks add):

```typescript
try {
  const svc = EmbeddingService.get()
  const text = `${memory.context}\n${memory.solution}`.slice(0, 2000)
  svc.embed(text, 'passage').then((vec) => {
    if (vec) this.upsertEmbedding(memory.id, vec)
  }).catch((err) => console.error('[memory-store] embed failed', err))
} catch { /* swallow */ }
```

Note: async fire-and-forget — does not block `add()` return. Eventual consistency.

### Integration into MemoryStore.search()

In hybrid mode:

1. Run existing BM25/FTS pipeline → top `limit*3` candidates with scores normalized to 0..1
2. Compute query embedding (one model call)
3. For each candidate (and a top-K neighborhood): fetch its embedding, compute cosine
4. Final score = `0.5 * bm25_norm + 0.5 * vector_score` (tunable constants)
5. Sort by final, slice limit, return

To avoid loading ALL embeddings into memory each search:
- Limit cosine computation to candidates already returned by BM25 (cheap)
- Optionally pull additional candidates from `memory_embeddings` if BM25 returned too few — bounded to `limit*5`

This keeps brute force bounded: typical query touches 15-75 vectors, not 1000+.

### Backfill

`packages/storage/scripts/backfill-embeddings.ts` (new):

- Iterate all active memories without a row in `memory_embeddings`
- Batch-embed in groups of 32 (efficiency vs RAM)
- Insert (memory_id, embedding, model)
- Print progress every 50 memories
- Idempotent (skip already-embedded)

Run once: `pnpm backfill:embeddings` from root.

## Failure modes

- **Model file missing**: First `embed()` call tries to download from HuggingFace. If offline + not cached: throws. EmbeddingService catches and returns null. `MemoryStore.add()` swallows; search falls back to BM25-only for that query.
- **Backfill interrupted**: Re-running picks up where it left off (idempotent skip).
- **Model upgrade**: New `model` field lets you delete embeddings for old model and re-backfill.
- **Disk space**: 1000 memories × 1.5KB = 1.5MB, negligible.

## Out of scope

- Skill embeddings (item B from Q3)
- sqlite-vec migration (item 1 from Q2)
- Cross-encoder reranking
- Multi-model A/B testing

## Implementation tasks (preview — full plan in separate doc)

1. Add `@huggingface/transformers` to `@skillbrain/storage` deps
2. Migration 023 + EmbeddingService skeleton + tests
3. Embed-on-add hook (best-effort async)
4. Hybrid retrieval in `search()` + tests
5. Backfill script
6. End-to-end smoke on local DB

Estimated: 5 tasks via subagent-driven, single session.

## Test count progression

231 (after Phase 2.5 + 3b) → ~245 (+14 new tests across embedding service, hybrid search, hooks)
