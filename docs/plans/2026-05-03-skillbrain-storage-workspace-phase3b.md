# SkillBrain Phase 3b — Extract `@skillbrain/storage` Workspace

**Goal:** Split the storage layer (DB, migrations, all `*-store.ts`, crypto, decay-scheduler, edge derivation) out of the codegraph monolith into its own pnpm workspace package.

**Why:** Foundation for Phase 3a (embeddings). Storage becomes consumable independently. Reduces codegraph package surface from ~17.5k LOC to ~10k LOC. Enables future package versioning.

## Scope

**In:**
- Move `packages/codegraph/src/storage/` → `packages/storage/src/`
- Move minimal shared utilities used only by storage (hash.ts, logger.ts subsets)
- Move storage-only constants (MEMORY_DECAY_INTERVAL_HOURS, SKILL_DECAY_SESSIONS_THRESHOLD, etc.)
- Move minimal type imports from `core/graph/types.ts` (GraphNode, GraphEdge, FileRecord, RepoMeta — these are used by graph-store.ts)
- Set up monorepo root (top-level pnpm-workspace.yaml + package.json)
- Migrate ~24 storage-related test files

**Out:**
- mcp/, dashboard/, core/ stay in codegraph
- No API changes — purely module re-shuffling
- No new features

## Approach

8 sequential tasks, each verified before proceeding. Done manually in main session (not subagent-dispatched) because 40+ import paths across many files need coordinated updates.

### Tasks

1. **Monorepo root setup** — top-level `pnpm-workspace.yaml` + minimal root `package.json`. Move `onlyBuiltDependencies` to root.

2. **`packages/storage/` skeleton** — package.json (`@skillbrain/storage`, type:module, AGPL), tsconfig.json (extends nothing — minimal independent), vitest.config.ts.

3. **Move storage code** — `git mv packages/codegraph/src/storage/* packages/storage/src/`. Migration files come along.

4. **Move shared deps storage uses** — extract `randomId` from `utils/hash.ts` and `warn` from `utils/logger.ts` into `packages/storage/src/utils/`. Move only the constants used by storage from `src/constants.ts` into `packages/storage/src/constants.ts`. Move 4 graph types (GraphNode, GraphEdge, FileRecord, RepoMeta) into `packages/storage/src/types/graph.ts`.

5. **Create `packages/storage/src/index.ts`** — public API. Re-exports all stores, openDb, closeDb, runMigrations, types (Memory, Skill, etc.), the helper functions external code uses.

6. **Update codegraph package.json** — add `"@skillbrain/storage": "workspace:*"`. Run `pnpm install` at root.

7. **Update codegraph imports** — sed-style across `packages/codegraph/src/{mcp,cli.ts,core,...}`: `from '../storage/<file>.js'` → `from '@skillbrain/storage'` (using public API). Tests stay in codegraph for cross-pkg integration tests; tests that ONLY exercise storage move to `packages/storage/tests/`.

8. **Verify** — `pnpm -r build`, `pnpm -r test` at root. Expected: 231/231 still pass.

## Risk mitigation

- Each task gets its own commit. If a task breaks tests, revert just that commit and retry.
- Tests are the safety net — they're 231 strong by now.
- Worktree isolation — main branch untouched until merge.

## Test Migration

Tests living in `packages/codegraph/tests/` to MOVE to `packages/storage/tests/`:
- crypto.test.ts, crypto-rotation.test.ts
- migrator.test.ts
- memory-{retrieval,retrieval-extended,edge-derivation,dismiss,health,usage}.test.ts
- skills-usage.test.ts, skill-{routing,routing-extended,routing-bm25-bugfix,gc}.test.ts
- projects-store.test.ts
- oauth-store.test.ts
- users-env-store.test.ts
- autolearning.test.ts
- confidence-cap.test.ts
- decay-scheduler.test.ts
- edge-expansion.test.ts
- failure-modes.test.ts
- suggest-bias.test.ts
- integration-pipeline.test.ts (storage-only logic — moves)

Tests STAYING in codegraph:
- oauth-router.test.ts (tests Express routing — mcp layer)
- proxy-dedup.test.ts (tests proxy — mcp layer)

## Out of scope

- No mcp/ refactor (stays in codegraph)
- No dashboard split (stays)
- No publishing the package to npm (just internal workspace)
- No CI updates (assume existing CI runs `pnpm test` which works at root level)
