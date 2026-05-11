# SkillBrain Pecche — Phase 1 Quick Wins

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 7 of the 14 weaknesses identified in the 2026-05-03 audit — the items that are well-scoped, low-risk, and deliverable in one session. Larger items (vector embeddings, monolith refactor, full test-coverage expansion, execution of the 12-point retrieval/autolearning Todo `M-todo-c1786317cf04`) are explicitly deferred to Phase 2 and Phase 3 plans.

**Architecture:** All changes are additive to `packages/codegraph`. No schema migrations. Three subsystems touched:
- `memory-store` — auto-derivation of edges + confidence cap
- `skills-store` — dead-skill GC + Other-bucket recategorization helper
- `http-server` boot — daily decay scheduler

**Tech Stack:** TypeScript, better-sqlite3, Express 5, Vitest. No new runtime deps.

**Out of scope (separate plans):**
- Vector embeddings (item #3) — needs design session: model choice, infra, rollout
- Monolith → workspaces split (item #10) — partially covered by `2026-05-03-skillbrain-hardening.md`; full split needs its own plan
- Test coverage expansion for routing/retrieval (item #11) — its own plan
- Phase B/C of the 12-point retrieval/autolearning Todo — execute via `superpowers:executing-plans` against the existing Decision memory `M-decision-9dd5d3b4d1ae`

---

## File Structure

**Created:**
- `packages/codegraph/src/storage/memory-edge-derivation.ts` — pure functions that score edge candidates
- `packages/codegraph/scripts/backfill-edges.ts` — one-off CLI to derive edges for existing memories
- `packages/codegraph/scripts/recategorize-other-skills.ts` — proposes category for skills currently in "Other"
- `packages/codegraph/src/storage/decay-scheduler.ts` — wraps `runDailyDecay` in setInterval
- `packages/codegraph/tests/memory-edge-derivation.test.ts`
- `packages/codegraph/tests/skill-gc.test.ts`
- `packages/codegraph/tests/confidence-cap.test.ts`
- `packages/codegraph/tests/decay-scheduler.test.ts`

**Modified:**
- `packages/codegraph/src/storage/memory-store.ts` — call edge derivation in `add()`, cap confidence
- `packages/codegraph/src/storage/skills-store.ts` — add `gcDeadSkills()` method
- `packages/codegraph/src/mcp/tools/memory.ts` — pass derivation hook
- `packages/codegraph/src/mcp/tools/skills.ts` — register `skill_gc` tool
- `packages/codegraph/src/mcp/http-server.ts` — start decay scheduler on boot
- `CLAUDE.md` (project) — note that local `.claude/skill/` and `.agents/skills/` mirrors are deprecated

---

### Task 1: Edge auto-derivation — pure scoring functions

**Goal:** Given a new memory and the store, produce a list of `(targetId, edgeType, reason)` candidates using deterministic heuristics. No persistence in this task.

**Files:**
- Create: `packages/codegraph/src/storage/memory-edge-derivation.ts`
- Test: `packages/codegraph/tests/memory-edge-derivation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/memory-edge-derivation.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { deriveEdgeCandidates } from '../src/storage/memory-edge-derivation.js'
import type { Memory } from '../src/storage/memory-store.js'

const mem = (over: Partial<Memory>): Memory => ({
  id: over.id || 'm-x',
  type: 'Pattern',
  status: 'active',
  scope: 'team',
  project: over.project,
  skill: over.skill,
  context: over.context || '',
  problem: '',
  solution: '',
  reason: '',
  confidence: 5,
  importance: 5,
  tags: over.tags || [],
  createdAt: '2026-05-03T00:00:00Z',
  updatedAt: '2026-05-03T00:00:00Z',
  sessionsSinceValidation: 0,
  validatedBy: [],
  ...over,
})

describe('deriveEdgeCandidates', () => {
  it('returns empty when no candidates match', () => {
    const subject = mem({ id: 'm-1', project: 'A', tags: ['x'] })
    const others: Memory[] = [mem({ id: 'm-2', project: 'B', tags: ['y'] })]
    expect(deriveEdgeCandidates(subject, others)).toEqual([])
  })

  it('emits RelatedTo when same project + tag overlap >= 2', () => {
    const subject = mem({ id: 'm-1', project: 'A', tags: ['nextjs', 'auth', 'oauth'] })
    const others: Memory[] = [
      mem({ id: 'm-2', project: 'A', tags: ['nextjs', 'auth', 'session'] }),
    ]
    const result = deriveEdgeCandidates(subject, others)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ targetId: 'm-2', type: 'RelatedTo' })
    expect(result[0].reason).toContain('shared project')
  })

  it('emits Contradicts when same context + opposite types (Pattern/AntiPattern)', () => {
    const subject = mem({ id: 'm-1', type: 'AntiPattern', context: 'In Next.js, when using server actions with redirect()' })
    const others: Memory[] = [
      mem({ id: 'm-2', type: 'Pattern', context: 'In Next.js, when using server actions with redirect()' }),
    ]
    const result = deriveEdgeCandidates(subject, others)
    expect(result.find((e) => e.type === 'Contradicts')).toBeDefined()
  })

  it('emits CausedBy when BugFix references AntiPattern with shared tag-skill', () => {
    const subject = mem({ id: 'm-1', type: 'BugFix', tags: ['nextjs', 'skill:nextjs'], context: 'In Next.js auth flow' })
    const others: Memory[] = [
      mem({ id: 'm-2', type: 'AntiPattern', tags: ['nextjs', 'skill:nextjs'], context: 'In Next.js auth flow' }),
    ]
    const result = deriveEdgeCandidates(subject, others)
    expect(result.find((e) => e.type === 'CausedBy' && e.targetId === 'm-2')).toBeDefined()
  })

  it('caps results at top 3 by score', () => {
    const subject = mem({ id: 'm-1', project: 'A', tags: ['a', 'b', 'c'] })
    const others: Memory[] = Array.from({ length: 10 }, (_, i) =>
      mem({ id: `m-${i + 2}`, project: 'A', tags: ['a', 'b', 'c'] })
    )
    expect(deriveEdgeCandidates(subject, others).length).toBeLessThanOrEqual(3)
  })

  it('never derives self-edge', () => {
    const subject = mem({ id: 'm-1', project: 'A', tags: ['a', 'b'] })
    const others: Memory[] = [mem({ id: 'm-1', project: 'A', tags: ['a', 'b'] })]
    expect(deriveEdgeCandidates(subject, others)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
cd packages/codegraph && pnpm vitest run tests/memory-edge-derivation.test.ts
```
Expected: FAIL — `Cannot find module './memory-edge-derivation.js'`

- [ ] **Step 3: Implement minimal module**

```typescript
// src/storage/memory-edge-derivation.ts
import type { Memory, MemoryEdgeType } from './memory-store.js'

export interface EdgeCandidate {
  targetId: string
  type: MemoryEdgeType
  reason: string
  score: number
}

const tagOverlap = (a: string[], b: string[]): number => {
  const setB = new Set(b)
  return a.filter((t) => setB.has(t)).length
}

const contextSimilar = (a: string, b: string): boolean => {
  if (!a || !b) return false
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return true
  // Substring of >= 30 chars in common
  if (na.length >= 30 && nb.includes(na.slice(0, 30))) return true
  if (nb.length >= 30 && na.includes(nb.slice(0, 30))) return true
  return false
}

const opposite = (a: Memory['type'], b: Memory['type']): boolean => {
  const pairs: Array<[Memory['type'], Memory['type']]> = [
    ['Pattern', 'AntiPattern'],
    ['Decision', 'AntiPattern'],
  ]
  return pairs.some(([x, y]) => (a === x && b === y) || (a === y && b === x))
}

export function deriveEdgeCandidates(subject: Memory, candidates: Memory[]): EdgeCandidate[] {
  const out: EdgeCandidate[] = []
  for (const c of candidates) {
    if (c.id === subject.id) continue

    const sameProject = !!subject.project && subject.project === c.project
    const overlap = tagOverlap(subject.tags, c.tags)
    const ctxSim = contextSimilar(subject.context, c.context)

    // CausedBy: BugFix → AntiPattern when share skill-tag and similar context
    if (subject.type === 'BugFix' && c.type === 'AntiPattern' && overlap >= 1 && ctxSim) {
      out.push({ targetId: c.id, type: 'CausedBy', reason: 'BugFix linked to AntiPattern (shared skill + context)', score: 0.9 })
      continue
    }

    // Contradicts: opposite types with same/similar context
    if (opposite(subject.type, c.type) && ctxSim) {
      out.push({ targetId: c.id, type: 'Contradicts', reason: 'opposite types share context', score: 0.85 })
      continue
    }

    // RelatedTo: same project + tag overlap >= 2
    if (sameProject && overlap >= 2) {
      out.push({ targetId: c.id, type: 'RelatedTo', reason: `shared project + ${overlap} tags`, score: 0.5 + 0.1 * overlap })
      continue
    }

    // RelatedTo: tag overlap >= 3 (cross-project)
    if (overlap >= 3) {
      out.push({ targetId: c.id, type: 'RelatedTo', reason: `shared ${overlap} tags`, score: 0.4 + 0.05 * overlap })
    }
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 3)
}
```

- [ ] **Step 4: Run test — verify PASS**

```bash
cd packages/codegraph && pnpm vitest run tests/memory-edge-derivation.test.ts
```
Expected: 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/src/storage/memory-edge-derivation.ts packages/codegraph/tests/memory-edge-derivation.test.ts
git commit -m "feat(memory): add edge candidate derivation heuristics"
```

---

### Task 2: Hook edge derivation into `memory_add`

**Goal:** When a memory is added, automatically persist the top edge candidates so the graph populates over time. Bounded — never more than 3 edges per add.

**Files:**
- Modify: `packages/codegraph/src/storage/memory-store.ts:264-305` (the `add()` method)
- Test: `packages/codegraph/tests/memory-edge-derivation.test.ts` (extend with integration test)

- [ ] **Step 1: Add failing integration test**

Append to `tests/memory-edge-derivation.test.ts`:

```typescript
import { MemoryStore } from '../src/storage/memory-store.js'
import { openDb, closeDb } from '../src/storage/db.js'
import { runMigrations } from '../src/storage/migrator.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('MemoryStore.add — edge auto-derivation', () => {
  let dir: string
  let store: MemoryStore
  let db: ReturnType<typeof openDb>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-edges-'))
    db = openDb(dir)
    runMigrations(db)
    store = new MemoryStore(db)
  })

  afterEach(() => {
    closeDb(db)
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates RelatedTo edges automatically when project + tags overlap', () => {
    const a = store.add({ type: 'Pattern', context: 'A1', problem: '', solution: '', reason: '',
      tags: ['nextjs', 'auth', 'session'], project: 'P' })
    const b = store.add({ type: 'Pattern', context: 'A2', problem: '', solution: '', reason: '',
      tags: ['nextjs', 'auth', 'csrf'], project: 'P' })

    const edges = store.getEdges(b.id)
    expect(edges.find((e) => e.targetId === a.id && e.type === 'RelatedTo')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
cd packages/codegraph && pnpm vitest run tests/memory-edge-derivation.test.ts -t "edge auto-derivation"
```
Expected: FAIL — no edge created

- [ ] **Step 3: Modify `MemoryStore.add()`**

In `src/storage/memory-store.ts`, after line 304 (`return memory`) — wait, before it. Replace the tail of `add()`:

```typescript
    // Populate FTS
    this.populateFts(memory)

    // Auto-derive edges (best-effort, never throws)
    try {
      const candidates = this.queryRecentForDerivation(memory)
      const edges = deriveEdgeCandidates(memory, candidates)
      for (const e of edges) {
        this.addEdge(memory.id, e.targetId, e.type, e.reason)
      }
    } catch (err) {
      // log only — never block memory_add on edge derivation failure
      console.error('[memory-store] edge derivation failed', err)
    }

    return memory
  }

  private queryRecentForDerivation(subject: Memory): Memory[] {
    // Pull a bounded candidate set: same project (if any) OR tag-overlap candidates from last 200 memories.
    const sql = `
      SELECT * FROM memories
      WHERE status = 'active' AND id != ?
        AND (project = ? OR tags LIKE ? OR tags LIKE ?)
      ORDER BY updated_at DESC
      LIMIT 200
    `
    const tagLike1 = subject.tags[0] ? `%"${subject.tags[0]}"%` : '%'
    const tagLike2 = subject.tags[1] ? `%"${subject.tags[1]}"%` : '%'
    const rows = this.db.prepare(sql).all(subject.id, subject.project ?? '', tagLike1, tagLike2) as any[]
    return rows.map((r) => this.rowToMemory(r))
  }
```

Add the import at the top of `memory-store.ts`:

```typescript
import { deriveEdgeCandidates } from './memory-edge-derivation.js'
```

- [ ] **Step 4: Run all memory tests — verify PASS**

```bash
cd packages/codegraph && pnpm vitest run tests/memory-edge-derivation.test.ts tests/memory-retrieval.test.ts
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/src/storage/memory-store.ts packages/codegraph/tests/memory-edge-derivation.test.ts
git commit -m "feat(memory): auto-derive edges on memory_add"
```

---

### Task 3: Backfill edges for existing memories

**Goal:** Populate the now-empty `memory_edges` table for all 178 existing memories using the same derivation logic, in one batch run.

**Files:**
- Create: `packages/codegraph/scripts/backfill-edges.ts`

- [ ] **Step 1: Write the script**

```typescript
// scripts/backfill-edges.ts
import { openDb, closeDb } from '../src/storage/db.js'
import { MemoryStore } from '../src/storage/memory-store.js'
import { deriveEdgeCandidates } from '../src/storage/memory-edge-derivation.js'

const root = process.env.SKILLBRAIN_ROOT || process.cwd()
const db = openDb(root)
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
    store.addEdge(subject.id, e.targetId, e.type, e.reason)
    created++
  }
}

console.log(`[backfill-edges] created ${created} edges, skipped ${skipped} memories with existing edges`)
closeDb(db)
```

- [ ] **Step 2: Add npm script**

In `packages/codegraph/package.json` `"scripts"`:

```json
"backfill:edges": "tsx scripts/backfill-edges.ts"
```

- [ ] **Step 3: Dry-run on a copy of the prod DB**

```bash
cp /data/.codegraph/graph.db /tmp/graph.db.backup
SKILLBRAIN_ROOT=/tmp pnpm backfill:edges
```
Expected: stdout shows `[backfill-edges] scanning 178 memories… created N edges`

- [ ] **Step 4: Verify edge count went from 0 to >0**

```bash
sqlite3 /tmp/.codegraph/graph.db "SELECT COUNT(*) FROM memory_edges"
```
Expected: a positive integer

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/scripts/backfill-edges.ts packages/codegraph/package.json
git commit -m "feat(memory): add backfill script for existing memories"
```

---

### Task 4: Dead skill GC — `skill_gc` tool

**Goal:** Add a method to mark skills as `deprecated` when they were routed ≥ N times in the last 30 days but never loaded. Expose via MCP tool. Reversible (status flag, not deletion).

**Files:**
- Modify: `packages/codegraph/src/storage/skills-store.ts`
- Modify: `packages/codegraph/src/mcp/tools/skills.ts`
- Test: `packages/codegraph/tests/skill-gc.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/skill-gc.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb } from '../src/storage/db.js'
import { runMigrations } from '../src/storage/migrator.js'
import { SkillsStore } from '../src/storage/skills-store.js'

describe('SkillsStore.gcDeadSkills', () => {
  let dir: string
  let db: any
  let store: SkillsStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-gc-'))
    db = openDb(dir)
    runMigrations(db)
    store = new SkillsStore(db)
  })

  afterEach(() => {
    closeDb(db)
    rmSync(dir, { recursive: true, force: true })
  })

  it('marks skills as deprecated when routed >= threshold but never loaded', () => {
    store.upsert({ name: 'dead-skill', category: 'Other', description: 'd', content: 'c', type: 'process', tags: [], lines: 1 })
    store.upsert({ name: 'live-skill', category: 'Other', description: 'd', content: 'c', type: 'process', tags: [], lines: 1 })

    // Simulate routing dead-skill 3x with no loads (test helper inserts directly into routing telemetry)
    db.prepare(`INSERT INTO skill_route_telemetry (skill_name, routed_at, loaded) VALUES (?, datetime('now'), 0)`).run('dead-skill')
    db.prepare(`INSERT INTO skill_route_telemetry (skill_name, routed_at, loaded) VALUES (?, datetime('now'), 0)`).run('dead-skill')
    db.prepare(`INSERT INTO skill_route_telemetry (skill_name, routed_at, loaded) VALUES (?, datetime('now'), 0)`).run('dead-skill')

    db.prepare(`INSERT INTO skill_route_telemetry (skill_name, routed_at, loaded) VALUES (?, datetime('now'), 1)`).run('live-skill')

    const result = store.gcDeadSkills({ threshold: 3, days: 30, dryRun: false })
    expect(result.deprecated).toContain('dead-skill')
    expect(result.deprecated).not.toContain('live-skill')

    const dead = db.prepare(`SELECT status FROM skills WHERE name = 'dead-skill'`).get() as any
    expect(dead.status).toBe('deprecated')
  })

  it('dryRun does not mutate', () => {
    store.upsert({ name: 'dead-x', category: 'Other', description: 'd', content: 'c', type: 'process', tags: [], lines: 1 })
    db.prepare(`INSERT INTO skill_route_telemetry (skill_name, routed_at, loaded) VALUES (?, datetime('now'), 0)`).run('dead-x')
    db.prepare(`INSERT INTO skill_route_telemetry (skill_name, routed_at, loaded) VALUES (?, datetime('now'), 0)`).run('dead-x')
    db.prepare(`INSERT INTO skill_route_telemetry (skill_name, routed_at, loaded) VALUES (?, datetime('now'), 0)`).run('dead-x')

    const result = store.gcDeadSkills({ threshold: 3, days: 30, dryRun: true })
    expect(result.deprecated).toContain('dead-x')
    const dead = db.prepare(`SELECT status FROM skills WHERE name = 'dead-x'`).get() as any
    expect(dead.status).toBe('active')
  })
})
```

> **Note:** if the table is named differently (e.g. `skill_routes` instead of `skill_route_telemetry`), check `src/storage/migrations/*.sql` and adjust the test query AND the implementation. Run `sqlite3 /tmp/.codegraph/graph.db ".schema" | grep -i route` to confirm.

- [ ] **Step 2: Run test — verify FAIL**

```bash
cd packages/codegraph && pnpm vitest run tests/skill-gc.test.ts
```
Expected: FAIL — `gcDeadSkills is not a function`

- [ ] **Step 3: Implement in `skills-store.ts`**

Add to `SkillsStore`:

```typescript
  gcDeadSkills(opts: { threshold: number; days: number; dryRun: boolean }): { deprecated: string[]; scanned: number } {
    const sql = `
      SELECT s.name,
        SUM(CASE WHEN t.loaded = 0 THEN 1 ELSE 0 END) AS routed_no_load,
        SUM(CASE WHEN t.loaded = 1 THEN 1 ELSE 0 END) AS loaded_count
      FROM skills s
      LEFT JOIN skill_route_telemetry t
        ON t.skill_name = s.name
        AND t.routed_at >= datetime('now', ?)
      WHERE s.status = 'active'
      GROUP BY s.name
      HAVING routed_no_load >= ? AND loaded_count = 0
    `
    const rows = this.db.prepare(sql).all(`-${opts.days} days`, opts.threshold) as any[]
    const dead = rows.map((r) => r.name as string)

    if (!opts.dryRun && dead.length > 0) {
      const update = this.db.prepare(`UPDATE skills SET status = 'deprecated', updated_at = datetime('now') WHERE name = ?`)
      const tx = this.db.transaction((names: string[]) => { for (const n of names) update.run(n) })
      tx(dead)
    }

    return { deprecated: dead, scanned: rows.length }
  }
```

- [ ] **Step 4: Register MCP tool**

In `src/mcp/tools/skills.ts`, add:

```typescript
  server.tool(
    'skill_gc',
    'Garbage-collect skills routed >= threshold times in the last N days but never loaded. Marks them deprecated (reversible).',
    {
      threshold: z.number().int().min(1).default(3),
      days: z.number().int().min(1).default(30),
      dryRun: z.boolean().default(true),
      repo: z.string().optional(),
    },
    async ({ threshold, days, dryRun, repo }) => {
      const result = withSkillsStore(repo, (store) => store.gcDeadSkills({ threshold, days, dryRun }))
      return {
        content: [{
          type: 'text',
          text: `skill_gc (dryRun=${dryRun}): ${result.deprecated.length} skills marked dead\n${result.deprecated.map((n) => `  - ${n}`).join('\n')}`,
        }],
      }
    },
  )
```

- [ ] **Step 5: Run all tests**

```bash
cd packages/codegraph && pnpm vitest run tests/skill-gc.test.ts tests/skill-routing.test.ts tests/skills-usage.test.ts
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add packages/codegraph/src/storage/skills-store.ts packages/codegraph/src/mcp/tools/skills.ts packages/codegraph/tests/skill-gc.test.ts
git commit -m "feat(skills): add skill_gc to deprecate dead-routed skills"
```

---

### Task 5: Recategorize "Other" skills helper

**Goal:** Print a proposal mapping each skill currently in category "Other" to a better category (or to "deprecated" if a candidate for GC). Action is manual review — script outputs JSON for inspection, never auto-applies.

**Files:**
- Create: `packages/codegraph/scripts/recategorize-other-skills.ts`

- [ ] **Step 1: Write the script**

```typescript
// scripts/recategorize-other-skills.ts
import { openDb, closeDb } from '../src/storage/db.js'
import { SkillsStore } from '../src/storage/skills-store.js'

const root = process.env.SKILLBRAIN_ROOT || process.cwd()
const db = openDb(root)
const store = new SkillsStore(db)

const KEYWORD_MAP: Array<[RegExp, string]> = [
  [/seo|sitemap|schema|meta-tag|geo|llm-search/i, 'SEO'],
  [/copy|growth|cro|landing|funnel|saas-copy/i, 'Marketing'],
  [/component|button|ui|tailwind|shadcn|design/i, 'Frontend'],
  [/api|rest|graphql|endpoint|server-action/i, 'Backend'],
  [/cms|payload|wordpress|shopify/i, 'CMS'],
  [/docker|coolify|deploy|ci|cd|github-actions/i, 'Infrastructure'],
  [/security|auth|oauth|csrf|xss/i, 'Security'],
  [/legal|gdpr|privacy|cookie|tos/i, 'Legal'],
  [/perf|performance|core-web-vital|lighthouse/i, 'Performance'],
  [/n8n|workflow|automation/i, 'Automation'],
  [/test|playwright|vitest/i, 'Testing'],
  [/db|database|sqlite|postgres|migration/i, 'Backend'],
]

const others = store.list().filter((s) => s.category === 'Other')

const proposals = others.map((s) => {
  const haystack = `${s.name} ${s.description} ${s.tags.join(' ')}`.toLowerCase()
  const match = KEYWORD_MAP.find(([re]) => re.test(haystack))
  return {
    name: s.name,
    currentCategory: s.category,
    proposedCategory: match ? match[1] : 'Other',
    reason: match ? `keyword match: ${match[0].source}` : 'no keyword match — manual review',
    description: s.description,
  }
})

console.log(JSON.stringify({ scanned: others.length, proposals }, null, 2))
closeDb(db)
```

- [ ] **Step 2: Add npm script**

In `packages/codegraph/package.json`:

```json
"recategorize:other": "tsx scripts/recategorize-other-skills.ts"
```

- [ ] **Step 3: Dry-run and review proposals**

```bash
SKILLBRAIN_ROOT=/data pnpm recategorize:other > /tmp/recategorize-proposals.json
cat /tmp/recategorize-proposals.json | jq '.proposals | group_by(.proposedCategory) | map({cat: .[0].proposedCategory, count: length})'
```

- [ ] **Step 4: User reviews JSON, then applies via SQL**

After human review, the user runs targeted SQL on the prod DB. Script does NOT auto-apply.

```bash
# Example after review:
sqlite3 /data/.codegraph/graph.db "UPDATE skills SET category = 'SEO' WHERE name IN ('ai-seo', 'geo-content')"
```

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/scripts/recategorize-other-skills.ts packages/codegraph/package.json
git commit -m "chore(skills): add recategorization helper for Other-bucket"
```

---

### Task 6: Daily decay scheduler

**Goal:** Run `MemoryStore.runDailyDecay()` once per 24h on the running http-server. Idempotent — safe if invoked multiple times. Disable via env var for tests.

**Files:**
- Create: `packages/codegraph/src/storage/decay-scheduler.ts`
- Modify: `packages/codegraph/src/mcp/http-server.ts` — call `startDecayScheduler()` after server boot
- Test: `packages/codegraph/tests/decay-scheduler.test.ts`

- [ ] **Step 1: Find the existing daily-decay entry point**

```bash
cd packages/codegraph && grep -n "runDailyDecay\|applyDecay" src/storage/memory-store.ts
```
Expected: lines around 980 — confirm a public method exists; if not, expose one wrapping `applyDecay([], today)`.

- [ ] **Step 2: Write the failing test**

```typescript
// tests/decay-scheduler.test.ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { startDecayScheduler } from '../src/storage/decay-scheduler.js'

describe('startDecayScheduler', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('calls runner immediately on start', () => {
    const runner = vi.fn()
    startDecayScheduler({ runner, intervalMs: 60_000 })
    expect(runner).toHaveBeenCalledTimes(1)
  })

  it('calls runner once per interval', () => {
    const runner = vi.fn()
    const stop = startDecayScheduler({ runner, intervalMs: 60_000 })
    vi.advanceTimersByTime(60_000)
    expect(runner).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(60_000)
    expect(runner).toHaveBeenCalledTimes(3)
    stop()
  })

  it('returns a stop fn that halts future runs', () => {
    const runner = vi.fn()
    const stop = startDecayScheduler({ runner, intervalMs: 60_000 })
    stop()
    vi.advanceTimersByTime(120_000)
    expect(runner).toHaveBeenCalledTimes(1)
  })

  it('swallows runner errors', () => {
    const runner = vi.fn().mockImplementation(() => { throw new Error('boom') })
    expect(() => startDecayScheduler({ runner, intervalMs: 60_000 })).not.toThrow()
  })
})
```

- [ ] **Step 3: Run — verify FAIL**

```bash
cd packages/codegraph && pnpm vitest run tests/decay-scheduler.test.ts
```

- [ ] **Step 4: Implement scheduler**

```typescript
// src/storage/decay-scheduler.ts
export interface DecaySchedulerOpts {
  runner: () => void | Promise<void>
  intervalMs: number
}

export function startDecayScheduler(opts: DecaySchedulerOpts): () => void {
  const safeRun = async () => {
    try {
      await opts.runner()
    } catch (err) {
      console.error('[decay-scheduler] runner failed', err)
    }
  }

  void safeRun()
  const handle = setInterval(safeRun, opts.intervalMs)
  return () => clearInterval(handle)
}
```

- [ ] **Step 5: Wire into http-server boot**

In `src/mcp/http-server.ts`, after the server starts listening:

```typescript
import { startDecayScheduler } from '../storage/decay-scheduler.js'
import { MemoryStore } from '../storage/memory-store.js'
// ...
if (process.env.SKILLBRAIN_DECAY_DISABLED !== '1') {
  const memStore = new MemoryStore(db)
  startDecayScheduler({
    runner: () => memStore.runDailyDecay(),
    intervalMs: 24 * 60 * 60 * 1000,
  })
}
```

If `runDailyDecay()` does not exist as a public method, add it to `MemoryStore`:

```typescript
  runDailyDecay(): DecayResult {
    const today = new Date().toISOString().split('T')[0]
    return this.applyDecay([], today)
  }
```

- [ ] **Step 6: Run all tests + verify boot**

```bash
cd packages/codegraph && pnpm vitest run && pnpm build
SKILLBRAIN_DECAY_DISABLED=0 node dist/cli.js mcp --http &
sleep 3 && pkill -f "dist/cli.js mcp"
```
Expected: log line `[decay-scheduler] runner` (or similar) on start.

- [ ] **Step 7: Commit**

```bash
git add packages/codegraph/src/storage/decay-scheduler.ts packages/codegraph/src/mcp/http-server.ts packages/codegraph/src/storage/memory-store.ts packages/codegraph/tests/decay-scheduler.test.ts
git commit -m "feat(memory): add daily decay scheduler on http-server boot"
```

---

### Task 7: Server-side confidence cap

**Goal:** Stop confidence inflation. Cap initial confidence on `memory_add` at server level: Pattern/BugFix/Fact ≤ 8; AntiPattern/Decision ≤ 10. Caller can pass higher values but they get clamped.

**Files:**
- Modify: `packages/codegraph/src/storage/memory-store.ts` — in `add()`, clamp before insert
- Test: `packages/codegraph/tests/confidence-cap.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/confidence-cap.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb } from '../src/storage/db.js'
import { runMigrations } from '../src/storage/migrator.js'
import { MemoryStore } from '../src/storage/memory-store.js'

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
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('caps Pattern confidence at 8 even if 10 is passed', () => {
    const m = store.add({ type: 'Pattern', context: 'c', problem: '', solution: '', reason: '', tags: [], confidence: 10 })
    expect(m.confidence).toBeLessThanOrEqual(8)
  })

  it('allows Decision confidence at 10', () => {
    const m = store.add({ type: 'Decision', context: 'c', problem: '', solution: '', reason: '', tags: [], confidence: 10 })
    expect(m.confidence).toBe(10)
  })

  it('preserves lower confidence values', () => {
    const m = store.add({ type: 'Pattern', context: 'c', problem: '', solution: '', reason: '', tags: [], confidence: 4 })
    expect(m.confidence).toBe(4)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/codegraph && pnpm vitest run tests/confidence-cap.test.ts
```
Expected: 1st test fails (confidence comes back as 10).

- [ ] **Step 3: Add the cap in `add()`**

In `memory-store.ts`, near the start of `add()` where `input.confidence` is read:

```typescript
const INITIAL_CAPS: Record<MemoryType, number> = {
  Pattern: 8,
  BugFix: 8,
  Fact: 6,
  Goal: 8,
  Todo: 8,
  AntiPattern: 10,
  Decision: 10,
}

// inside add():
const requested = input.confidence ?? 1
const cap = INITIAL_CAPS[input.type] ?? 8
const confidence = Math.min(requested, cap)
```

Wire `confidence` (capped) into the `INSERT` instead of `input.confidence`. Place the constant at module top.

- [ ] **Step 4: Run — verify PASS**

```bash
cd packages/codegraph && pnpm vitest run tests/confidence-cap.test.ts tests/memory-retrieval.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/src/storage/memory-store.ts packages/codegraph/tests/confidence-cap.test.ts
git commit -m "fix(memory): cap initial confidence by type to combat inflation"
```

---

### Task 8: Mirror cleanup decision (manual, user-gated)

**Goal:** Resolve the contradiction in CLAUDE.md (which says "skills ONLY from MCP, never disk") versus the existence of `.claude/skill/` (120 files) and `.agents/skills/` (112 files). This is **destructive** — must be confirmed by the user before deletion.

**Files:**
- Modify: `CLAUDE.md` — add explicit deprecation note for the mirrors
- Create (optional): `.claude/skill/DEPRECATED.md` and `.agents/skills/DEPRECATED.md` — README pointing to MCP

- [ ] **Step 1: Add deprecation note to project CLAUDE.md**

Append to the "Architecture" section of `CLAUDE.md`:

```markdown
> **DEPRECATED**: `.claude/skill/` and `.agents/skills/` are legacy mirrors. They are no longer the source of truth — all skills live on the MCP server (memory.fl1.it). To load a skill, use `skill_read({ name })`. The on-disk mirrors will be removed in a future release.
```

- [ ] **Step 2: Confirm with user before deletion**

**STOP.** Ask the user:

> "Delete `.claude/skill/` and `.agents/skills/` from the repo? This is irreversible (recoverable only via git). MCP remains source of truth."

If yes:

```bash
git rm -r .claude/skill .agents/skills
git commit -m "chore(skills): remove deprecated on-disk skill mirrors (MCP is source of truth)"
```

If no: stop here. Note in the commit message that the mirror is retained pending decision.

- [ ] **Step 3: Commit CLAUDE.md change**

```bash
git add CLAUDE.md
git commit -m "docs: mark .claude/skill and .agents/skills mirrors as deprecated"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Item #1 (no edges) → Tasks 1+2+3
- ✅ Item #4 (Other bucket) → Task 5
- ✅ Item #5 (dead skills) → Task 4
- ✅ Item #6 (mirror confusion) → Task 8
- ✅ Item #8 (confidence inflation) → Task 7
- ✅ Item #14 (no decay scheduler) → Task 6
- ✅ Item #2 (12-point Todo) → **deferred** to Phase 2 plan (Decision `M-decision-9dd5d3b4d1ae` already specifies it)
- ✅ Item #3 (embeddings) → **deferred** — needs brainstorming
- ✅ Item #7 (Pattern bias) → partially addressed by Task 7 (cap reduces Pattern dominance over time)
- ✅ Item #9 (no contradictions) → Task 1 (Contradicts edge type emitted automatically)
- ✅ Item #10 (monolith) → **deferred**, partial overlap with `2026-05-03-skillbrain-hardening.md`
- ✅ Item #11 (test coverage) → **deferred** — covered partially by tests in Tasks 1, 4, 6, 7
- ✅ Item #12 (master.env adoption) → out of scope (config/UX, not a code defect)
- ✅ Item #13 (Todos count) → addressed implicitly: encourage Todo creation at proxy level (separate plan)

**Type/name consistency:** `gcDeadSkills`, `deriveEdgeCandidates`, `startDecayScheduler`, `runDailyDecay`, `INITIAL_CAPS` are used consistently across tasks.

**Placeholders:** none — every step has runnable code or commands.

---

## Execution Notes

- **Worktree recommended:** these touch the storage layer; isolate with `git worktree add ../skillbrain-pecche-phase1 -b feat/skillbrain-pecche-phase1`.
- **Order:** Tasks 1→2→3 are sequential (edges). Tasks 4, 5, 6, 7 are independent and can be done in parallel by different subagents. Task 8 last.
- **Backfill ordering:** run Task 3 backfill **after** Tasks 1+2 land, so the heuristics are stable.
- **Prod migration:** none. All changes are code-only or non-destructive data ops.
