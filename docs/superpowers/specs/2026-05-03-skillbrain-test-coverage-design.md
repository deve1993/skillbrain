# SkillBrain — Phase 3c Test Coverage Expansion (Design)

**Date:** 2026-05-03
**Status:** Approved by user 2026-05-03
**Sub-project of:** Phase 3 (after Phase 1 & 2 of pecche-fix)

## Goal

Surgical test coverage expansion targeting the hot paths just modified by Phase 1+2 (skill routing scoring, memory retrieval scoring, edge derivation, dismissal, decay) and known gaps in failure-mode handling. Not blanket coverage — risk-targeted regression net.

## Non-goals

- Performance benchmarks (need a dedicated harness)
- Property-based testing or mutation testing
- E2E HTTP smoke tests (defer to Phase 3b after monolith split)
- Refactoring existing tests for style — only add new tests

## Architecture

Four new test files in `packages/codegraph/tests/`. No source changes unless a test exposes a latent bug, in which case the bug is fixed in the same session.

### File layout

```
packages/codegraph/tests/
  skill-routing-extended.test.ts     # ~6 tests
  memory-retrieval-extended.test.ts  # ~5 tests
  integration-pipeline.test.ts       # ~5 tests
  failure-modes.test.ts              # ~4 tests
```

Each file is independent — no shared fixture beyond the standard `mkdtempSync` + `runMigrations` per-test pattern already used across the suite.

## Test groups

### A) Skill routing scoring matrix (`skill-routing-extended.test.ts`)

Locks in the scoring formula `0.38*bm25 + 0.15*conf + 0.12*recency + 0.10*cooc + 0.10*projectAffinity + categoryBoost - dismissalPenalty` exposed in `SkillsStore.route()`.

| # | Test | Asserts |
|---|------|---------|
| A1 | `applied × 3 in recency` flips ranking | Skill X (5 applied) ranks above skill Y (5 loaded) when other signals tied |
| A2 | `categoryBoost +0.15` activates on shared category | Skill in active-skill cluster ranks above peer in different category |
| A3 | `dismissalPenalty` saturates at cap | After 4+ dismissals, additional dismissals don't worsen rank further (cap 0.20) |
| A4 | `projectAffinity` favors same-project loads | Skill loaded 5× in project P ranks above peer loaded 5× in other projects when querying for P |
| A5 | All skills dismissed → fallback to BM25-only ordering | No crash; deterministic ordering by lexical match |
| A6 | `activeSkills=[]` does not break category boost path | No category boost applied; route returns valid results |

### B) Memory retrieval edge cases (`memory-retrieval-extended.test.ts`)

Covers retrieval paths `query()`, `search()`, `closetBoost`, BM25 rerank.

| # | Test | Asserts |
|---|------|---------|
| B1 | FTS trigram fallback to unicode61 path | Throwing the trgm prepared statement still returns results via the legacy `searchFts` |
| B2 | `query()` with composite filter `scope=personal + userId + tags` | Returns only matching personal memories from that user |
| B3 | `closetBoost` partial-match on project | Memory with `project: 'web-pixarts'` boosted when querying with `project: 'pixarts'` (substring/fuzzy match) |
| B4 | BM25 tag-match-bonus when query token equals tag exactly | Tag `nextjs` ranks higher than memory mentioning `nextjs` only in solution text |
| B5 | Query oversized (>500 chars) is truncated, no error | `search('a'.repeat(1000))` returns gracefully |

### C) Pipeline integration (`integration-pipeline.test.ts`)

End-to-end flows that span multiple subsystems and would catch interaction bugs.

| # | Test | Asserts |
|---|------|---------|
| C1 | Full dismiss cycle | Add → search (memory in top 1) → dismiss×3 → search again (memory rank dropped) |
| C2 | Pattern+AntiPattern → Contradicts edge → memoryHealth surfaces it | Auto-derivation creates edge; `memoryHealth().contradictions` length ≥ 1 |
| C3 | skill_apply → memory_add (auto-linked) → cross-session memory boost | After 3 sessions of `apply skill X` + adding memory linked to X, memory ranks higher when X is the active skill |
| C4 | `runDailyDecay` 2× in <24h is no-op the second time | Second call returns `{ ran: false }` |
| C5 | `backfill-edges` 2× is idempotent | Second run reports 0 created (all skipped due to existing edges) |

### D) Failure modes (`failure-modes.test.ts`)

Edge inputs and corruption-resistance.

| # | Test | Asserts |
|---|------|---------|
| D1 | Tags with quotes/newlines/special chars | `tags: ['it\\'s', 'with\\nnewline']` are persisted and round-trip without breaking FTS |
| D2 | `dismissMemory` on non-existent id | No crash; foreign-key cascade may discard the row, but the call doesn't throw |
| D3 | `gcDeadSkills({ threshold: 0, days: 30, dryRun: true })` | Returns all skills with `loaded_count = 0` (current behavior is `routed_count >= 0` which matches everything; this test pins the chosen semantics) |
| D4 | Migration 021 rollback + re-run | `DROP TABLE memory_dismissals; runMigrations()` reapplies 021 cleanly |

## Bug fix policy

If a test exposes a latent bug:
1. Add a TODO comment in the test linking the issue
2. Fix the bug in the same commit batch
3. Re-run full suite to confirm no other tests break

If the bug is **architectural** (requires design discussion), the test stays as `it.skip()` with a reason and the issue is logged as a memory `Todo`.

## Branch strategy

Same worktree `feat/skillbrain-pecche-phase1`. One commit per test file (4 commits max), so each can be reverted independently if needed.

## Estimated test count

196 (after Phase 2) → ~216 (+20 new). Mechanical work; ~1 session via subagent-driven-development.

## Out of scope (deferred)

- **Memory_usage tracking + auto-validate** → Phase 2.5 plan
- **Workspace split** → Phase 3b
- **Embeddings** → Phase 3a
