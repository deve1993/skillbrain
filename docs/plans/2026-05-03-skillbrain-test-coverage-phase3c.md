# SkillBrain Phase 3c — Test Coverage Expansion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Add ~20 surgical tests across 4 new files to lock in Phase 1+2 behavior and cover known gaps. Fix any latent bug exposed in same commit batch.

**Spec:** `docs/superpowers/specs/2026-05-03-skillbrain-test-coverage-design.md`

**Tech Stack:** Vitest, better-sqlite3, TypeScript.

---

## File Structure

**Created:**
- `packages/codegraph/tests/skill-routing-extended.test.ts`
- `packages/codegraph/tests/memory-retrieval-extended.test.ts`
- `packages/codegraph/tests/integration-pipeline.test.ts`
- `packages/codegraph/tests/failure-modes.test.ts`

**Modified (only if test exposes bug):**
- Source files in `packages/codegraph/src/` as needed

---

### Task 1: Skill routing scoring matrix

**File:** `packages/codegraph/tests/skill-routing-extended.test.ts` (~6 tests)

Tests A1–A6 from spec. Pattern: each test seeds the DB with skills + skill_usage rows, calls `store.route(taskDescription, ...)`, asserts ranking position.

- [ ] **Step 1**: Write all 6 tests in one file using the standard fixture pattern (`mkdtempSync` + `runMigrations` per test). Use the same skill seed format as `tests/skill-routing.test.ts` for consistency.

- [ ] **Step 2**: Run only this file:
  ```bash
  cd packages/codegraph && pnpm vitest run tests/skill-routing-extended.test.ts
  ```
  All should pass against current code (since Phase A scoring is already implemented). If any fails, it's either a latent bug or a test bug — investigate and fix.

- [ ] **Step 3**: Run full suite to ensure no regressions:
  ```bash
  cd packages/codegraph && pnpm vitest run
  ```
  Expected: 202/202 (196 + 6 new).

- [ ] **Step 4**: Commit:
  ```bash
  git add packages/codegraph/tests/skill-routing-extended.test.ts
  git commit -m "test(skills): add 6 routing scoring matrix tests"
  ```

**Reference for test seed pattern**: read `tests/skill-routing.test.ts` (already 12 tests using SkillsStore + direct skill_usage inserts).

**Concrete tests to write:**

```typescript
// A1
it('applied × 3 boosts skill above peer with only loaded actions', () => {
  // Seed two skills with identical metadata
  // Skill X: 5 applied
  // Skill Y: 5 loaded (no applied)
  // route() with task that BM25-matches both equally
  // Expect X ranks above Y
})

// A2
it('categoryBoost +0.15 favors skills in active cluster', () => {
  // Active skills include skill in category 'Frontend'
  // Two candidate skills: one Frontend, one Backend, identical otherwise
  // Expect Frontend skill ranks higher
})

// A3
it('dismissalPenalty saturates at cap (0.20)', () => {
  // Skill with 10 dismissals
  // Skill with 4 dismissals
  // Both should have penalty == 0.20 (cap reached at 4)
  // Verify by checking that adding more dismissals (>4) doesn't change relative ranking vs another peer
})

// A4
it('projectAffinity boosts same-project skills', () => {
  // Skill X: loaded 5x in project P
  // Skill Y: loaded 5x in project Q
  // route(task, project: 'P', ...) → X ranks above Y
})

// A5
it('all skills dismissed: stable BM25-only ordering, no crash', () => {
  // Seed 3 skills with different lexical relevance to query
  // Dismiss each 4+ times
  // route() should still return them, ordered by BM25 alone
})

// A6
it('activeSkills=[] does not break category boost path', () => {
  // route(task, project: undefined, activeSkills: [])
  // Should return results without throwing
})
```

---

### Task 2: Memory retrieval edge cases

**File:** `packages/codegraph/tests/memory-retrieval-extended.test.ts` (~5 tests)

Tests B1–B5 from spec.

- [ ] **Step 1**: Write all 5 tests.

- [ ] **Step 2**: Run only this file. Expected: 5/5 pass.

- [ ] **Step 3**: Run full suite. Expected: 207/207 (202 + 5).

- [ ] **Step 4**: Commit:
  ```bash
  git add packages/codegraph/tests/memory-retrieval-extended.test.ts
  git commit -m "test(memory): add 5 retrieval edge case tests"
  ```

**Concrete tests:**

```typescript
// B1
it('falls back from trigram FTS to unicode61 FTS', () => {
  // Seed memories
  // Manually drop memories_fts_trgm table
  // search() should still return results via legacy searchFts
})

// B2
it('query() with composite scope=personal + userId + tags', () => {
  // Seed: 2 personal memories from userA (with different tags), 1 from userB
  // query({ scope: 'personal', userId: 'userA', tags: ['nextjs'] })
  // Returns only userA's nextjs-tagged personal memory
})

// B3
it('closetBoost matches partial project name', () => {
  // Memory tagged project 'web-pixarts'
  // search(query, project: 'pixarts') should boost it (substring match)
  // (Verify by comparing rank vs without project arg)
})

// B4
it('BM25 tag-match-bonus when query token equals tag exactly', () => {
  // Memory A: tags=['nextjs'], context='generic web stuff'
  // Memory B: tags=['ui'], context='nextjs is great'
  // search('nextjs') → A ranks above B (tag exact-match bonus)
})

// B5
it('search() with oversized query (>500 chars) does not throw', () => {
  // const q = 'a'.repeat(1000)
  // search(q, 5) returns gracefully (empty or matched, no throw)
})
```

**Note on B1:** if dropping `memories_fts_trgm` is hard, mock the prepared statement to throw. Read `memory-store.ts` lines 482-510 to understand the try/catch fallback structure and emulate the failure.

---

### Task 3: Pipeline integration

**File:** `packages/codegraph/tests/integration-pipeline.test.ts` (~5 tests)

Tests C1–C5 from spec. These touch multiple subsystems.

- [ ] **Step 1**: Write all 5 tests.

- [ ] **Step 2**: Run only this file. Expected: 5/5 pass.

- [ ] **Step 3**: Run full suite. Expected: 212/212 (207 + 5).

- [ ] **Step 4**: Commit:
  ```bash
  git add packages/codegraph/tests/integration-pipeline.test.ts
  git commit -m "test(integration): add 5 pipeline integration tests"
  ```

**Concrete tests:**

```typescript
// C1: full dismiss cycle
it('dismiss cycle: memory rank drops after 3 dismissals', () => {
  const m = store.add({ type: 'Pattern', context: 'auth', problem: '', solution: 'NextAuth', reason: '', tags: ['auth'] })
  const before = store.search('NextAuth auth', 5)
  expect(before[0].memory.id).toBe(m.id)
  for (let i = 0; i < 3; i++) store.dismissMemory(m.id)
  const after = store.search('NextAuth auth', 5)
  // Either memory drops in rank OR rank value drops; assert on rank value
  const beforeRank = before.find((r) => r.memory.id === m.id)!.rank
  const afterRank = after.find((r) => r.memory.id === m.id)!.rank
  expect(afterRank).toBeLessThan(beforeRank)
})

// C2: Pattern + AntiPattern same context → Contradicts edge → memoryHealth
it('Pattern + AntiPattern same context creates Contradicts edge surfaced by memoryHealth', () => {
  const ctx = 'In Next.js when using server actions with redirect()'
  store.add({ type: 'Pattern', context: ctx, problem: '', solution: 'use throw', reason: '', tags: [], project: 'P' })
  store.add({ type: 'AntiPattern', context: ctx, problem: '', solution: 'do not use', reason: '', tags: [], project: 'P' })
  const h = store.memoryHealth()
  expect(h.contradictions.length).toBeGreaterThanOrEqual(1)
  expect(h.contradictions[0].type).toBe('Contradicts')
})

// C3: skill_apply boosts auto-linked memory cross-session
// (This is more complex — likely requires manual session_id management. If too hard, replace with a simpler version: auto-link is created when memory_add happens during a session that recently loaded a skill)
it('memory auto-linked to skill via lastLoadedSkill', () => {
  // This test verifies the existing auto-linkage feature
  // Setup: log a skill load event for 'nextjs' in session S1
  // Add a memory in session S1 (no explicit skill arg)
  // Verify the memory has skill='nextjs' automatically
  // (If lastLoadedSkill API requires direct DB access or specific helpers, adapt accordingly)
})

// C4: runDailyDecay 2x is idempotent within 24h
it('autoDecayIfDue is no-op on second call within 24h', () => {
  const r1 = store.autoDecayIfDue()
  const r2 = store.autoDecayIfDue()
  expect(r1.ran).toBe(true)
  expect(r2.ran).toBe(false)
})

// C5: backfill-edges idempotent
it('deriveEdgeCandidates re-derive on memory with edges does not duplicate', () => {
  // Add 2 memories that should auto-link
  // After both are added, edge exists
  // Manually call deriveEdgeCandidates again → since edges exist, no duplicates
  // (Or test the script behavior via spawning child process)
  // Simplest: directly assert that getEdges() count for memory B is 1, not 2, after Phase 1 auto-derivation runs
})
```

**Note on C3 and C5:** if the existing API doesn't easily support these scenarios, simplify — the goal is regression coverage, not contortions. Document any simplification in a comment.

---

### Task 4: Failure modes

**File:** `packages/codegraph/tests/failure-modes.test.ts` (~4 tests)

Tests D1–D4 from spec. **These may expose bugs.** Per the bug fix policy in the spec: fix exposed bugs in same commit batch.

- [ ] **Step 1**: Write all 4 tests.

- [ ] **Step 2**: Run. **If any test fails**, investigate:
  - Is it a real bug? Fix it.
  - Is it a test design issue? Adjust.
  - Is it architectural? Skip with `it.skip()` and note the reason.

- [ ] **Step 3**: Run full suite. Expected: 216/216 (212 + 4) if all pass; lower if any are skipped.

- [ ] **Step 4**: Commit:
  ```bash
  git add packages/codegraph/tests/failure-modes.test.ts [any source fixes]
  git commit -m "test(failure-modes): add 4 robustness tests + fix exposed bugs"
  ```

**Concrete tests:**

```typescript
// D1: special chars in tags
it('tags with quotes/newlines/special chars round-trip via FTS', () => {
  const m = store.add({ type: 'Pattern', context: 'edge', problem: '', solution: 's', reason: '',
    tags: ["it's", 'with\nnewline', 'with"quotes'] })
  const got = store.get(m.id)
  expect(got?.tags).toEqual(["it's", 'with\nnewline', 'with"quotes'])
  // Search should not throw
  expect(() => store.search('edge', 5)).not.toThrow()
})

// D2: dismissMemory on non-existent id
it('dismissMemory on non-existent id does not throw', () => {
  // FK CASCADE: if memory doesn't exist, the FK constraint should reject the insert
  // Either: insert succeeds (no actual FK enforcement) OR throws SQLITE_CONSTRAINT
  // Test that the wrapper handles it gracefully
  expect(() => store.dismissMemory('M-nonexistent-12345')).not.toThrow()
  // Or, if it does throw a specific error class, catch and verify the error is informative
})

// D3: gcDeadSkills with threshold=0
it('gcDeadSkills threshold=0 returns all skills with loaded_count=0', () => {
  // Seed 3 skills, one with a 'loaded' action
  // gcDeadSkills({ threshold: 0, days: 30, dryRun: true })
  // Expect: returns 2 (the never-loaded ones)
})

// D4: migration 021 rollback + re-run
it('migration 021 is idempotent after manual drop', () => {
  // Drop memory_dismissals
  db.prepare('DROP TABLE memory_dismissals').run()
  // Re-run migrations
  runMigrations(db)
  // Table exists again
  const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='memory_dismissals'`).get()
  expect(tableExists).toBeDefined()
})
```

**On D2:** if the test exposes a NOT NULL or FK violation, the right fix may be to check the memory exists in `dismissMemory` and skip (no-op) rather than throw. Decide based on the actual error.

**On D4:** SkillBrain uses a `meta` table or `migrator` to track applied migrations. After dropping the table, you may need to also delete the migrator's record of having run 021 (or use a DB without the migrator marker). Read `src/storage/migrator.ts` first.

---

## Self-Review

**Spec coverage:** all 20 tests from spec are mapped to tasks.

**Placeholder scan:** none.

**Type/name consistency:** uses store API names verified in Phase 1+2 (`dismissMemory`, `memoryHealth`, `gcDeadSkills`, `autoDecayIfDue`).

---

## Execution

- Worktree: `.worktrees/skillbrain-pecche-phase1` (continues from Phase 2)
- Subagent-driven: 4 separate dispatches, fresh context per task
- Each task: implementer → spec/quality combined review → next
- If any source bug exposed: fix in same commit, no separate task needed
