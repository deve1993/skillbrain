# SkillBrain Retrieval & Auto-Learning Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve skill routing accuracy, memory retrieval relevance, and auto-learning capture rate across 12 targeted enhancements in 3 phases (A: Skill Routing, B: Memory Retrieval, C: Auto-Learning Pipeline).

**Architecture:** All changes are in `packages/codegraph/`. New features follow the established pattern: SQL migration -> store method -> MCP tool wiring. No new dependencies. SQLite FTS5 and BM25 scoring are extended, not replaced.

**Tech Stack:** TypeScript, SQLite (better-sqlite3), FTS5, Vitest, Zod v4

---

## File Map

| File | Responsibility | Phase |
|------|---------------|-------|
| `src/storage/migrations/019_routing_improvements.sql` | Schema: `skill_usage.dismissed`, category boost index | A |
| `src/storage/skills-store.ts` | `route()` rewrite, `recordDismissal()`, `applyDecay()` tuning | A |
| `src/mcp/tools/skills.ts` | `skill_route` context_category param, `skill_dismiss` tool | A |
| `tests/skill-routing.test.ts` | Tests for all Phase A changes | A |
| `src/storage/migrations/020_memory_retrieval.sql` | Schema: tag match index | B |
| `src/storage/memory-store.ts` | `scored()` type weights, `search()` tag boost, cluster boost, dedup | B |
| `src/mcp/tools/memory.ts` | `memory_add` dedup check | B |
| `tests/memory-retrieval.test.ts` | Tests for all Phase B changes | B |
| `src/storage/migrations/021_autolearning.sql` | Schema: `suggest_log` table | C |
| `src/mcp/tools/memory.ts` | `memory_suggest` personalization | C |
| `src/storage/skills-store.ts` | `applyDecay()` threshold changes | C |
| `src/mcp/tools/skills.ts` | auto-linkage in `skill_read` | C |
| `tests/autolearning.test.ts` | Tests for all Phase C changes | C |
| `src/constants.ts` | New constants for thresholds | A,B,C |

---

## Phase A — Skill Routing (Tasks 1-4)

### Task 1: Feedback loop — "applied" action + usefulness boost in route()

Currently `skill_route` records `routed`, `skill_read` records `loaded`, but nothing records `applied`. The `recencyBoost` in `route()` counts loads in 24h — it should weight *applied* skills higher than merely loaded ones.

**Files:**
- Modify: `packages/codegraph/src/storage/skills-store.ts:331-361` (route method)
- Modify: `packages/codegraph/src/storage/skills-store.ts:345-351` (recencyBoost calc)
- Create: `packages/codegraph/tests/skill-routing.test.ts`

- [ ] **Step 1: Write the failing test for applied-weighted recency boost**

```typescript
// packages/codegraph/tests/skill-routing.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/storage/migrator.js'
import { SkillsStore } from '../src/storage/skills-store.js'

const TEST_KEY = 'b'.repeat(64)

describe('SkillsStore.route() scoring', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    const now = new Date().toISOString()
    for (const name of ['nextjs', 'tailwind', 'payments']) {
      store.upsert({
        name, category: 'Frontend', description: `${name} skill for building apps`,
        content: `Full ${name} guide`, type: 'domain',
        tags: [name], lines: 100, updatedAt: now,
      })
    }
  })

  it('applied actions boost recency higher than loaded actions', () => {
    // Load tailwind 3 times
    for (let i = 0; i < 3; i++) {
      store.recordUsage('tailwind', 'loaded', { sessionId: `s${i}` })
    }
    // Apply nextjs once — should still score higher in recency
    store.recordUsage('nextjs', 'applied', { sessionId: 's0' })

    const results = store.route('building frontend apps', 3)
    const names = results.map((r) => r.name)
    const nextjsIdx = names.indexOf('nextjs')
    const tailwindIdx = names.indexOf('tailwind')
    // nextjs with 1 applied should rank >= tailwind with 3 loaded
    expect(nextjsIdx).toBeLessThanOrEqual(tailwindIdx)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/codegraph && npx vitest run tests/skill-routing.test.ts`
Expected: FAIL — applied and loaded are weighted equally in current code

- [ ] **Step 3: Implement applied-weighted recency boost**

In `packages/codegraph/src/storage/skills-store.ts`, add a new prepared statement and modify `route()`:

```typescript
// Add to prepareStatements(), after recentLoadCount (line ~183):
recentAppliedCount: this.db.prepare(`
  SELECT COUNT(*) as count FROM skill_usage
  WHERE skill_name = ? AND action = 'applied' AND ts >= datetime('now', ?)
`),
```

Replace the recencyBoost calculation in `route()` (lines 345-351):

```typescript
const recentCount = (() => {
  try {
    const loaded = (this.stmts.recentLoadCount.get(r.skill.name, '-24 hours') as { count: number } | undefined)?.count ?? 0
    const applied = (this.stmts.recentAppliedCount.get(r.skill.name, '-24 hours') as { count: number } | undefined)?.count ?? 0
    return Math.log1p(loaded + applied * 3)
  } catch { return 0 }
})()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/codegraph && npx vitest run tests/skill-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/src/storage/skills-store.ts packages/codegraph/tests/skill-routing.test.ts
git commit -m "feat(routing): weight applied skills 3x higher than loaded in recency boost"
```

---

### Task 2: Negative routing — dismissed skill penalty

When `skill_route` returns a skill that the user ignores (never reads), that's a weak negative signal. When the user explicitly dismisses it, that's a strong signal. Add a `skill_dismiss` tool and apply a penalty in `route()`.

**Files:**
- Modify: `packages/codegraph/src/storage/skills-store.ts:90-199` (prepareStatements)
- Modify: `packages/codegraph/src/storage/skills-store.ts:331-361` (route method)
- Modify: `packages/codegraph/src/mcp/tools/skills.ts` (new tool)
- Modify: `packages/codegraph/tests/skill-routing.test.ts`

- [ ] **Step 1: Write the failing test for dismissal penalty**

Append to `packages/codegraph/tests/skill-routing.test.ts`:

```typescript
it('dismissed skills receive a penalty in routing', () => {
  // Record multiple dismissals for tailwind
  store.recordUsage('tailwind', 'dismissed', { sessionId: 's1', task: 'build next app' })
  store.recordUsage('tailwind', 'dismissed', { sessionId: 's2', task: 'build next page' })
  store.recordUsage('tailwind', 'dismissed', { sessionId: 's3', task: 'next frontend' })

  // Both nextjs and tailwind match "building frontend apps"
  const results = store.route('building frontend apps', 3)
  const names = results.map((r) => r.name)

  // tailwind should rank lower due to dismissals
  const nextjsIdx = names.indexOf('nextjs')
  const tailwindIdx = names.indexOf('tailwind')
  expect(nextjsIdx).toBeLessThan(tailwindIdx)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/codegraph && npx vitest run tests/skill-routing.test.ts`
Expected: FAIL — 'dismissed' action is not recognized / no penalty applied

- [ ] **Step 3: Update SkillUsageAction type and add dismissal count query**

In `packages/codegraph/src/storage/skills-store.ts`:

Update the type (line 61):
```typescript
export type SkillUsageAction = 'routed' | 'loaded' | 'applied' | 'dismissed'
```

Add prepared statement (after `recentAppliedCount`):
```typescript
dismissalCount: this.db.prepare(`
  SELECT COUNT(*) as count FROM skill_usage
  WHERE skill_name = ? AND action = 'dismissed' AND ts >= datetime('now', '-7 days')
`),
```

- [ ] **Step 4: Add dismissal penalty to route() scoring**

In the `route()` method, after the `coocBoost` calculation (line ~353), add:

```typescript
const dismissalPenalty = (() => {
  try {
    const row = this.stmts.dismissalCount.get(r.skill.name) as { count: number } | undefined
    const count = row?.count ?? 0
    return Math.min(count * 0.05, 0.20)
  } catch { return 0 }
})()
```

Update the final score formula:
```typescript
const score = 0.50 * bm25Norm + 0.20 * confidence + 0.15 * recencyBoost + 0.15 * coocBoost - dismissalPenalty
```

- [ ] **Step 5: Add skill_dismiss MCP tool**

In `packages/codegraph/src/mcp/tools/skills.ts`, after the `skill_route` tool (line ~226), add:

```typescript
server.tool(
  'skill_dismiss',
  'Record that a routed skill was not useful for this task. Helps improve future routing.',
  {
    name: z.string().describe('Skill name to dismiss'),
    task: z.string().optional().describe('Task description for context'),
    sessionId: z.string().optional(),
    project: z.string().optional(),
    repo: z.string().optional(),
  },
  async ({ name, task, sessionId, project, repo }) => {
    const resolved = resolveMemoryRepo(repo)
    if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

    withSkillsStore(resolved.path, (store) => {
      store.recordUsage(name, 'dismissed', { sessionId, project, task, userId: ctx.userId })
    })

    return { content: [{ type: 'text', text: `Noted: "${name}" dismissed for this task.` }] }
  },
)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/codegraph && npx vitest run tests/skill-routing.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/codegraph/src/storage/skills-store.ts packages/codegraph/src/mcp/tools/skills.ts packages/codegraph/tests/skill-routing.test.ts
git commit -m "feat(routing): add skill_dismiss tool and negative routing penalty"
```

---

### Task 3: Category-aware routing boost

When active skills share a category (e.g., all SEO), other skills in that category should get a contextual boost. This avoids the problem where SEO sub-skills score poorly because they don't co-occur with each other yet.

**Files:**
- Modify: `packages/codegraph/src/storage/skills-store.ts:331-361` (route method)
- Modify: `packages/codegraph/src/mcp/tools/skills.ts:192-226` (skill_route params)
- Modify: `packages/codegraph/tests/skill-routing.test.ts`

- [ ] **Step 1: Write the failing test for category boost**

Append to `packages/codegraph/tests/skill-routing.test.ts`:

```typescript
it('skills in the same category as activeSkills get a boost', () => {
  const now = new Date().toISOString()
  // Add SEO skills
  store.upsert({
    name: 'seo', category: 'SEO', description: 'SEO optimization guide',
    content: 'Full SEO guide for web apps', type: 'domain',
    tags: ['seo'], lines: 200, updatedAt: now,
  })
  store.upsert({
    name: 'seo-technical', category: 'SEO', description: 'Technical SEO for developers',
    content: 'Sitemaps robots crawl budget technical web', type: 'domain',
    tags: ['seo', 'technical'], lines: 150, updatedAt: now,
  })

  // Route with seo as active skill — seo-technical should get category boost
  const results = store.route('improve web performance and crawl', 5, ['seo'])
  const names = results.map((r) => r.name)
  expect(names).toContain('seo-technical')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/codegraph && npx vitest run tests/skill-routing.test.ts`
Expected: FAIL or seo-technical not in results (no category boost)

- [ ] **Step 3: Add category boost to route()**

In `packages/codegraph/src/storage/skills-store.ts`, modify `route()`:

After `const coocBoost = ...` (line ~353), add:

```typescript
const categoryBoost = (() => {
  if (!activeSkills.length) return 0
  const activeCategories = new Set<string>()
  for (const as of activeSkills) {
    const skill = this.get(as)
    if (skill) activeCategories.add(skill.category)
  }
  return activeCategories.has(r.skill.category) ? 0.15 : 0
})()
```

Update the scoring formula — rebalance weights to accommodate the new factor:
```typescript
const score = 0.45 * bm25Norm + 0.18 * confidence + 0.12 * recencyBoost + 0.10 * coocBoost + categoryBoost - dismissalPenalty
```

Note: BM25 goes from 0.50 to 0.45, confidence from 0.20 to 0.18, recency from 0.15 to 0.12, cooc from 0.15 to 0.10. The +0.15 category boost fills the gap. When no active skills, the formula effectively behaves the same since categoryBoost=0.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/codegraph && npx vitest run tests/skill-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/src/storage/skills-store.ts packages/codegraph/tests/skill-routing.test.ts
git commit -m "feat(routing): add category-aware boost when active skills share a category"
```

---

### Task 4: Accelerate skill decay (10 -> 5 sessions)

Skill decay threshold of 10 sessions is too slow. Align it with memory decay (5 sessions). Also reduce deprecation from 30 to 20 sessions.

**Files:**
- Modify: `packages/codegraph/src/constants.ts`
- Modify: `packages/codegraph/src/storage/skills-store.ts:172-181` (decay queries)
- Modify: `packages/codegraph/tests/skill-routing.test.ts`

- [ ] **Step 1: Write the failing test for faster skill decay**

Append to `packages/codegraph/tests/skill-routing.test.ts`:

```typescript
describe('SkillsStore.applyDecay() thresholds', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    const now = new Date().toISOString()
    store.upsert({
      name: 'stale-skill', category: 'Other', description: 'test stale',
      content: '', type: 'domain', tags: [], lines: 0, updatedAt: now,
    })
  })

  it('decays confidence after 5 sessions without validation', () => {
    // Simulate 6 sessions of non-use
    for (let i = 0; i < 6; i++) {
      store.applyDecay([])
    }

    const skill = store.get('stale-skill')
    // Default confidence is 5, after 6 sessions (first decay at session 5):
    // session 1-4: no decay, session 5: -1, session 6: -1 => confidence = 3
    expect(skill!.status).toBe('active')
    // Confidence should have dropped from default 5
    const row = db.prepare('SELECT confidence FROM skills WHERE name = ?').get('stale-skill') as any
    expect(row.confidence).toBeLessThan(5)
  })

  it('deprecates after 20 sessions with low confidence', () => {
    // Lower confidence to 2 first
    db.prepare('UPDATE skills SET confidence = 2 WHERE name = ?').run('stale-skill')

    // Simulate 21 sessions
    for (let i = 0; i < 21; i++) {
      store.applyDecay([])
    }

    const row = db.prepare('SELECT status FROM skills WHERE name = ?').get('stale-skill') as any
    expect(row.status).toBe('deprecated')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/codegraph && npx vitest run tests/skill-routing.test.ts`
Expected: FAIL — current threshold is 10 sessions, not 5

- [ ] **Step 3: Add constants and update decay queries**

In `packages/codegraph/src/constants.ts`, add:

```typescript
// ── Skill Decay ──
export const SKILL_DECAY_SESSIONS_THRESHOLD = 5
export const SKILL_DEPRECATION_SESSIONS_THRESHOLD = 20
```

In `packages/codegraph/src/storage/skills-store.ts`, import the constants:

```typescript
import { SKILL_DECAY_SESSIONS_THRESHOLD, SKILL_DEPRECATION_SESSIONS_THRESHOLD } from '../constants.js'
```

Replace the hardcoded `applySkillDecay` and `deprecateSkills` prepared statements (lines 172-181). Since prepared statements use literal SQL, switch to dynamic queries in `applyDecay()` method instead. Replace lines 449-454 in `applyDecay()`:

```typescript
this.stmts.incrementSkillSessionCount.run()
this.db.prepare(`
  UPDATE skills SET confidence = MAX(COALESCE(confidence, 5) - 1, 1), updated_at = ?
  WHERE sessions_since_validation >= ${SKILL_DECAY_SESSIONS_THRESHOLD} AND COALESCE(confidence, 5) > 1 AND status = 'active'
`).run(now)
const deprecated = (this.db.prepare(
  `SELECT COUNT(*) as c FROM skills WHERE sessions_since_validation >= ${SKILL_DEPRECATION_SESSIONS_THRESHOLD} AND COALESCE(confidence, 5) < 3 AND status = 'active'`
).get() as any)?.c ?? 0
this.db.prepare(
  `UPDATE skills SET status = 'deprecated', updated_at = ? WHERE sessions_since_validation >= ${SKILL_DEPRECATION_SESSIONS_THRESHOLD} AND COALESCE(confidence, 5) < 3 AND status = 'active'`
).run(now)
const decayed = (this.db.prepare(
  `SELECT COUNT(*) as c FROM skills WHERE sessions_since_validation >= ${SKILL_DECAY_SESSIONS_THRESHOLD} AND COALESCE(confidence, 5) > 1 AND status = 'active'`
).get() as any)?.c ?? 0
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/codegraph && npx vitest run tests/skill-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite for regressions**

Run: `cd packages/codegraph && npx vitest run`
Expected: All existing tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/codegraph/src/constants.ts packages/codegraph/src/storage/skills-store.ts packages/codegraph/tests/skill-routing.test.ts
git commit -m "feat(routing): accelerate skill decay from 10 to 5 sessions, deprecation from 30 to 20"
```

---

## Phase B — Memory Retrieval (Tasks 5-8)

### Task 5: Project cluster boost

Currently closet boost only works for exact project match. Extend it to boost memories from projects that share a similar stack (same category of skills used).

**Files:**
- Modify: `packages/codegraph/src/storage/memory-store.ts:479-494` (closetBoost method)
- Create: `packages/codegraph/tests/memory-retrieval.test.ts`

- [ ] **Step 1: Write the failing test for cluster boost**

```typescript
// packages/codegraph/tests/memory-retrieval.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/storage/migrator.js'
import { MemoryStore } from '../src/storage/memory-store.js'

const TEST_KEY = 'b'.repeat(64)

describe('MemoryStore.search() cluster boost', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)

    // Memory from project-a (same stack as our target project-b)
    store.add({
      type: 'Pattern', context: 'In Next.js App Router, when building server components',
      problem: 'Data fetching fails silently', solution: 'Use async components with error boundaries for reliable data fetching',
      reason: 'RSC errors are swallowed', tags: ['nextjs', 'rsc'],
      project: 'project-a', scope: 'project',
    })

    // Memory from unrelated project
    store.add({
      type: 'Pattern', context: 'In React Native Expo, when building mobile apps',
      problem: 'Navigation stack issues', solution: 'Use expo-router for file-based mobile routing',
      reason: 'Consistent with web patterns', tags: ['react-native', 'expo'],
      project: 'mobile-app', scope: 'project',
    })
  })

  it('memories from sibling projects (same skill tags) get a reduced closet boost', () => {
    // Search from project-b which also uses nextjs
    const results = store.search('server components data fetching', 10, 'project-b', ['nextjs'])
    // The project-a memory should appear (it shares skill context)
    const projectAMemory = results.find((r) => r.memory.project === 'project-a')
    expect(projectAMemory).toBeDefined()
    expect(projectAMemory!.rank).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/codegraph && npx vitest run tests/memory-retrieval.test.ts`
Expected: FAIL — `search()` doesn't accept `activeSkills` parameter

- [ ] **Step 3: Extend search() and closetBoost() signatures**

In `packages/codegraph/src/storage/memory-store.ts`:

Update `search()` signature (line 411):
```typescript
search(query: string, limit = 15, project?: string, activeSkills?: string[]): MemorySearchResult[] {
```

Update `closetBoost()` signature (line 479):
```typescript
private closetBoost(
  results: Array<{ memory: Memory; score: number }>,
  project?: string,
  activeSkills?: string[],
): Array<{ memory: Memory; finalScore: number }> {
  const BOOSTS = [0.40, 0.25, 0.15, 0.08, 0.04]
  const SIBLING_BOOST = 0.20
  const clusterCount = new Map<string, number>()
  const activeSet = new Set(activeSkills ?? [])

  return results.map(({ memory, score }) => {
    const isTarget = !!project && memory.project === project
    const key = `${memory.project ?? ''}::${memory.skill ?? ''}`
    const pos = isTarget ? (clusterCount.get(key) ?? 0) : -1
    if (isTarget) clusterCount.set(key, pos + 1)

    let boost = pos >= 0 && pos < BOOSTS.length ? BOOSTS[pos] : 0

    // Sibling project boost: memory from different project but shares skill tags
    if (!isTarget && memory.project && memory.project !== project && activeSet.size > 0) {
      const memTags = memory.tags ?? []
      const overlap = memTags.filter((t) => activeSet.has(t))
      if (overlap.length > 0) {
        boost = SIBLING_BOOST * Math.min(overlap.length, 3) / 3
      }
    }

    return { memory, finalScore: score + boost }
  })
}
```

Update the call site in `search()` (line 445):
```typescript
const boosted = this.closetBoost(reranked.sort((a, b) => b.score - a.score), project, activeSkills)
```

- [ ] **Step 4: Update memory_search MCP tool to pass activeSkills**

In `packages/codegraph/src/mcp/tools/memory.ts`, update the `memory_search` tool's schema to accept `activeSkills`:

Find the `memory_search` tool definition and add parameter:
```typescript
activeSkills: z.array(z.string()).optional().describe('Currently active skill names for cluster boost'),
```

And update the handler to pass it:
```typescript
const results = store.search(query, limit, project, activeSkills)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/codegraph && npx vitest run tests/memory-retrieval.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/codegraph/src/storage/memory-store.ts packages/codegraph/src/mcp/tools/memory.ts packages/codegraph/tests/memory-retrieval.test.ts
git commit -m "feat(memory): add sibling project cluster boost in search using active skills overlap"
```

---

### Task 6: Structured tag matching bonus in search()

Tags are currently dumped into the FTS text blob. Exact tag matches should score significantly higher — a memory tagged `nextjs` should strongly match a query containing "nextjs".

**Files:**
- Modify: `packages/codegraph/src/storage/memory-store.ts:453-477` (bm25Rerank)
- Modify: `packages/codegraph/tests/memory-retrieval.test.ts`

- [ ] **Step 1: Write the failing test for tag bonus**

Append to `packages/codegraph/tests/memory-retrieval.test.ts`:

```typescript
describe('MemoryStore.search() tag bonus', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)

    // Memory with exact tag match
    store.add({
      type: 'BugFix', context: 'In a web application framework',
      problem: 'Build fails on deploy', solution: 'Clear the build cache and rebuild',
      reason: 'Stale cache causes conflicts', tags: ['nextjs', 'deploy'],
      scope: 'global',
    })

    // Memory that mentions nextjs in content but not in tags
    store.add({
      type: 'BugFix', context: 'In nextjs app router when building pages',
      problem: 'Build fails on deploy', solution: 'Clear the build cache and rebuild from scratch',
      reason: 'Stale nextjs cache causes conflicts', tags: ['build', 'deploy'],
      scope: 'global',
    })
  })

  it('memories with exact tag match rank higher than content-only match', () => {
    const results = store.search('nextjs deploy issue', 5)
    expect(results.length).toBe(2)
    // The one with tag 'nextjs' should rank first
    expect(results[0].memory.tags).toContain('nextjs')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/codegraph && npx vitest run tests/memory-retrieval.test.ts`
Expected: FAIL — tag match and content match score the same

- [ ] **Step 3: Add tag bonus to bm25Rerank()**

In `packages/codegraph/src/storage/memory-store.ts`, modify `bm25Rerank()` (after the BM25 loop, line ~475):

```typescript
private bm25Rerank(candidates: Memory[], queryTokens: string[]): Array<{ memory: Memory; score: number }> {
  if (candidates.length === 0) return []

  const totalActive = (this.db.prepare(`SELECT COUNT(*) as n FROM memories WHERE status = 'active'`).get() as any)?.n ?? 1
  const k1 = 1.5, b = 0.75
  const TAG_MATCH_BONUS = 0.30

  const texts = candidates.map((m) =>
    [m.context, m.problem, m.solution, m.reason, ...(m.tags ?? [])].join(' ').toLowerCase()
  )
  const avgdl = texts.reduce((s, t) => s + t.length, 0) / texts.length

  return candidates.map((m, i) => {
    const text = texts[i]
    const dl = text.length
    let score = 0
    for (const t of queryTokens) {
      const df = texts.filter((tx) => tx.includes(t)).length
      if (df === 0) continue
      const idf = Math.log((totalActive - df + 0.5) / (df + 0.5) + 1)
      const tf = (text.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) ?? []).length
      score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avgdl))
    }

    // Tag match bonus: exact token match against memory tags
    const memTags = (m.tags ?? []).map((t) => t.toLowerCase())
    for (const qt of queryTokens) {
      if (memTags.includes(qt)) {
        score += TAG_MATCH_BONUS
      }
    }

    return { memory: m, score }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/codegraph && npx vitest run tests/memory-retrieval.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/src/storage/memory-store.ts packages/codegraph/tests/memory-retrieval.test.ts
git commit -m "feat(memory): add TAG_MATCH_BONUS (0.30) for exact tag matches in BM25 reranking"
```

---

### Task 7: Type-weighted scoring in scored()

BugFix and AntiPattern memories have higher operational value during coding than Fact or Goal. Add type weights to `scored()`.

**Files:**
- Modify: `packages/codegraph/src/storage/memory-store.ts:506-534` (scored method)
- Modify: `packages/codegraph/tests/memory-retrieval.test.ts`

- [ ] **Step 1: Write the failing test for type weights**

Append to `packages/codegraph/tests/memory-retrieval.test.ts`:

```typescript
describe('MemoryStore.scored() type weights', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)

    // Same confidence, importance, scope — only type differs
    const base = {
      context: 'In Next.js when building apps',
      problem: 'Something happens', solution: 'Do something about it',
      reason: 'Because reasons', tags: ['nextjs'],
      confidence: 5, importance: 5, scope: 'global' as const,
    }

    store.add({ ...base, type: 'Fact' })
    store.add({ ...base, type: 'BugFix' })
    store.add({ ...base, type: 'AntiPattern' })
    store.add({ ...base, type: 'Goal' })
  })

  it('BugFix and AntiPattern rank higher than Fact and Goal at equal confidence', () => {
    const results = store.scored(undefined, undefined, 10)
    const types = results.map((r) => r.memory.type)

    const bugfixIdx = types.indexOf('BugFix')
    const antiIdx = types.indexOf('AntiPattern')
    const factIdx = types.indexOf('Fact')
    const goalIdx = types.indexOf('Goal')

    expect(bugfixIdx).toBeLessThan(factIdx)
    expect(antiIdx).toBeLessThan(goalIdx)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/codegraph && npx vitest run tests/memory-retrieval.test.ts`
Expected: FAIL — all types score the same

- [ ] **Step 3: Add type weight map to scored()**

In `packages/codegraph/src/storage/memory-store.ts`, modify `scored()` method (line ~522):

Add the weight map at the top of the method:
```typescript
scored(project?: string, activeSkills?: string[], limit = 15): MemorySearchResult[] {
  try { this.autoDecayIfDue() } catch {}

  const TYPE_WEIGHTS: Record<string, number> = {
    BugFix: 1.5, AntiPattern: 1.4, Pattern: 1.3,
    Decision: 1.2, Preference: 1.1, Fact: 1.0, Goal: 0.8, Todo: 0.7,
  }

  const active = (this.stmts.allActive.all() as any[])
    .map(this.rowToMemory)
    .filter((m) => !m.id.startsWith('M-_system_'))

  const scored = active
    .filter((m) => {
      if ((m.scope === 'project-specific' || m.scope === 'project') && project && m.project !== project) return false
      return true
    })
    .map((m) => {
      let score = m.confidence * 2
      if (m.scope === 'global' || m.scope === 'team' || m.project === project) score += 3
      if (m.sessionsSinceValidation <= 5) score += 2
      if (activeSkills?.includes(m.skill ?? '')) score += 2
      score += m.importance * 0.5
      score *= (TYPE_WEIGHTS[m.type] ?? 1.0)
      return { memory: m, rank: score, edges: this.getEdges(m.id) }
    })
    .sort((a, b) => b.rank - a.rank)

  return scored.slice(0, limit)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/codegraph && npx vitest run tests/memory-retrieval.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/src/storage/memory-store.ts packages/codegraph/tests/memory-retrieval.test.ts
git commit -m "feat(memory): add type-weighted scoring in scored() — BugFix 1.5x, AntiPattern 1.4x, Goal 0.7x"
```

---

### Task 8: Semantic dedup in memory_add

Before creating a new memory, check if a very similar one already exists. If so, suggest updating the existing one instead of creating a duplicate.

**Files:**
- Modify: `packages/codegraph/src/storage/memory-store.ts` (new method)
- Modify: `packages/codegraph/src/mcp/tools/memory.ts:47-93` (memory_add handler)
- Modify: `packages/codegraph/tests/memory-retrieval.test.ts`

- [ ] **Step 1: Write the failing test for dedup detection**

Append to `packages/codegraph/tests/memory-retrieval.test.ts`:

```typescript
describe('MemoryStore.findDuplicate()', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)

    store.add({
      type: 'BugFix',
      context: 'In Next.js App Router, when using Server Actions with cookies',
      problem: 'Cookies are not accessible in Server Actions',
      solution: 'Use headers() to pass cookies explicitly to Server Actions instead of relying on request context',
      reason: 'Server Actions run in a different execution context than RSCs',
      tags: ['nextjs', 'server-actions', 'cookies'],
      scope: 'global',
    })
  })

  it('detects near-duplicate by solution similarity', () => {
    const dupe = store.findDuplicate({
      type: 'BugFix',
      context: 'In Next.js when working with Server Actions and cookie access',
      problem: 'Cannot read cookies in server action',
      solution: 'Pass cookies via headers() explicitly instead of using request context in Server Actions',
      reason: 'Different execution context',
      tags: ['nextjs', 'server-actions'],
    })

    expect(dupe).toBeDefined()
    expect(dupe!.type).toBe('BugFix')
  })

  it('returns null for genuinely different memories', () => {
    const dupe = store.findDuplicate({
      type: 'Pattern',
      context: 'In PostgreSQL when optimizing queries',
      problem: 'Slow query on large table',
      solution: 'Add partial index on frequently filtered column with WHERE clause',
      reason: 'Partial indexes are smaller and faster to scan',
      tags: ['postgres', 'performance'],
    })

    expect(dupe).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/codegraph && npx vitest run tests/memory-retrieval.test.ts`
Expected: FAIL — `findDuplicate` method doesn't exist

- [ ] **Step 3: Implement findDuplicate() using Jaccard trigram similarity**

In `packages/codegraph/src/storage/memory-store.ts`, add after `detectContradictions()` (line ~598):

```typescript
findDuplicate(input: Pick<MemoryInput, 'type' | 'context' | 'solution' | 'problem' | 'reason' | 'tags'>): Memory | null {
  const candidates = this.search(input.solution.slice(0, 200), 5)
  if (candidates.length === 0) return null

  const inputTrigrams = this.trigrams(input.solution.toLowerCase())
  for (const { memory } of candidates) {
    if (memory.type !== input.type) continue
    const existTrigrams = this.trigrams(memory.solution.toLowerCase())
    const similarity = this.jaccardSimilarity(inputTrigrams, existTrigrams)
    if (similarity >= 0.45) return memory
  }
  return null
}

private trigrams(text: string): Set<string> {
  const set = new Set<string>()
  const clean = text.replace(/\s+/g, ' ').trim()
  for (let i = 0; i <= clean.length - 3; i++) {
    set.add(clean.slice(i, i + 3))
  }
  return set
}

private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersection = 0
  for (const t of a) {
    if (b.has(t)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/codegraph && npx vitest run tests/memory-retrieval.test.ts`
Expected: PASS

- [ ] **Step 5: Wire findDuplicate() into memory_add MCP tool**

In `packages/codegraph/src/mcp/tools/memory.ts`, modify the `memory_add` handler (line ~71):

```typescript
const memory = withMemoryStore(resolved.path, (store) => {
  // Check for near-duplicates before adding
  const existing = store.findDuplicate({ type, context, problem, solution, reason, tags })
  if (existing) {
    return { mem: null, duplicate: existing, contradictionWarnings: [] }
  }

  const mem = store.add({ type, context, problem, solution, reason, tags, confidence, importance, scope, project, skill, status: draft ? 'pending-review' : 'active' })
  const contradictions = store.detectContradictions(mem)
  const contradictionWarnings = contradictions.map((c) =>
    `⚠️ Potential contradiction with ${c.id}: "${c.context.slice(0, 80)}..."`,
  )
  return { mem, duplicate: null, contradictionWarnings }
})

if (memory.duplicate) {
  const d = memory.duplicate
  let text = `⚠️ Near-duplicate found: ${d.id} (${d.type}, confidence: ${d.confidence})\n`
  text += `Existing: "${d.solution.slice(0, 120)}..."\n\n`
  text += `Options:\n1. Skip (don't create duplicate)\n2. Create edge: memory_add_edge(source: NEW_ID, target: "${d.id}", type: "Updates")\n3. Force create anyway by re-calling memory_add`
  return { content: [{ type: 'text', text }] }
}

let text = draft
  ? `⏳ Memory queued for review: ${memory.mem!.id} (${memory.mem!.type}) — approve at ${dashboardUrl()}/#/review`
  : `✅ Memory added: ${memory.mem!.id} (${memory.mem!.type}, confidence: ${memory.mem!.confidence})`
if (memory.contradictionWarnings.length > 0) {
  text += '\n\n' + memory.contradictionWarnings.join('\n')
  text += '\n\nUse memory_add_edge to create Contradicts edges if confirmed.'
}

return { content: [{ type: 'text', text }] }
```

- [ ] **Step 6: Run full test suite**

Run: `cd packages/codegraph && npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/codegraph/src/storage/memory-store.ts packages/codegraph/src/mcp/tools/memory.ts packages/codegraph/tests/memory-retrieval.test.ts
git commit -m "feat(memory): add semantic dedup via Jaccard trigram similarity before memory_add"
```

---

## Phase C — Auto-Learning Pipeline (Tasks 9-12)

### Task 9: Personalized memory_suggest

Track which memory types the user approves vs. rejects, and adapt the template accordingly.

**Files:**
- Create: `packages/codegraph/src/storage/migrations/019_suggest_log.sql`
- Modify: `packages/codegraph/src/storage/memory-store.ts` (new methods)
- Modify: `packages/codegraph/src/mcp/tools/memory.ts:288-335` (memory_suggest)
- Create: `packages/codegraph/tests/autolearning.test.ts`

- [ ] **Step 1: Write the migration**

```sql
-- packages/codegraph/src/storage/migrations/019_suggest_log.sql
-- Track memory_suggest outcomes for personalization
CREATE TABLE IF NOT EXISTS suggest_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT,
  suggested_type TEXT NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0,
  ts TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_suggest_log_type ON suggest_log(suggested_type, accepted);
```

- [ ] **Step 2: Write the failing test**

```typescript
// packages/codegraph/tests/autolearning.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/storage/migrator.js'
import { MemoryStore } from '../src/storage/memory-store.js'

const TEST_KEY = 'b'.repeat(64)

describe('MemoryStore suggest personalization', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)
  })

  it('logSuggestOutcome stores accepted/rejected per type', () => {
    store.logSuggestOutcome('BugFix', true, 'project-a')
    store.logSuggestOutcome('BugFix', true, 'project-a')
    store.logSuggestOutcome('Fact', false, 'project-a')
    store.logSuggestOutcome('Fact', false, 'project-a')
    store.logSuggestOutcome('Fact', false, 'project-a')

    const prefs = store.suggestPreferences()
    expect(prefs.BugFix.accepted).toBe(2)
    expect(prefs.BugFix.total).toBe(2)
    expect(prefs.Fact.accepted).toBe(0)
    expect(prefs.Fact.total).toBe(3)
  })

  it('suggestPreferences returns acceptance rate per type', () => {
    store.logSuggestOutcome('Pattern', true)
    store.logSuggestOutcome('Pattern', true)
    store.logSuggestOutcome('Pattern', false)

    const prefs = store.suggestPreferences()
    expect(prefs.Pattern.rate).toBeCloseTo(0.667, 1)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/codegraph && npx vitest run tests/autolearning.test.ts`
Expected: FAIL — migration not applied, methods don't exist

- [ ] **Step 4: Create the migration file**

Write the file `packages/codegraph/src/storage/migrations/019_suggest_log.sql` with content from Step 1.

- [ ] **Step 5: Add store methods**

In `packages/codegraph/src/storage/memory-store.ts`, add before the `private rowToMemory` method:

```typescript
logSuggestOutcome(type: string, accepted: boolean, project?: string): void {
  try {
    this.db.prepare(
      'INSERT INTO suggest_log (suggested_type, accepted, project) VALUES (?, ?, ?)'
    ).run(type, accepted ? 1 : 0, project ?? null)
  } catch { /* table may not exist */ }
}

suggestPreferences(): Record<string, { accepted: number; total: number; rate: number }> {
  try {
    const rows = this.db.prepare(`
      SELECT suggested_type, SUM(accepted) as accepted, COUNT(*) as total
      FROM suggest_log GROUP BY suggested_type
    `).all() as any[]

    return rows.reduce((acc, r) => {
      acc[r.suggested_type] = {
        accepted: r.accepted,
        total: r.total,
        rate: r.total > 0 ? r.accepted / r.total : 0,
      }
      return acc
    }, {} as Record<string, { accepted: number; total: number; rate: number }>)
  } catch {
    return {}
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/codegraph && npx vitest run tests/autolearning.test.ts`
Expected: PASS

- [ ] **Step 7: Update memory_suggest to use preferences**

In `packages/codegraph/src/mcp/tools/memory.ts`, replace the `memory_suggest` handler (lines 298-334):

```typescript
async ({ taskDescription, outcome, project, repo }) => {
  const resolved = resolveMemoryRepo(repo)
  if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

  const prefs = withMemoryStore(resolved.path, (store) => store.suggestPreferences())

  const typeGuidance = Object.entries(prefs)
    .filter(([_, v]) => v.total >= 3)
    .sort((a, b) => b[1].rate - a[1].rate)

  let personalizedHint = ''
  if (typeGuidance.length > 0) {
    const preferred = typeGuidance.filter(([_, v]) => v.rate >= 0.6).map(([k]) => k)
    const avoided = typeGuidance.filter(([_, v]) => v.rate <= 0.2).map(([k]) => k)
    if (preferred.length > 0) personalizedHint += `\n\nUser tends to accept: ${preferred.join(', ')}`
    if (avoided.length > 0) personalizedHint += `\nUser tends to reject: ${avoided.join(', ')} (skip these unless very high value)`
  }

  const template = `## Memory Capture Suggestions

Based on this task:
- **Task**: ${taskDescription}
- **Outcome**: ${outcome}
${project ? `- **Project**: ${project}` : ''}${personalizedHint}

Extract 1-3 memories that would be valuable in FUTURE sessions. For each:

1. **Is this worth saving?** (skip if: one-time fix, obvious typo, trivial)
2. **Which type?**
   - \`BugFix\`: non-obvious bug with non-obvious fix
   - \`Pattern\`: reusable approach that works well
   - \`AntiPattern\`: what NOT to do (with reason)
   - \`Preference\`: user style/approach preference
   - \`Decision\`: architectural choice with rationale
   - \`Fact\`: verified technical fact

3. **Propose to user**:
\`\`\`
I learned something worth saving. Want me to save:

1. [BugFix] "When using Server Actions in Next.js 15, cookies need explicit headers()..."
   Solution: "Pass cookies via headers() instead of relying on request context"
   Reason: "Server Actions run in a different context than RSCs"

[save / skip]
\`\`\`

4. For each approved: call \`memory_add({ type, context, problem, solution, reason, tags, project, skill })\`
5. For each outcome: call \`logSuggestOutcome(type, accepted, project)\` via internal tracking

Only save what would SAVE FUTURE TIME. Quality over quantity.`

  return { content: [{ type: 'text', text: template }] }
},
```

- [ ] **Step 8: Commit**

```bash
git add packages/codegraph/src/storage/migrations/019_suggest_log.sql packages/codegraph/src/storage/memory-store.ts packages/codegraph/src/mcp/tools/memory.ts packages/codegraph/tests/autolearning.test.ts
git commit -m "feat(learning): personalized memory_suggest based on user acceptance history"
```

---

### Task 10: Auto-linkage skill <-> memory

When `memory_add` is called during a session with loaded skills, auto-populate the `skill` field from the most recently loaded skill. This makes the `activeSkills.includes(m.skill)` boost in `scored()` actually effective.

**Files:**
- Modify: `packages/codegraph/src/storage/skills-store.ts` (new method)
- Modify: `packages/codegraph/src/mcp/tools/memory.ts:47-93` (memory_add handler)
- Modify: `packages/codegraph/tests/autolearning.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/codegraph/tests/autolearning.test.ts`:

```typescript
import { SkillsStore } from '../src/storage/skills-store.js'

describe('Auto-linkage skill <-> memory', () => {
  let db: Database.Database
  let skillStore: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    skillStore = new SkillsStore(db)

    const now = new Date().toISOString()
    skillStore.upsert({
      name: 'nextjs', category: 'Frontend', description: 'Next.js guide',
      content: '', type: 'domain', tags: ['nextjs'], lines: 100, updatedAt: now,
    })
  })

  it('lastLoadedSkill returns the most recently loaded skill for a session', () => {
    skillStore.recordUsage('nextjs', 'loaded', { sessionId: 'sess-1' })

    const last = skillStore.lastLoadedSkill('sess-1')
    expect(last).toBe('nextjs')
  })

  it('lastLoadedSkill returns null when no skills loaded in session', () => {
    const last = skillStore.lastLoadedSkill('sess-unknown')
    expect(last).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/codegraph && npx vitest run tests/autolearning.test.ts`
Expected: FAIL — `lastLoadedSkill` doesn't exist

- [ ] **Step 3: Add lastLoadedSkill() to SkillsStore**

In `packages/codegraph/src/storage/skills-store.ts`, add a prepared statement:

```typescript
// Add to prepareStatements(), after lastUsed:
lastLoadedInSession: this.db.prepare(`
  SELECT skill_name FROM skill_usage
  WHERE session_id = ? AND action IN ('loaded', 'applied')
  ORDER BY ts DESC LIMIT 1
`),
```

Add the method (after `lastUsedMap()`):

```typescript
lastLoadedSkill(sessionId: string): string | null {
  try {
    const row = this.stmts.lastLoadedInSession.get(sessionId) as { skill_name: string } | undefined
    return row?.skill_name ?? null
  } catch { return null }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/codegraph && npx vitest run tests/autolearning.test.ts`
Expected: PASS

- [ ] **Step 5: Wire auto-linkage into memory_add MCP tool**

In `packages/codegraph/src/mcp/tools/memory.ts`, modify the `memory_add` handler. After resolving the repo but before calling `store.add()`, add auto-linkage:

```typescript
// After: if (!resolved) return ...
// Before: const memory = withMemoryStore(...)

// Auto-link skill if not provided
let effectiveSkill = skill
if (!effectiveSkill) {
  const sessionId = _ctx?.sessionId // need to pass sessionId through context
  if (sessionId) {
    effectiveSkill = withSkillsStore(resolved.path, (skillStore) =>
      skillStore.lastLoadedSkill(sessionId)
    )
  }
}
```

Then use `effectiveSkill` instead of `skill` in the `store.add()` call.

Note: This requires importing `withSkillsStore` at the top of memory.ts:
```typescript
import { withSkillsStore } from '../../storage/skills-store.js'
```

And adding `sessionId` to the tool context. In the tool schema, add:
```typescript
sessionId: z.string().optional().describe('Current session ID for auto-linking skill'),
```

- [ ] **Step 6: Run full test suite**

Run: `cd packages/codegraph && npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/codegraph/src/storage/skills-store.ts packages/codegraph/src/mcp/tools/memory.ts packages/codegraph/tests/autolearning.test.ts
git commit -m "feat(learning): auto-link memory to most recently loaded skill in session"
```

---

### Task 11: Track suggest outcomes in memory_add flow

When a user approves or skips a suggested memory, log the outcome so `memory_suggest` can personalize over time (completes the feedback loop from Task 9).

**Files:**
- Modify: `packages/codegraph/src/mcp/tools/memory.ts` (add suggest_outcome tool)
- Modify: `packages/codegraph/tests/autolearning.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/codegraph/tests/autolearning.test.ts`:

```typescript
describe('Suggest outcome tracking', () => {
  let db: Database.Database
  let store: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)
  })

  it('logSuggestOutcome creates entries that suggestPreferences reads', () => {
    store.logSuggestOutcome('BugFix', true, 'proj')
    store.logSuggestOutcome('BugFix', true, 'proj')
    store.logSuggestOutcome('Fact', false, 'proj')

    const prefs = store.suggestPreferences()
    expect(prefs.BugFix.rate).toBe(1.0)
    expect(prefs.Fact.rate).toBe(0.0)
  })
})
```

- [ ] **Step 2: Run test to verify it passes** (should pass from Task 9)

Run: `cd packages/codegraph && npx vitest run tests/autolearning.test.ts`
Expected: PASS

- [ ] **Step 3: Add suggest_outcome MCP tool**

In `packages/codegraph/src/mcp/tools/memory.ts`, after `memory_suggest`, add:

```typescript
server.tool(
  'memory_suggest_outcome',
  'Log whether a suggested memory was accepted or rejected. Improves future suggestions.',
  {
    type: z.enum(memoryTypes).describe('The memory type that was suggested'),
    accepted: z.boolean().describe('Whether the user accepted the suggestion'),
    project: z.string().optional(),
    repo: z.string().optional(),
  },
  async ({ type, accepted, project, repo }) => {
    const resolved = resolveMemoryRepo(repo)
    if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

    withMemoryStore(resolved.path, (store) => {
      store.logSuggestOutcome(type, accepted, project)
    })

    return { content: [{ type: 'text', text: `Logged: ${type} ${accepted ? 'accepted' : 'rejected'}` }] }
  },
)
```

- [ ] **Step 4: Run full test suite**

Run: `cd packages/codegraph && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/codegraph/src/mcp/tools/memory.ts packages/codegraph/tests/autolearning.test.ts
git commit -m "feat(learning): add memory_suggest_outcome tool for personalization feedback loop"
```

---

### Task 12: Integration test — full learning cycle

End-to-end test that verifies the complete flow: route skill -> load skill -> do work -> suggest memory -> add memory (auto-linked) -> decay -> re-route with improved scores.

**Files:**
- Modify: `packages/codegraph/tests/autolearning.test.ts`

- [ ] **Step 1: Write the integration test**

Append to `packages/codegraph/tests/autolearning.test.ts`:

```typescript
describe('Full learning cycle integration', () => {
  let db: Database.Database
  let skillStore: SkillsStore
  let memStore: MemoryStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    skillStore = new SkillsStore(db)
    memStore = new MemoryStore(db)

    const now = new Date().toISOString()
    skillStore.upsert({
      name: 'nextjs', category: 'Frontend', description: 'Next.js App Router guide',
      content: 'Full Next.js 15 guide with RSC, Server Actions, streaming',
      type: 'domain', tags: ['nextjs', 'react'], lines: 163, updatedAt: now,
    })
    skillStore.upsert({
      name: 'tailwind', category: 'Frontend', description: 'Tailwind CSS styling',
      content: 'Tailwind CSS utility classes and configuration',
      type: 'domain', tags: ['tailwind', 'css'], lines: 68, updatedAt: now,
    })
  })

  it('full cycle: route -> load -> memory_add (auto-linked) -> decay -> improved retrieval', () => {
    // 1. Route: find best skill for task
    const routed = skillStore.route('build nextjs page with server components', 3)
    expect(routed[0].name).toBe('nextjs')

    // 2. Load: record usage
    skillStore.recordUsage('nextjs', 'loaded', { sessionId: 'session-1' })
    skillStore.recordUsage('nextjs', 'applied', { sessionId: 'session-1' })

    // 3. Auto-link: lastLoadedSkill returns the loaded skill
    const linked = skillStore.lastLoadedSkill('session-1')
    expect(linked).toBe('nextjs')

    // 4. Add memory with auto-linked skill
    const mem = memStore.add({
      type: 'BugFix',
      context: 'In Next.js 15, when using Server Actions',
      problem: 'Cookie access fails silently',
      solution: 'Use headers() to explicitly pass cookies to Server Actions',
      reason: 'Different execution context for RSC vs Server Actions',
      tags: ['nextjs', 'server-actions'],
      skill: linked!,
      project: 'test-project',
      scope: 'project',
    })

    expect(mem.skill).toBe('nextjs')

    // 5. Decay: reinforce nextjs (it was useful)
    skillStore.applyDecay(['nextjs'])

    // 6. Verify scored() boosts memory with matching skill
    const scored = memStore.scored('test-project', ['nextjs'], 5)
    expect(scored.length).toBe(1)
    expect(scored[0].memory.skill).toBe('nextjs')
    // Score should include skill match bonus (+2)
    expect(scored[0].rank).toBeGreaterThan(10)

    // 7. Dedup: try adding same memory again
    const dupe = memStore.findDuplicate({
      type: 'BugFix',
      context: 'In Next.js when using server actions for cookies',
      problem: 'Cookie reading fails',
      solution: 'Pass cookies via headers() explicitly to server actions instead of request context',
      reason: 'Execution context differs',
      tags: ['nextjs'],
    })
    expect(dupe).toBeDefined()
    expect(dupe!.id).toBe(mem.id)
  })
})
```

- [ ] **Step 2: Run integration test**

Run: `cd packages/codegraph && npx vitest run tests/autolearning.test.ts`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `cd packages/codegraph && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/codegraph/tests/autolearning.test.ts
git commit -m "test(learning): add full learning cycle integration test"
```

---

## Post-Implementation Verification

After all 12 tasks:

- [ ] `cd packages/codegraph && npx vitest run` — all tests green
- [ ] `cd packages/codegraph && npm run build` — compiles without errors
- [ ] Deploy to staging and verify via dashboard at `memory.fl1.it`:
  - Skill routing returns better results for domain-specific queries
  - `memory_suggest` shows personalized hints after 3+ interactions
  - Duplicate memories are caught before creation
  - `scored()` prioritizes BugFix/AntiPattern over Fact/Goal
