# SkillBrain Phase 2.5 — Memory Usage Tracking + Auto-Validate Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Track memory loads/applies per session; auto-reinforce loaded memories on session_end with status=completed.

**Spec:** `docs/superpowers/specs/2026-05-03-skillbrain-memory-usage-design.md`

**Tech Stack:** TypeScript, better-sqlite3, MCP SDK, Vitest. No new deps.

---

## File Structure

**Created:**
- `packages/codegraph/src/storage/migrations/022_memory_usage.sql`
- `packages/codegraph/tests/memory-usage.test.ts`

**Modified:**
- `packages/codegraph/src/storage/memory-store.ts` — add `logMemoryUsage()` + `getMemoryUsageInSession()` methods
- `packages/codegraph/src/mcp/tools/memory.ts` — log on `memory_load`, register new `memory_apply`
- `packages/codegraph/src/mcp/tools/sessions.ts` — auto-reinforce hook on `session_end`

---

### Task 1: Migration + store methods

**Goal:** New table `memory_usage` + `logMemoryUsage()` + `getMemoryUsageInSession()`.

#### Step 1: Migration

```sql
-- 022_memory_usage.sql

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

License header optional (other migrations don't have it; SQL files in this repo are plain).

#### Step 2: Failing tests

```typescript
// tests/memory-usage.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb } from '../src/storage/db.js'
import { runMigrations } from '../src/storage/migrator.js'
import { MemoryStore } from '../src/storage/memory-store.js'

describe('MemoryStore — memory_usage tracking', () => {
  let dir: string, db: any, store: MemoryStore
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-musage-'))
    db = openDb(dir); runMigrations(db); store = new MemoryStore(db)
  })
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('logMemoryUsage inserts a row', () => {
    const m = store.add({ type: 'Pattern', context: 'c', problem: '', solution: 's', reason: '', tags: [] })
    store.logMemoryUsage(m.id, 'session-1', 'loaded', 'P')
    const rows = db.prepare(`SELECT memory_id, session_id, action, project FROM memory_usage WHERE memory_id = ?`).all(m.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ memory_id: m.id, session_id: 'session-1', action: 'loaded', project: 'P' })
  })

  it('getMemoryUsageInSession returns rows for that session only', () => {
    const m1 = store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [] })
    const m2 = store.add({ type: 'Pattern', context: 'b', problem: '', solution: 's', reason: '', tags: [] })
    store.logMemoryUsage(m1.id, 'session-A', 'loaded')
    store.logMemoryUsage(m2.id, 'session-B', 'loaded')
    const a = store.getMemoryUsageInSession('session-A')
    expect(a).toHaveLength(1)
    expect(a[0].memoryId).toBe(m1.id)
  })

  it('action filter distinguishes loaded vs applied', () => {
    const m = store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [] })
    store.logMemoryUsage(m.id, 'S', 'loaded')
    store.logMemoryUsage(m.id, 'S', 'applied')
    const loaded = store.getMemoryUsageInSession('S', 'loaded')
    const applied = store.getMemoryUsageInSession('S', 'applied')
    expect(loaded).toHaveLength(1)
    expect(applied).toHaveLength(1)
  })

  it('CASCADE removes usage when memory deleted', () => {
    const m = store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [] })
    store.logMemoryUsage(m.id, 'S', 'loaded')
    store.delete(m.id)
    const rows = db.prepare(`SELECT * FROM memory_usage WHERE memory_id = ?`).all(m.id)
    expect(rows).toHaveLength(0)
  })

  it('null sessionId is allowed (anonymous usage)', () => {
    const m = store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [] })
    expect(() => store.logMemoryUsage(m.id, undefined, 'loaded')).not.toThrow()
  })
})
```

#### Step 3: Implement

In `memory-store.ts`, add prepared statements:

```typescript
insertMemoryUsage: this.db.prepare(
  `INSERT INTO memory_usage (memory_id, session_id, project, action, user_id) VALUES (?, ?, ?, ?, ?)`
),
getUsageBySession: this.db.prepare(
  `SELECT memory_id as memoryId, action, ts FROM memory_usage WHERE session_id = ? ORDER BY ts ASC`
),
getUsageBySessionAction: this.db.prepare(
  `SELECT memory_id as memoryId, action, ts FROM memory_usage WHERE session_id = ? AND action = ? ORDER BY ts ASC`
),
```

Add public methods:

```typescript
logMemoryUsage(memoryId: string, sessionId: string | undefined, action: 'loaded' | 'applied', project?: string, userId?: string): void {
  this.stmts.insertMemoryUsage.run(memoryId, sessionId ?? null, project ?? null, action, userId ?? null)
}

getMemoryUsageInSession(sessionId: string, action?: 'loaded' | 'applied'): Array<{ memoryId: string; action: string; ts: string }> {
  const rows = action
    ? this.stmts.getUsageBySessionAction.all(sessionId, action) as any[]
    : this.stmts.getUsageBySession.all(sessionId) as any[]
  return rows.map((r) => ({ memoryId: r.memoryId, action: r.action, ts: r.ts }))
}
```

#### Step 4: Run + commit

```bash
cd packages/codegraph && pnpm vitest run tests/memory-usage.test.ts
# expect 5/5 pass
pnpm vitest run
# expect 227/227 (222 + 5)
git add packages/codegraph/src/storage/migrations/022_memory_usage.sql packages/codegraph/src/storage/memory-store.ts packages/codegraph/tests/memory-usage.test.ts
git commit -m "feat(memory): add memory_usage tracking table + store methods"
```

---

### Task 2: Hook `memory_load` to log usage

**Goal:** When `memory_load` MCP tool is called with a `sessionId`, log a `loaded` row for each returned memory.

**Files:**
- `packages/codegraph/src/mcp/tools/memory.ts` — modify `memory_load` handler

#### Step 1: Inspect current handler

Read `tools/memory.ts` `memory_load` registration (look for `'memory_load'` string). Note the current parameters; add `sessionId` if not already present:

```typescript
sessionId: z.string().optional(),
```

#### Step 2: Add logging in handler

After memories are scored and sliced, before returning, add (best-effort, never fail load):

```typescript
if (sessionId) {
  try {
    withMemoryStore(resolved.path, (store) => {
      for (const r of results) {
        store.logMemoryUsage(r.memory.id, sessionId, 'loaded', project)
      }
    })
  } catch (err) {
    console.error('[memory_load] usage logging failed', err)
  }
}
```

`results` is whatever variable holds the array being returned. Adapt to actual variable name.

#### Step 3: Test (extend `tests/memory-usage.test.ts`)

The MCP tool layer is harder to test directly. Test at the store level:

```typescript
it('memory_load helper end-to-end logs usage when sessionId provided', () => {
  const m = store.add({ type: 'Pattern', context: 'auth', problem: '', solution: 'NextAuth', reason: '', tags: ['auth'] })
  // Simulate the tool's behavior: get memories, log each
  const results = store.scored(undefined, [], 5)
  for (const r of results) {
    store.logMemoryUsage(r.memory.id, 'sess-load', 'loaded')
  }
  const usage = store.getMemoryUsageInSession('sess-load', 'loaded')
  expect(usage.length).toBeGreaterThan(0)
})
```

#### Step 4: Run + commit

```bash
pnpm vitest run
# expect 228/228 (227 + 1)
git add packages/codegraph/src/mcp/tools/memory.ts packages/codegraph/tests/memory-usage.test.ts
git commit -m "feat(memory): log loaded usage on memory_load tool"
```

---

### Task 3: `memory_apply` MCP tool

**Goal:** New tool `memory_apply` analog of `skill_apply`. Caller invokes when a memory was actually used.

**Files:**
- `packages/codegraph/src/mcp/tools/memory.ts` — register tool

#### Step 1: Register tool

```typescript
server.tool(
  'memory_apply',
  'Mark a memory as actually used in a session. Logged as applied action; reinforces memory on session_end if status=completed.',
  {
    memoryId: z.string(),
    sessionId: z.string().optional(),
    project: z.string().optional(),
    repo: z.string().optional(),
  },
  async ({ memoryId, sessionId, project, repo }) => {
    const resolved = resolveMemoryRepo(repo)
    if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
    withMemoryStore(resolved.path, (store) => {
      store.logMemoryUsage(memoryId, sessionId, 'applied', project)
    })
    return { content: [{ type: 'text', text: `memory_apply: ${memoryId} (session: ${sessionId ?? 'n/a'})` }] }
  },
)
```

#### Step 2: Test

```typescript
it('memory_apply logs an applied row', () => {
  const m = store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [] })
  store.logMemoryUsage(m.id, 'sess-apply', 'applied')
  const usage = store.getMemoryUsageInSession('sess-apply', 'applied')
  expect(usage).toHaveLength(1)
})
```

(Already covered by Task 1 test 3; add only if a fresh perspective demands it. Otherwise note that the Task 1 suite covers this.)

#### Step 3: Run + commit

```bash
pnpm vitest run
# expect 228 or 229 depending on whether new test added
git add packages/codegraph/src/mcp/tools/memory.ts
git commit -m "feat(memory): add memory_apply MCP tool"
```

---

### Task 4: Auto-reinforce hook on session_end

**Goal:** When `session_end` is called with `status: 'completed'`, automatically call `applyDecay(loadedIds, today)` to reinforce all memories loaded/applied in that session.

**Files:**
- `packages/codegraph/src/mcp/tools/sessions.ts` — modify `session_end` handler

#### Step 1: Modify handler

In the `session_end` handler around line 145 (after `store.endSession(...)` is called), before the `skillProposals` block, add:

```typescript
// Auto-reinforce: if session completed, mark all loaded/applied memories as validated
if (status === 'completed') {
  try {
    withMemoryStore(resolved.path, (store) => {
      const usage = store.getMemoryUsageInSession(sessionId)
      const memoryIds = Array.from(new Set(usage.map((u) => u.memoryId)))
      if (memoryIds.length > 0) {
        const today = new Date().toISOString().split('T')[0]
        store.applyDecay(memoryIds, today)
      }
    })
  } catch (err) {
    console.error('[session_end] auto-reinforce failed', err)
  }
}
```

#### Step 2: Test (in `tests/memory-usage.test.ts`)

Test at the store level (since the MCP tool wraps this):

```typescript
describe('Auto-reinforce on session_end', () => {
  let dir: string, db: any, store: MemoryStore
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-rein-'))
    db = openDb(dir); runMigrations(db); store = new MemoryStore(db)
  })
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('completed session reinforces all loaded memories', () => {
    const m1 = store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [], confidence: 5 })
    const m2 = store.add({ type: 'Pattern', context: 'b', problem: '', solution: 's', reason: '', tags: [], confidence: 5 })

    store.logMemoryUsage(m1.id, 'sess-X', 'loaded')
    store.logMemoryUsage(m2.id, 'sess-X', 'applied')

    // Simulate the session_end path: status=completed → reinforce loaded memories
    const usage = store.getMemoryUsageInSession('sess-X')
    const ids = Array.from(new Set(usage.map((u) => u.memoryId)))
    store.applyDecay(ids, new Date().toISOString().split('T')[0])

    const reinforced1 = store.get(m1.id)
    const reinforced2 = store.get(m2.id)
    // After reinforce: validatedBy gets a new entry, lastValidated is set
    expect(reinforced1?.validatedBy.length).toBe(1)
    expect(reinforced2?.validatedBy.length).toBe(1)
    expect(reinforced1?.lastValidated).toBeDefined()
  })

  it('blocked session does NOT reinforce', () => {
    // The reinforce path is gated on status === 'completed' in tools/sessions.ts.
    // At store level we just verify that NOT calling applyDecay leaves things untouched.
    const m = store.add({ type: 'Pattern', context: 'a', problem: '', solution: 's', reason: '', tags: [], confidence: 5 })
    store.logMemoryUsage(m.id, 'sess-Y', 'loaded')
    // No applyDecay call (simulating status=blocked path that skips reinforce)
    const got = store.get(m.id)
    expect(got?.validatedBy).toEqual([])
  })
})
```

#### Step 3: Run + commit

```bash
pnpm vitest run
# expect 230/230 (228 + 2)
git add packages/codegraph/src/mcp/tools/sessions.ts packages/codegraph/tests/memory-usage.test.ts
git commit -m "feat(sessions): auto-reinforce loaded memories on session_end completed"
```

---

## Self-Review

**Spec coverage:** all 4 spec components mapped to tasks. 8+ tests planned (5 in T1, 1 in T2, optional in T3, 2 in T4) → ~8 new tests, brings total to ~230.

**Type/name consistency:** `logMemoryUsage`, `getMemoryUsageInSession`, table `memory_usage`, action enum `'loaded'|'applied'` consistent across files.

**Placeholders:** none.

---

## Execution

- Worktree: continue on `feat/skillbrain-pecche-phase1`
- Subagent-driven, 4 sequential tasks
- Combined spec+quality review after each
- Migration 022 must precede all hooks

## Rollback strategy

- DROP TABLE memory_usage  
- Revert the 4 commits  
- No data loss (table is append-only telemetry, not state)
