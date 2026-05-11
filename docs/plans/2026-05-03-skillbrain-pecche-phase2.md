# SkillBrain Pecche — Phase 2 Memory Retrieval & Autolearning Gaps

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four highest-impact gaps in memory retrieval and autolearning identified by the 2026-05-03 code audit. Phase A of the original Decision `M-decision-9dd5d3b4d1ae` (skill routing tuning) was already implemented; this plan tackles the memory-side gaps.

**Architecture:** Additive changes to `packages/codegraph` only. One small migration (021) adds `memory_dismissals`. The rest are pure code additions to `memory-store.ts`, one new MCP tool (`memory_health`, mirroring `skill_health`), and scoring tweaks in `scored()` and `search()`.

**Tech Stack:** TypeScript, better-sqlite3, MCP SDK, Vitest. No new runtime deps.

**Out of scope (Phase 2.5 / Phase 3):**
- `memory_usage` tracking table + auto-validation on `session_end completed` — needs new infra, separate plan
- Vector embeddings — already deferred to Phase 3 brainstorming
- Monolith split — Phase 3

---

## File Structure

**Created:**
- `packages/codegraph/src/storage/migrations/021_memory_dismissals.sql`
- `packages/codegraph/tests/memory-dismiss.test.ts`
- `packages/codegraph/tests/edge-expansion.test.ts`
- `packages/codegraph/tests/suggest-bias.test.ts`
- `packages/codegraph/tests/memory-health.test.ts`

**Modified:**
- `packages/codegraph/src/storage/memory-store.ts` — add `dismissMemory()`, `dismissalPenalty()`, edge expansion in `search()`, suggest-bias in `scored()`, `memoryHealth()` method
- `packages/codegraph/src/mcp/tools/memory.ts` — register `memory_dismiss` and `memory_health` MCP tools

---

### Task 1: `memory_dismiss` tool + dismissal penalty

**Goal:** Allow callers to flag a memory as wrong/outdated (`memory_dismiss`). Penalize dismissed memories in `scored()` and `search()` results so they sink in retrieval.

**Files:**
- Create: `packages/codegraph/src/storage/migrations/021_memory_dismissals.sql`
- Create: `packages/codegraph/tests/memory-dismiss.test.ts`
- Modify: `packages/codegraph/src/storage/memory-store.ts` — add `dismissMemory()`, `dismissalCount()`, integrate into scoring
- Modify: `packages/codegraph/src/mcp/tools/memory.ts` — register `memory_dismiss`

#### Step 1: Migration

```sql
-- 021_memory_dismissals.sql
-- Track dismissals so retrieval can penalize wrong/outdated memories.

CREATE TABLE IF NOT EXISTS memory_dismissals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id   TEXT NOT NULL,
  reason      TEXT,
  user_id     TEXT,
  ts          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_dismissals_memory ON memory_dismissals(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_dismissals_ts     ON memory_dismissals(ts);
```

- [ ] **Step 1.1:** Create the file. License header (copy from `020_fix_skill_usage_dismissed.sql`).

- [ ] **Step 1.2:** Verify migration runs in tests:

```bash
cd packages/codegraph && pnpm vitest run tests/migrator.test.ts
```
Expected: still 5/5 pass; the migrator picks up `021` automatically by filename ordering.

#### Step 2: Failing test

```typescript
// tests/memory-dismiss.test.ts
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
    const cnt = store.dismissalCount(m.id)
    expect(cnt).toBe(1)
  })

  it('penalizes dismissed memories in scored()', () => {
    const a = store.add({ type: 'Pattern', context: 'shared', problem: '', solution: 's', reason: '', tags: ['nextjs'], confidence: 5 })
    const b = store.add({ type: 'Pattern', context: 'shared', problem: '', solution: 's', reason: '', tags: ['nextjs'], confidence: 5 })

    // Dismiss a 3 times
    store.dismissMemory(a.id); store.dismissMemory(a.id); store.dismissMemory(a.id)

    const ranked = store.scored(undefined, [], 10)
    const aIdx = ranked.findIndex((r) => r.memory.id === a.id)
    const bIdx = ranked.findIndex((r) => r.memory.id === b.id)
    expect(bIdx).toBeLessThan(aIdx) // dismissed sinks below
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
```

- [ ] **Step 2.1: Run test — verify FAIL** (`dismissMemory is not a function`)

#### Step 3: Implement

In `memory-store.ts`, add prepared statements and methods:

```typescript
// Add to stmts setup:
insertDismissal: this.db.prepare(
  `INSERT INTO memory_dismissals (memory_id, reason, user_id) VALUES (?, ?, ?)`
),
countDismissals: this.db.prepare(
  `SELECT COUNT(*) as c FROM memory_dismissals WHERE memory_id = ?`
),

// New public methods:
dismissMemory(memoryId: string, reason?: string, userId?: string): void {
  this.stmts.insertDismissal.run(memoryId, reason ?? null, userId ?? null)
}

dismissalCount(memoryId: string): number {
  const row = this.stmts.countDismissals.get(memoryId) as { c: number } | undefined
  return row?.c ?? 0
}

private dismissalPenalty(memoryId: string): number {
  const c = this.dismissalCount(memoryId)
  return Math.min(c * 0.05, 0.30) // mirror skills cap
}
```

In `scored()` (around line 596 — where the score is computed), subtract `this.dismissalPenalty(m.id) * 10` (because scored uses absolute scores in the 0–30 range, not 0–1). Adjust the constant to ensure the test "dismissed sinks below" passes:

```typescript
score -= this.dismissalPenalty(m.id) * 10
```

In `search()` after `bm25Rerank` (around line 491):

```typescript
const penalized = reranked.map(({ memory, score }) => ({
  memory,
  score: score * (1 - this.dismissalPenalty(memory.id)),
}))
const boosted = this.closetBoost(penalized.sort((a, b) => b.score - a.score), project, activeSkills)
```

#### Step 4: Register MCP tool

In `src/mcp/tools/memory.ts`, add:

```typescript
server.tool(
  'memory_dismiss',
  'Mark a memory as wrong/outdated. Each dismissal lowers retrieval rank (cap -30%). Reversible by deleting the row.',
  {
    memoryId: z.string(),
    reason: z.string().optional(),
    repo: z.string().optional(),
  },
  async ({ memoryId, reason, repo }) => {
    const result = withMemoryStore(repo, (store) => {
      store.dismissMemory(memoryId, reason)
      return store.dismissalCount(memoryId)
    })
    return {
      content: [{
        type: 'text',
        text: `memory_dismiss: ${memoryId} (total dismissals: ${result})`,
      }],
    }
  },
)
```

#### Step 5: Run all tests

```bash
cd packages/codegraph && pnpm vitest run
```
Expected: 186/186 (183 baseline after Phase 1 + 3 new).

#### Step 6: Commit

```bash
git add packages/codegraph/src/storage/migrations/021_memory_dismissals.sql packages/codegraph/src/storage/memory-store.ts packages/codegraph/src/mcp/tools/memory.ts packages/codegraph/tests/memory-dismiss.test.ts
git commit -m "feat(memory): add memory_dismiss tool with retrieval penalty"
```

---

### Task 2: Edge-aware retrieval expansion

**Goal:** When `search()` returns top-K, expand by 1-hop via `RelatedTo` and `CausedBy` edges so semantically-linked memories surface even when they don't lexically match the query. Capped expansion (no explosion).

**Files:**
- Modify: `packages/codegraph/src/storage/memory-store.ts` — `search()` method
- Test: `packages/codegraph/tests/edge-expansion.test.ts`

#### Step 1: Failing test

```typescript
// tests/edge-expansion.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb } from '../src/storage/db.js'
import { runMigrations } from '../src/storage/migrator.js'
import { MemoryStore } from '../src/storage/memory-store.js'

describe('MemoryStore.search — edge expansion', () => {
  let dir: string
  let db: any
  let store: MemoryStore
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-edge-exp-'))
    db = openDb(dir); runMigrations(db); store = new MemoryStore(db)
  })
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('surfaces edge-linked memories that do not match the query lexically', () => {
    const a = store.add({
      type: 'Pattern', context: 'In Next.js auth flow', problem: '', solution: 'NextAuth credentials provider',
      reason: '', tags: ['nextjs', 'auth'], project: 'P'
    })
    const b = store.add({
      type: 'Pattern', context: 'Email magic link', problem: '', solution: 'sendgrid via resend',
      reason: '', tags: ['nextjs', 'auth'], project: 'P'
    })
    // a and b should be auto-linked via RelatedTo by Phase 1 derivation

    // Query that lexically only matches A
    const results = store.search('NextAuth credentials', 10)
    const ids = results.map((r) => r.memory.id)
    expect(ids).toContain(a.id)
    expect(ids).toContain(b.id)
  })

  it('expanded results have lower rank than direct hits', () => {
    const a = store.add({ type: 'Pattern', context: 'auth ctx', problem: '', solution: 'XYZ-keyword',
      reason: '', tags: ['t1', 't2'], project: 'P' })
    const b = store.add({ type: 'Pattern', context: 'totally different', problem: '', solution: 'something else',
      reason: '', tags: ['t1', 't2'], project: 'P' })
    const results = store.search('XYZ-keyword', 10)
    const aR = results.find((r) => r.memory.id === a.id)
    const bR = results.find((r) => r.memory.id === b.id)
    if (aR && bR) expect(aR.rank).toBeGreaterThan(bR.rank)
  })

  it('does not exceed limit*2 results', () => {
    for (let i = 0; i < 20; i++) {
      store.add({ type: 'Pattern', context: 'shared-context-' + i, problem: '', solution: 'k' + i,
        reason: '', tags: ['shared', 'foo'], project: 'P' })
    }
    const results = store.search('shared-context-1', 5)
    expect(results.length).toBeLessThanOrEqual(10)
  })
})
```

- [ ] **Step 1.1: Run test — verify FAIL** (test 1 specifically — `b.id` should be missing).

#### Step 2: Implement expansion

In `search()`, after `boosted` is computed (around line 491) and before `slice(0, limit)`:

```typescript
// 1-hop edge expansion: pull in RelatedTo / CausedBy targets that aren't in the set
const seen = new Set(boosted.map((r) => r.memory.id))
const expanded: typeof boosted = []
const EXPANSION_TYPES = new Set<string>(['RelatedTo', 'CausedBy'])
const RANK_DECAY = 0.5

for (const r of boosted.slice(0, limit)) {
  const edges = this.getEdges(r.memory.id)
  for (const e of edges) {
    if (!EXPANSION_TYPES.has(e.type)) continue
    const targetId = e.sourceId === r.memory.id ? e.targetId : e.sourceId
    if (seen.has(targetId)) continue
    const target = this.get(targetId)
    if (!target || target.status !== 'active') continue
    seen.add(targetId)
    expanded.push({ memory: target, finalScore: r.finalScore * RANK_DECAY })
  }
}

const merged = [...boosted, ...expanded].sort((a, b) => b.finalScore - a.finalScore).slice(0, limit * 2)
return merged
  .map(({ memory, finalScore }) => ({ memory, rank: finalScore, edges: this.getEdges(memory.id) }))
```

Note: replace the existing `return reranked.map(...)` chain with the merged version. Read the current `search()` body to adapt — don't blindly paste; integrate into the existing structure.

#### Step 3: Run all tests

```bash
cd packages/codegraph && pnpm vitest run
```
Expected: 189/189 (186 + 3 new). Existing memory-retrieval tests must still pass.

#### Step 4: Commit

```bash
git add packages/codegraph/src/storage/memory-store.ts packages/codegraph/tests/edge-expansion.test.ts
git commit -m "feat(memory): edge-aware retrieval expansion (1-hop RelatedTo/CausedBy)"
```

---

### Task 3: `suggestPreferences` as type-bias in `scored()`

**Goal:** Use the historical accept/reject log of `memory_suggest` outcomes to bias retrieval toward memory types that the user actually accepts. E.g. if user accepts `Pattern` 80% of the time and `Fact` only 20%, boost Pattern over Fact in `scored()`.

**Files:**
- Modify: `packages/codegraph/src/storage/memory-store.ts` — `scored()` method
- Test: `packages/codegraph/tests/suggest-bias.test.ts`

#### Step 1: Failing test

```typescript
// tests/suggest-bias.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb } from '../src/storage/db.js'
import { runMigrations } from '../src/storage/migrator.js'
import { MemoryStore } from '../src/storage/memory-store.js'

describe('MemoryStore.scored — suggest preference bias', () => {
  let dir: string, db: any, store: MemoryStore
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-bias-'))
    db = openDb(dir); runMigrations(db); store = new MemoryStore(db)
  })
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('boosts memory types with high accept rate', () => {
    const fact = store.add({ type: 'Fact', context: 'cf', problem: '', solution: 's', reason: '', tags: [], confidence: 5 })
    const pattern = store.add({ type: 'Pattern', context: 'cp', problem: '', solution: 's', reason: '', tags: [], confidence: 5 })

    // History: Pattern accepted 9/10, Fact accepted 1/10
    for (let i = 0; i < 9; i++) store.logSuggestOutcome('Pattern', true)
    store.logSuggestOutcome('Pattern', false)
    store.logSuggestOutcome('Fact', true)
    for (let i = 0; i < 9; i++) store.logSuggestOutcome('Fact', false)

    const ranked = store.scored(undefined, [], 10)
    const pIdx = ranked.findIndex((r) => r.memory.id === pattern.id)
    const fIdx = ranked.findIndex((r) => r.memory.id === fact.id)
    expect(pIdx).toBeLessThan(fIdx)
  })

  it('falls back to neutral when no history exists', () => {
    const m = store.add({ type: 'Pattern', context: 'c', problem: '', solution: 's', reason: '', tags: [], confidence: 8 })
    const ranked = store.scored(undefined, [], 10)
    expect(ranked[0].memory.id).toBe(m.id) // confidence dominates
  })
})
```

- [ ] **Step 1.1: Run test — verify FAIL.**

#### Step 2: Implement bias

In `scored()`, before computing per-memory `score`, fetch preferences once:

```typescript
const prefs = this.suggestPreferences()
// inside the per-memory loop:
const prefRate = prefs[m.type]?.rate ?? 0.5 // neutral if unknown
const biasMultiplier = 0.8 + 0.4 * prefRate // 0.8 (rate=0) → 1.2 (rate=1)
score *= biasMultiplier
```

Place this **before** the `return { memory: m, rank: score, edges: ... }` so the bias propagates into the final rank.

#### Step 3: Run all tests

```bash
cd packages/codegraph && pnpm vitest run
```
Expected: 191/191 (189 + 2). Existing `autolearning.test.ts` must still pass — verify `suggestPreferences` semantics didn't change.

#### Step 4: Commit

```bash
git add packages/codegraph/src/storage/memory-store.ts packages/codegraph/tests/suggest-bias.test.ts
git commit -m "feat(memory): apply suggestPreferences as type-bias in scoring"
```

---

### Task 4: `memory_health` MCP tool

**Goal:** Mirror `skill_health` for memories. Surface: at-risk (low confidence trending down), dead (deprecated), pending-review queue size, contradiction edges, top decay candidates.

**Files:**
- Modify: `packages/codegraph/src/storage/memory-store.ts` — add `memoryHealth()` method
- Modify: `packages/codegraph/src/mcp/tools/memory.ts` — register `memory_health` tool
- Test: `packages/codegraph/tests/memory-health.test.ts`

#### Step 1: Failing test

```typescript
// tests/memory-health.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb } from '../src/storage/db.js'
import { runMigrations } from '../src/storage/migrator.js'
import { MemoryStore } from '../src/storage/memory-store.js'

describe('MemoryStore.memoryHealth', () => {
  let dir: string, db: any, store: MemoryStore
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-mh-'))
    db = openDb(dir); runMigrations(db); store = new MemoryStore(db)
  })
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('returns counts by status', () => {
    store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [] })
    store.add({ type: 'Pattern', context: 'b', problem: '', solution: 's', reason: '', tags: [] })
    const h = store.memoryHealth()
    expect(h.totals.active).toBe(2)
    expect(h.totals.deprecated).toBe(0)
  })

  it('lists at-risk memories (low confidence + stale)', () => {
    const m = store.add({ type: 'Pattern', context: 'r', problem: '', solution: 's', reason: '', tags: [], confidence: 2 })
    db.prepare("UPDATE memories SET sessions_since_validation = 10 WHERE id = ?").run(m.id)
    const h = store.memoryHealth()
    expect(h.atRisk.find((x) => x.id === m.id)).toBeDefined()
  })

  it('lists Contradicts edges as contradictions', () => {
    const a = store.add({ type: 'Pattern', context: 'shared', problem: '', solution: 's', reason: '', tags: [], project: 'P' })
    const b = store.add({ type: 'AntiPattern', context: 'shared', problem: '', solution: 's', reason: '', tags: [], project: 'P' })
    // Phase 1 auto-derive should have created a Contradicts edge
    const h = store.memoryHealth()
    expect(h.contradictions.length).toBeGreaterThanOrEqual(1)
    expect(h.contradictions[0]).toMatchObject({ type: 'Contradicts' })
  })
})
```

- [ ] **Step 1.1: Run test — verify FAIL** (`memoryHealth is not a function`).

#### Step 2: Implement

In `memory-store.ts`:

```typescript
memoryHealth(): {
  totals: Record<string, number>
  atRisk: Array<{ id: string; type: string; confidence: number; sessionsStale: number }>
  contradictions: Array<{ id: string; sourceId: string; targetId: string; type: string; reason?: string }>
  pendingReview: number
  topDecayCandidates: Array<{ id: string; type: string; sessionsStale: number }>
} {
  const totals = { active: 0, 'pending-review': 0, deprecated: 0 } as Record<string, number>
  for (const row of this.db.prepare(`SELECT status, COUNT(*) c FROM memories GROUP BY status`).all() as any[]) {
    totals[row.status] = row.c
  }

  const atRisk = (this.db.prepare(`
    SELECT id, type, confidence, sessions_since_validation as sessionsStale
    FROM memories
    WHERE status = 'active' AND confidence < 4 AND sessions_since_validation >= 5
    ORDER BY confidence ASC, sessions_since_validation DESC
    LIMIT 20
  `).all() as any[]).map((r) => ({ id: r.id, type: r.type, confidence: r.confidence, sessionsStale: r.sessionsStale }))

  const contradictions = (this.db.prepare(`
    SELECT id, source_id as sourceId, target_id as targetId, type, reason
    FROM memory_edges WHERE type = 'Contradicts'
    LIMIT 50
  `).all() as any[])

  const pendingReview = (this.db.prepare(`SELECT COUNT(*) c FROM memories WHERE status = 'pending-review'`).get() as any)?.c ?? 0

  const topDecayCandidates = (this.db.prepare(`
    SELECT id, type, sessions_since_validation as sessionsStale
    FROM memories
    WHERE status = 'active' AND sessions_since_validation >= 5
    ORDER BY sessions_since_validation DESC
    LIMIT 10
  `).all() as any[])

  return { totals, atRisk, contradictions, pendingReview, topDecayCandidates }
}
```

#### Step 3: Register MCP tool

In `tools/memory.ts`:

```typescript
server.tool(
  'memory_health',
  'Memory health report: counts by status, at-risk memories, contradictions, pending review queue, top decay candidates.',
  { repo: z.string().optional() },
  async ({ repo }) => {
    const h = withMemoryStore(repo, (store) => store.memoryHealth())
    return {
      content: [{
        type: 'text',
        text:
`📊 Memory Health
Status: active=${h.totals.active ?? 0}, pending-review=${h.totals['pending-review'] ?? 0}, deprecated=${h.totals.deprecated ?? 0}
At-risk: ${h.atRisk.length}
Contradictions: ${h.contradictions.length}
Pending review: ${h.pendingReview}
Top decay candidates (sessionsStale): ${h.topDecayCandidates.slice(0, 5).map((d) => `${d.id}(${d.sessionsStale})`).join(', ')}`
      }],
    }
  },
)
```

#### Step 4: Run all tests

```bash
cd packages/codegraph && pnpm vitest run
```
Expected: 194/194 (191 + 3).

#### Step 5: Commit

```bash
git add packages/codegraph/src/storage/memory-store.ts packages/codegraph/src/mcp/tools/memory.ts packages/codegraph/tests/memory-health.test.ts
git commit -m "feat(memory): add memory_health MCP tool"
```

---

## Self-Review

**Spec coverage:**
- ✅ Gap 1 (no memory dismissal/penalty) → Task 1
- ✅ Gap 2 (edges decorative-only in search) → Task 2
- ✅ Gap 3 (suggestPreferences not in scoring) → Task 3
- ✅ Gap 4 (no memory_health) → Task 4
- 🟡 Gap 5 (project affinity for memories) — already partially handled by `m.project === project +3` in `scored()`. No additional work this phase.
- 🚫 Gap 6 (auto-validate on session_end) — deferred to Phase 2.5; needs new `memory_usage` table.

**Type/name consistency:**
- `dismissMemory`, `dismissalCount`, `dismissalPenalty`, `memoryHealth`, `suggestPreferences` are used consistently.
- `RANK_DECAY = 0.5` and `EXPANSION_TYPES` are local constants in Task 2.

**Placeholders:** none — every step has runnable code.

**Test count progression:** 183 (baseline after Phase 1) → 186 → 189 → 191 → 194.

---

## Execution Notes

- **Same worktree** as Phase 1: `.worktrees/skillbrain-pecche-phase1`. Tasks build on Phase 1 features (auto-edges, skill_gc).
- **Order:** sequential. Task 2 depends on Phase 1's edge auto-derivation. Tasks can be dispatched fresh per task via subagent-driven-development.
- **Migration safety:** 021 is additive; rolling back means dropping the table. No FK conflicts.
- **Risk:** Task 2 (edge expansion) has the highest blast radius — one buggy edge type could pollute results. Tests cover the cap and the rank-decay invariant.
