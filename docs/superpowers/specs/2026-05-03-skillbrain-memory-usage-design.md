# SkillBrain — Phase 2.5 Memory Usage Tracking + Auto-Validate (Design)

**Date:** 2026-05-03
**Status:** Approved by user 2026-05-03

## Goal

Mirror the `skill_usage` infrastructure for memories. Track which memories are loaded/applied per session, and auto-reinforce (validate) memories that were loaded in sessions completed successfully — closing the autolearning loop.

## Why

Currently `MemoryStore.applyDecay(validatedIds, ...)` requires the caller to pass which memories to reinforce. This means decay only ever runs with `validatedIds: []` (auto-decay) — no memory ever gets reinforced unless an explicit MCP call is made. Memories slowly bleed confidence regardless of whether they were useful.

After this phase, every memory loaded in a session that ends with `status: 'completed'` gets reinforced automatically. Bad memories (loaded in failed/blocked sessions) don't get reinforced. Over time, useful memories rise; useless memories decay out.

## Architecture

### Schema

New table `memory_usage` (migration `022`):

```sql
CREATE TABLE IF NOT EXISTS memory_usage (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id   TEXT NOT NULL,
  session_id  TEXT,
  project     TEXT,
  action      TEXT NOT NULL CHECK(action IN ('loaded','applied')),
  ts          TEXT NOT NULL DEFAULT (datetime('now')),
  user_id     TEXT,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_usage_memory  ON memory_usage(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_usage_session ON memory_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_usage_ts      ON memory_usage(ts);
```

Mirrors `skill_usage` (migration 015). No `useful` column — auto-validation handles that role.

### MemoryStore methods (new)

- `logMemoryUsage(memoryId: string, sessionId: string | undefined, action: 'loaded' | 'applied', project?: string, userId?: string): void`
- `getMemoryUsageInSession(sessionId: string, action?: 'loaded' | 'applied'): Array<{ memoryId: string; action: string; ts: string }>`

### MCP tool integration points

1. **`memory_load` tool** — after retrieving the top-K memories, call `logMemoryUsage(m.id, sessionId, 'loaded', project)` for each. Best-effort (never fail the load).
2. **New `memory_apply` MCP tool** — analog of `skill_apply`. Caller invokes when a memory was actually used to solve a task. Logs `'applied'`.
3. **`session_end` route in http-server** — when called with `status: 'completed'`, fetch all loaded+applied memory_ids for that session and call `applyDecay(ids, today)` to reinforce them. Best-effort.

### What's NOT auto-tracked

- `memory_search` (exploratory, would be noisy)
- `memory_query` (admin-style queries, not retrieval-for-use)

Only explicit `memory_load` and `memory_apply` count.

### Edge cases

- Session ends with no loaded memories → applyDecay called with empty array → standard decay tick (no reinforce, just age increment for non-validated).
- Session_id missing or null → skip logging (don't pollute table with NULL session rows; we can't reinforce them anyway).
- Memory deleted between load and session_end → CASCADE removes the usage rows; `applyDecay` filters to active memories.

## Components / Tests

### Task 1 — Migration + logMemoryUsage + getMemoryUsageInSession

**Files:**
- `migrations/022_memory_usage.sql`
- `memory-store.ts` — add prepared stmts + 2 methods
- `tests/memory-usage.test.ts` — 4 tests

Tests:
1. logMemoryUsage inserts row
2. getMemoryUsageInSession returns rows for that session
3. action filter works (loaded vs applied)
4. CASCADE removes usage when memory deleted

### Task 2 — Hook into memory_load tool

**Files:**
- `tools/memory.ts` — modify `memory_load` handler

When sessionId is available in MCP call context, log usage for each returned memory.

Test (in `tests/memory-usage.test.ts`):
5. Calling `memory_load` via store-level integration (or direct simulation) creates `loaded` rows

### Task 3 — `memory_apply` MCP tool

**Files:**
- `tools/memory.ts` — register new tool
- Test: 6. memory_apply logs 'applied' row

### Task 4 — session_end auto-reinforce hook

**Files:**
- `http-server.ts` or wherever session_end is implemented — find via grep
- Test: 7. session_end with status=completed reinforces all loaded memories
- Test: 8. session_end with status=blocked does NOT reinforce

## Out of scope

- Linking `memory_health` to surface "most-applied memories" (separate enhancement)
- Per-project usage stats / dashboard widget
- Cross-session memory recommendation engine

## Estimated count

~8 new tests, single session. 222 → ~230 test count.
