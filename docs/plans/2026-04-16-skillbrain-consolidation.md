# SkillBrain Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 7 technical debt areas in SkillBrain (migrations, crypto fail-fast, tests, skills source of truth, server.ts split, constants centralization, frontend modularization) so the system stops accumulating fragility as new features land.

**Architecture:** Three phases, each deliverable independently. Phase 1 (Foundation) eliminates data-loss risks. Phase 2 (Architecture) makes the code easier to change. Phase 3 (Frontend) is opportunistic cleanup. Every phase leaves the system in a working state; commits are small and independent.

**Tech Stack:** TypeScript, Node.js (ESM), better-sqlite3, vitest, Express 5, @modelcontextprotocol/sdk, vanilla JS frontend.

---

## File Structure Overview

### New files
- `packages/codegraph/src/storage/migrations/` — migration folder
- `packages/codegraph/src/storage/migrations/000_bootstrap.sql` — initial schema baseline
- `packages/codegraph/src/storage/migrations/001_session_log_tracking.sql` — work_type, deliverables, last_heartbeat
- `packages/codegraph/src/storage/migrations/002_projects_team.sql` — team_lead, team_members
- `packages/codegraph/src/storage/migrator.ts` — migration runner
- `packages/codegraph/src/constants.ts` — all magic numbers/timings
- `packages/codegraph/src/mcp/tools/memory.ts` — memory_* tools
- `packages/codegraph/src/mcp/tools/projects.ts` — project_* tools
- `packages/codegraph/src/mcp/tools/sessions.ts` — session_* tools
- `packages/codegraph/src/mcp/tools/skills.ts` — skill_* tools
- `packages/codegraph/src/mcp/tools/codegraph.ts` — codegraph_* tools
- `packages/codegraph/src/mcp/tools/index.ts` — tool registry
- `packages/codegraph/tests/crypto.test.ts`
- `packages/codegraph/tests/projects-store.test.ts`
- `packages/codegraph/tests/proxy-dedup.test.ts`
- `packages/codegraph/tests/migrator.test.ts`
- `packages/codegraph/vitest.config.ts`
- `packages/codegraph/public/js/api.js` — fetch wrapper
- `packages/codegraph/public/js/render.js` — rendering helpers
- `packages/codegraph/public/js/modal.js` — modal edit logic

### Modified files
- `packages/codegraph/src/storage/db.ts` — use migrator instead of inline `exec`
- `packages/codegraph/src/storage/memory-schema.ts` — remove migration SQL (moved to files)
- `packages/codegraph/src/mcp/server.ts` — shrink to registration + main bootstrap
- `packages/codegraph/src/mcp/http-server.ts` — fail-fast on missing ENCRYPTION_KEY at startup
- `packages/codegraph/src/mcp/proxy.ts` — import constants
- `packages/codegraph/src/storage/memory-store.ts` — import constants
- `packages/codegraph/public/app.js` — delegate to `js/*.js` modules
- `packages/codegraph/public/index.html` — add `<script type="module">` for new modules
- `CLAUDE.md` (project) — remove "Read .claude/skill/" lines, mandate skill_route + skill_read only

---

# Phase 1 — Foundation (Critical Fixes)

## Task 1: Schema Versioning System

**Why:** Today `PROJECTS_MIGRATE_SQL` and `SESSION_LOG_MIGRATE_SQL` run `ALTER TABLE` blindly at every boot with try/catch silencing duplicate-column errors. No audit trail, no rollback, no idempotency beyond "ignore errors" — exactly how we bricked Coolify's DB schema.

**Files:**
- Create: `packages/codegraph/src/storage/migrations/000_bootstrap.sql`
- Create: `packages/codegraph/src/storage/migrations/001_session_log_tracking.sql`
- Create: `packages/codegraph/src/storage/migrations/002_projects_team.sql`
- Create: `packages/codegraph/src/storage/migrator.ts`
- Create: `packages/codegraph/tests/migrator.test.ts`
- Modify: `packages/codegraph/src/storage/db.ts`
- Modify: `packages/codegraph/src/storage/memory-schema.ts` (remove `*_MIGRATE_SQL` exports)

- [ ] **Step 1: Create migrations folder and write baseline migration**

Create `packages/codegraph/src/storage/migrations/000_bootstrap.sql` containing the concatenated contents of all existing `CREATE TABLE` statements currently in `schema.ts` and `memory-schema.ts` (minus the `*_MIGRATE_SQL` blocks). This is the "from-zero" schema — the target state for a fresh DB.

Copy verbatim from existing exports in order:
1. `SCHEMA_SQL` (from `schema.ts`)
2. `FTS_SCHEMA_SQL`, `FTS_TRIGGERS_SQL`
3. `MEMORY_SCHEMA_SQL`, `MEMORY_FTS_SQL`
4. `SESSION_LOG_SQL` (with all columns from `SESSION_LOG_MIGRATE_SQL` merged into base definition — i.e. `work_type TEXT`, `deliverables TEXT`, `last_heartbeat TEXT` now live in the `CREATE TABLE`)
5. `NOTIFICATIONS_SQL`
6. `SKILLS_SCHEMA_SQL`, `SKILLS_FTS_SQL`
7. `PROJECTS_SCHEMA_SQL` (with `team_lead TEXT` and `team_members TEXT DEFAULT '[]'` merged into base)
8. `PROJECT_ENV_SCHEMA_SQL`

- [ ] **Step 2: Create incremental migrations for existing columns**

Create `packages/codegraph/src/storage/migrations/001_session_log_tracking.sql`:

```sql
ALTER TABLE session_log ADD COLUMN work_type TEXT;
ALTER TABLE session_log ADD COLUMN deliverables TEXT;
ALTER TABLE session_log ADD COLUMN last_heartbeat TEXT;
```

Create `packages/codegraph/src/storage/migrations/002_projects_team.sql`:

```sql
ALTER TABLE projects ADD COLUMN team_lead TEXT;
ALTER TABLE projects ADD COLUMN team_members TEXT DEFAULT '[]';
```

Note: both files are idempotent in spirit but the runner (next step) handles "already applied" logic via `schema_migrations` table, NOT via try/catch.

- [ ] **Step 3: Write the failing test for migrator**

Create `packages/codegraph/tests/migrator.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations, getAppliedMigrations } from '../src/storage/migrator.js'

describe('migrator', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
  })

  it('applies all migrations on fresh DB and records them', () => {
    runMigrations(db)
    const applied = getAppliedMigrations(db)
    expect(applied).toContain('000_bootstrap')
    expect(applied).toContain('001_session_log_tracking')
    expect(applied).toContain('002_projects_team')
  })

  it('is idempotent — running twice is a no-op', () => {
    runMigrations(db)
    const first = getAppliedMigrations(db)
    runMigrations(db)
    const second = getAppliedMigrations(db)
    expect(first).toEqual(second)
  })

  it('migrates legacy DB with existing tables but no schema_migrations row', () => {
    db.exec(`CREATE TABLE session_log (id TEXT PRIMARY KEY, session_name TEXT NOT NULL, started_at TEXT NOT NULL)`)
    db.exec(`CREATE TABLE projects (name TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)
    runMigrations(db)
    const cols = db.prepare(`PRAGMA table_info(session_log)`).all() as { name: string }[]
    expect(cols.map((c) => c.name)).toContain('work_type')
    expect(cols.map((c) => c.name)).toContain('last_heartbeat')
  })
})
```

- [ ] **Step 4: Run test to confirm it fails**

Run: `cd packages/codegraph && pnpm exec vitest run tests/migrator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement the migrator**

Create `packages/codegraph/src/storage/migrator.ts`:

```typescript
import type Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

const SCHEMA_MIGRATIONS_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`

function listMigrations(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return []
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

export function getAppliedMigrations(db: Database.Database): string[] {
  db.exec(SCHEMA_MIGRATIONS_SQL)
  const rows = db.prepare(`SELECT name FROM schema_migrations ORDER BY name`).all() as { name: string }[]
  return rows.map((r) => r.name)
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name)
  return !!row
}

export function runMigrations(db: Database.Database): void {
  db.exec(SCHEMA_MIGRATIONS_SQL)
  const applied = new Set(getAppliedMigrations(db))
  const files = listMigrations()

  for (const file of files) {
    const name = file.replace(/\.sql$/, '')
    if (applied.has(name)) continue

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')

    // Legacy DBs: if 000_bootstrap and core tables already exist, skip exec but record row
    if (name === '000_bootstrap' && tableExists(db, 'session_log') && tableExists(db, 'projects')) {
      db.prepare(`INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`)
        .run(name, new Date().toISOString())
      continue
    }

    // ALTER TABLE migrations: run each statement, tolerate "duplicate column" for legacy DBs
    const statements = sql.split(';').map((s) => s.trim()).filter((s) => s)
    const tx = db.transaction(() => {
      for (const stmt of statements) {
        try {
          db.exec(stmt)
        } catch (err: any) {
          if (!err.message?.includes('duplicate column')) throw err
        }
      }
      db.prepare(`INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`)
        .run(name, new Date().toISOString())
    })
    tx()
  }
}
```

- [ ] **Step 6: Wire migrator into db.ts and remove inline MIGRATE loops**

Modify `packages/codegraph/src/storage/db.ts` — replace the full `openDb` body below `const db = new Database(dbPath)` down through the `db.exec(PROJECT_ENV_SCHEMA_SQL)` line with:

```typescript
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  runMigrations(db)

  return db
```

Add import at top: `import { runMigrations } from './migrator.js'`.

Remove these imports (unused after migrator takeover): `SCHEMA_SQL`, `FTS_SCHEMA_SQL`, `FTS_TRIGGERS_SQL`, `MEMORY_SCHEMA_SQL`, `MEMORY_FTS_SQL`, `SESSION_LOG_SQL`, `SESSION_LOG_MIGRATE_SQL`, `NOTIFICATIONS_SQL`, `SKILLS_SCHEMA_SQL`, `SKILLS_FTS_SQL`, `PROJECTS_SCHEMA_SQL`, `PROJECTS_MIGRATE_SQL`, `PROJECT_ENV_SCHEMA_SQL`.

- [ ] **Step 7: Delete the now-dead MIGRATE constants**

Modify `packages/codegraph/src/storage/memory-schema.ts`:
- Delete the `SESSION_LOG_MIGRATE_SQL` export (lines 98-103)
- Delete the `PROJECTS_MIGRATE_SQL` export (lines 105-109)

Keep the other exports (`MEMORY_SCHEMA_SQL`, `SESSION_LOG_SQL`, etc.) — they are still sources of truth, just no longer consumed by `db.ts`. The migration files are copies.

Alternative (cleaner, pick one): delete `memory-schema.ts` entirely and the analogous SQL exports in `schema.ts`, since migration files are now the source of truth. Choose this only if no other file imports from `memory-schema.ts` — verify with `grep -r "from.*memory-schema" packages/codegraph/src`.

- [ ] **Step 8: Run vitest and confirm all migrator tests pass**

Run: `cd packages/codegraph && pnpm exec vitest run tests/migrator.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 9: Build the package to confirm no TypeScript errors**

Run: `cd packages/codegraph && pnpm run build`
Expected: exits 0. Copy the `migrations/` folder into `dist/storage/` if `tsc` doesn't copy it automatically — add `"include": ["src/**/*"]` confirmation and a post-build copy. If it doesn't, add to the top of `package.json`'s build script:

```json
"build": "tsc && cp -r src/storage/migrations dist/storage/migrations"
```

- [ ] **Step 10: Commit**

```bash
git add packages/codegraph/src/storage/migrations \
        packages/codegraph/src/storage/migrator.ts \
        packages/codegraph/src/storage/db.ts \
        packages/codegraph/src/storage/memory-schema.ts \
        packages/codegraph/tests/migrator.test.ts \
        packages/codegraph/package.json
git commit -m "feat(db): schema versioning with migration files + migrator"
```

---

## Task 2: ENCRYPTION_KEY Fail-Fast Validation

**Why:** Today the http-server boots happily even without `ENCRYPTION_KEY` set. Every existing encrypted env var becomes unreadable; every new write throws at request time. The failure mode is silent and late. Fix: if the DB already contains encrypted rows, the server MUST have a working key at startup.

**Files:**
- Modify: `packages/codegraph/src/mcp/http-server.ts`
- Modify: `packages/codegraph/src/storage/crypto.ts` (expose key validation helper)

- [ ] **Step 1: Add validation helper to crypto.ts**

Modify `packages/codegraph/src/storage/crypto.ts` — add this export at the end:

```typescript
/**
 * Verify encryption is usable: key set, correct length, and able to
 * encrypt+decrypt a sentinel. Throws with a clear message if not.
 */
export function assertEncryptionUsable(): void {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error(
      'ENCRYPTION_KEY env var not set. Generate one with:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
      'Then set it in your Coolify env vars and redeploy.',
    )
  }
  const sentinel = 'skillbrain-healthcheck'
  const enc = encrypt(sentinel)
  const dec = decrypt(enc)
  if (dec !== sentinel) {
    throw new Error('ENCRYPTION_KEY roundtrip failed — key may be wrong for existing DB')
  }
}
```

- [ ] **Step 2: Fail-fast in http-server bootstrap**

Find the boot section of `packages/codegraph/src/mcp/http-server.ts` (after `const db = openDb(...)`, before `app.listen`). Add:

```typescript
import { assertEncryptionUsable } from '../storage/crypto.js'

// If the DB has any encrypted rows, we MUST have a working key.
const row = db.prepare(`SELECT COUNT(*) as n FROM project_env_vars`).get() as { n: number }
if (row.n > 0) {
  assertEncryptionUsable() // throws with clear error
  console.log(`✓ ENCRYPTION_KEY validated (${row.n} encrypted env vars readable)`)
} else if (process.env.ENCRYPTION_KEY) {
  // No encrypted rows yet, but key is set — validate it still roundtrips
  assertEncryptionUsable()
  console.log('✓ ENCRYPTION_KEY validated (no encrypted rows yet)')
} else {
  console.warn('⚠ ENCRYPTION_KEY not set — env var storage disabled until configured')
}
```

Place this block where the other startup logs live. The exact location depends on current layout; put it after `openDb` and before `server.listen`.

- [ ] **Step 3: Manually verify fail-fast works**

```bash
cd packages/codegraph && pnpm run build
# simulate "DB has rows but key missing"
unset ENCRYPTION_KEY
# point at a prod DB copy if you have one, else skip and trust the code path
node dist/cli.js serve
```

Expected: on a DB with existing encrypted rows and no key, the process exits with the "ENCRYPTION_KEY env var not set" error instead of starting. On a fresh DB, it starts with a warning.

- [ ] **Step 4: Commit**

```bash
git add packages/codegraph/src/storage/crypto.ts \
        packages/codegraph/src/mcp/http-server.ts
git commit -m "feat(security): fail-fast on missing ENCRYPTION_KEY when DB has encrypted rows"
```

---

## Task 3: Critical Path Tests

**Why:** Zero test coverage on code paths where a bug costs us real data: crypto roundtrip (env vars), `project_merge` (merging breaks → lost sessions/memories), session dedup (breaks → session explosion). These three tests are the minimum safety net.

**Files:**
- Create: `packages/codegraph/vitest.config.ts`
- Create: `packages/codegraph/tests/crypto.test.ts`
- Create: `packages/codegraph/tests/projects-store.test.ts`
- Create: `packages/codegraph/tests/proxy-dedup.test.ts`

- [ ] **Step 1: Add vitest config**

Create `packages/codegraph/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
  },
})
```

- [ ] **Step 2: Crypto roundtrip test**

Create `packages/codegraph/tests/crypto.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { encrypt, decrypt, isEncryptionAvailable, assertEncryptionUsable } from '../src/storage/crypto.js'

const TEST_KEY = 'a'.repeat(64) // 32 bytes of 'a' in hex

describe('crypto', () => {
  const originalKey = process.env.ENCRYPTION_KEY

  beforeAll(() => { process.env.ENCRYPTION_KEY = TEST_KEY })
  afterAll(() => { process.env.ENCRYPTION_KEY = originalKey })

  it('roundtrips plaintext through encrypt → decrypt', () => {
    const plain = 'DATABASE_URL=postgres://user:pass@host/db'
    const enc = encrypt(plain)
    expect(enc.ciphertext).not.toBe(plain)
    expect(enc.iv).toBeTruthy()
    expect(enc.authTag).toBeTruthy()
    const dec = decrypt(enc)
    expect(dec).toBe(plain)
  })

  it('uses a fresh IV per call — same plaintext gives different ciphertext', () => {
    const a = encrypt('same')
    const b = encrypt('same')
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('decrypt fails with tampered authTag', () => {
    const enc = encrypt('secret')
    enc.authTag = Buffer.alloc(16, 0).toString('base64') // zero out tag
    expect(() => decrypt(enc)).toThrow()
  })

  it('throws without ENCRYPTION_KEY', () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('x')).toThrow(/ENCRYPTION_KEY/)
    expect(isEncryptionAvailable()).toBe(false)
    process.env.ENCRYPTION_KEY = TEST_KEY
  })

  it('assertEncryptionUsable roundtrips successfully', () => {
    expect(() => assertEncryptionUsable()).not.toThrow()
  })
})
```

- [ ] **Step 3: Run crypto tests — they must pass**

Run: `cd packages/codegraph && pnpm exec vitest run tests/crypto.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 4: ProjectsStore merge test (preserves sessions + memories + env)**

Create `packages/codegraph/tests/projects-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/storage/migrator.js'
import { ProjectsStore } from '../src/storage/projects-store.js'

const TEST_KEY = 'b'.repeat(64)

describe('ProjectsStore.merge', () => {
  let db: Database.Database
  let store: ProjectsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new ProjectsStore(db)
  })

  it('moves sessions from alias to primary and deletes alias', () => {
    const now = new Date().toISOString()
    store.upsert({ name: 'primary', createdAt: now, updatedAt: now })
    store.upsert({ name: 'alias', createdAt: now, updatedAt: now })

    db.prepare(`INSERT INTO session_log (id, session_name, started_at, project) VALUES (?, ?, ?, ?)`)
      .run('S-1', 'test', now, 'alias')
    db.prepare(`INSERT INTO session_log (id, session_name, started_at, project) VALUES (?, ?, ?, ?)`)
      .run('S-2', 'test', now, 'alias')

    store.merge('alias', 'primary')

    const aliasSessions = db.prepare(`SELECT COUNT(*) as n FROM session_log WHERE project = ?`).get('alias') as { n: number }
    const primarySessions = db.prepare(`SELECT COUNT(*) as n FROM session_log WHERE project = ?`).get('primary') as { n: number }
    expect(aliasSessions.n).toBe(0)
    expect(primarySessions.n).toBe(2)
    expect(store.get('alias')).toBeNull()
    expect(store.get('primary')).not.toBeNull()
  })

  it('moves memories from alias to primary', () => {
    const now = new Date().toISOString()
    store.upsert({ name: 'primary', createdAt: now, updatedAt: now })
    store.upsert({ name: 'alias', createdAt: now, updatedAt: now })

    db.prepare(
      `INSERT INTO memories (id, type, context, problem, solution, reason, created_at, updated_at, project)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('M-1', 'Fact', 'c', 'p', 's', 'r', now, now, 'alias')

    store.merge('alias', 'primary')
    const m = db.prepare(`SELECT project FROM memories WHERE id = ?`).get('M-1') as { project: string }
    expect(m.project).toBe('primary')
  })

  it('moves encrypted env vars from alias to primary (no decrypt needed)', () => {
    const now = new Date().toISOString()
    store.upsert({ name: 'primary', createdAt: now, updatedAt: now })
    store.upsert({ name: 'alias', createdAt: now, updatedAt: now })

    store.setEnv('alias', 'API_KEY', 'secret-value')
    store.merge('alias', 'primary')

    const val = store.getEnv('primary', 'API_KEY')
    expect(val).toBe('secret-value')
    expect(store.getEnv('alias', 'API_KEY')).toBeNull()
  })

  it('throws when primary does not exist', () => {
    expect(() => store.merge('alias', 'nonexistent')).toThrow()
  })
})
```

- [ ] **Step 5: Run projects-store tests**

Run: `cd packages/codegraph && pnpm exec vitest run tests/projects-store.test.ts`
Expected: 4/4 PASS.

If `ProjectsStore` does not expose a `merge(aliasName, primaryName)` method yet (it's called via MCP tool currently), extract the logic from `mcp/server.ts` project_merge handler into a method on the store. This is a pure refactor: move the SQL from the handler into `ProjectsStore.merge()` and have the handler call it. The MCP tool behavior stays identical.

- [ ] **Step 6: Session dedup logic test (pure function extraction)**

The dedup logic in `proxy.ts` is inline inside `startProxy`. Extract it into a pure function so it's testable.

Modify `packages/codegraph/src/mcp/proxy.ts` — extract lines 92-98 into a top-level function above `startProxy`:

```typescript
export interface SessionCandidate { id: string; status: string; started: string }

export function findReusableSession(
  sessions: SessionCandidate[],
  now: number,
  windowMs: number,
): SessionCandidate | null {
  return sessions.find((s) => {
    if (s.status !== 'in-progress') return false
    const started = new Date(s.started).getTime()
    return now - started < windowMs
  }) ?? null
}
```

In `startProxy`, replace the inline find with: `const recent = findReusableSession(sessions, Date.now(), SESSION_REUSE_WINDOW_MS)`.

Create `packages/codegraph/tests/proxy-dedup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { findReusableSession } from '../src/mcp/proxy.js'

const WINDOW = 4 * 60 * 60 * 1000
const NOW = new Date('2026-04-16T12:00:00Z').getTime()

describe('findReusableSession', () => {
  it('reuses a fresh in-progress session', () => {
    const sessions = [
      { id: 'S-1', status: 'in-progress', started: new Date(NOW - 60 * 60 * 1000).toISOString() },
    ]
    expect(findReusableSession(sessions, NOW, WINDOW)?.id).toBe('S-1')
  })

  it('ignores completed sessions', () => {
    const sessions = [
      { id: 'S-1', status: 'completed', started: new Date(NOW - 60 * 1000).toISOString() },
    ]
    expect(findReusableSession(sessions, NOW, WINDOW)).toBeNull()
  })

  it('ignores stale in-progress sessions older than window', () => {
    const sessions = [
      { id: 'S-1', status: 'in-progress', started: new Date(NOW - 5 * 60 * 60 * 1000).toISOString() },
    ]
    expect(findReusableSession(sessions, NOW, WINDOW)).toBeNull()
  })

  it('returns first match from list', () => {
    const sessions = [
      { id: 'S-1', status: 'in-progress', started: new Date(NOW - 30 * 60 * 1000).toISOString() },
      { id: 'S-2', status: 'in-progress', started: new Date(NOW - 10 * 60 * 1000).toISOString() },
    ]
    expect(findReusableSession(sessions, NOW, WINDOW)?.id).toBe('S-1')
  })

  it('returns null on empty list', () => {
    expect(findReusableSession([], NOW, WINDOW)).toBeNull()
  })
})
```

- [ ] **Step 7: Run all tests**

Run: `cd packages/codegraph && pnpm run test`
Expected: migrator + crypto + projects-store + proxy-dedup tests all green.

- [ ] **Step 8: Commit**

```bash
git add packages/codegraph/vitest.config.ts \
        packages/codegraph/tests \
        packages/codegraph/src/mcp/proxy.ts \
        packages/codegraph/src/storage/projects-store.ts
git commit -m "test: critical paths (crypto, projects merge, session dedup)"
```

---

# Phase 2 — Architecture

## Task 4: Skills Single Source of Truth

**Why:** Global CLAUDE.md says "NEVER Read disk skills — ALWAYS skill_route + skill_read"; project CLAUDE.md still says "Read .claude/skill/{name}/SKILL.md". Two instructions, one truth. We standardize on the server.

**Files:**
- Modify: `CLAUDE.md` (project root)

- [ ] **Step 1: Rewrite the Skill System section in project CLAUDE.md**

In `CLAUDE.md`, find the `## Skill System — How To Use` section starting with `### Domain Skills (112 in `.claude/skill/`)` and replace it with:

```markdown
## Skill System — How To Use

### Source of truth: SkillBrain MCP server

ALL skills (253) live on the server at `memory.fl1.it`. Local `.claude/skill/` and `.agents/skills/` folders are **legacy mirrors** and may be stale — **do not read them**.

### How to load a skill

When a task matches a domain:

1. Route: `skill_route({ task: "<current task>" })` — returns recommended skills
2. Read: `skill_read({ name: "<skill name>" })` — loads the skill content

Never use `Read` on `.claude/skill/*/SKILL.md` or `.agents/skills/*/SKILL.md`.

### Routing reference (abridged — the server has the authoritative list)

[keep the existing routing table unchanged — it's a human-friendly catalog of what's available]
```

Keep the existing routing table (the `| Task | Load skill |` matrix) — it's useful human doc of *what* skills exist. What changes is the *how* (server, not disk).

- [ ] **Step 2: Also remove the "Read .agents/skills/..." lifecycle skill references**

In the same file, find the `### Lifecycle Skills (follow manually by reading SKILL.md)` table. Replace the "Action" column entries that start with `Index repo`, `Write validated learning`, etc., with corresponding MCP calls. Example: "Session start on a project" → action becomes `session_resume({ project })` + `memory_load()`. Alternatively, leave the table as reference for *when* but add a note above: "Follow these moments by calling `skill_read({ name: '<skill>' })` to fetch instructions."

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: skills load from SkillBrain server only, not disk"
```

---

## Task 5: Split server.ts

**Why:** `server.ts` is 1508 lines with 30+ tool handlers. Adding any tool means opening the monster file, scrolling to find the right spot, and adding to a single flat registration. Split by domain makes adding a tool a localized edit.

**Files:**
- Create: `packages/codegraph/src/mcp/tools/memory.ts`
- Create: `packages/codegraph/src/mcp/tools/projects.ts`
- Create: `packages/codegraph/src/mcp/tools/sessions.ts`
- Create: `packages/codegraph/src/mcp/tools/skills.ts`
- Create: `packages/codegraph/src/mcp/tools/codegraph.ts`
- Create: `packages/codegraph/src/mcp/tools/index.ts`
- Modify: `packages/codegraph/src/mcp/server.ts`

- [ ] **Step 1: Define the tool module contract**

Create `packages/codegraph/src/mcp/tools/index.ts`:

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type Database from 'better-sqlite3'

export interface ToolContext {
  db: Database.Database
}

export type ToolRegistrar = (server: McpServer, ctx: ToolContext) => void

import { registerMemoryTools } from './memory.js'
import { registerProjectTools } from './projects.js'
import { registerSessionTools } from './sessions.js'
import { registerSkillTools } from './skills.js'
import { registerCodegraphTools } from './codegraph.js'

export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  registerMemoryTools(server, ctx)
  registerProjectTools(server, ctx)
  registerSessionTools(server, ctx)
  registerSkillTools(server, ctx)
  registerCodegraphTools(server, ctx)
}
```

Type `ToolContext` stays minimal — add fields only if multiple modules need them. If a single module needs a specific store, instantiate locally inside the registrar.

- [ ] **Step 2: Extract memory_* tools**

Create `packages/codegraph/src/mcp/tools/memory.ts`. Open `src/mcp/server.ts` and find every call to `server.tool('memory_xxx', ...)`. Cut each entire handler block (from `server.tool(` to the matching closing `)`), paste into `memory.ts` inside a function:

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { MemoryStore } from '../../storage/memory-store.js'
import type { ToolContext } from './index.js'

export function registerMemoryTools(server: McpServer, ctx: ToolContext): void {
  const store = new MemoryStore(ctx.db)

  server.tool('memory_add', /* ...paste schema... */, async (args) => {
    /* ...paste original handler body verbatim, swapping any `store` reference to match... */
  })
  // repeat for memory_search, memory_query, memory_load, memory_stats, memory_add_edge,
  // memory_decay, memory_suggest
}
```

Do not rewrite logic — paste verbatim. The only change is relocating imports to the new file's top.

- [ ] **Step 3: Extract project_* tools**

Same as step 2 but for `project_scan, project_list_full, project_get, project_update, project_set_env, project_set_env_batch, project_get_env, project_generate_env_example, project_merge, project_list`. Create `packages/codegraph/src/mcp/tools/projects.ts`:

```typescript
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ProjectsStore } from '../../storage/projects-store.js'
import type { ToolContext } from './index.js'

export function registerProjectTools(server: McpServer, ctx: ToolContext): void {
  const store = new ProjectsStore(ctx.db)
  // paste all project_* tool registrations here
}
```

- [ ] **Step 4: Extract session_* tools**

Create `packages/codegraph/src/mcp/tools/sessions.ts` with `session_start, session_end, session_resume, session_history, session_heartbeat` handlers — move verbatim.

- [ ] **Step 5: Extract skill_* tools**

Create `packages/codegraph/src/mcp/tools/skills.ts` with `skill_list, skill_read, skill_route, skill_stats, agent_list, agent_read, command_list, command_read, cortex_briefing` handlers — move verbatim.

- [ ] **Step 6: Extract codegraph_* tools**

Create `packages/codegraph/src/mcp/tools/codegraph.ts` with `codegraph_query, codegraph_context, codegraph_impact, codegraph_detect_changes, codegraph_rename, codegraph_list_repos, codegraph_cypher` handlers — move verbatim.

- [ ] **Step 7: Shrink server.ts to bootstrap only**

Modify `packages/codegraph/src/mcp/server.ts` — after extraction, the file should be ~150 lines: imports, `createServer()` function that instantiates `McpServer`, opens the DB, calls `registerAllTools(server, { db })`, and exports the server. All tool definitions are now in `tools/*.ts`.

- [ ] **Step 8: Build and smoke-test one tool per module**

Run: `cd packages/codegraph && pnpm run build && pnpm run test`
Expected: all existing tests still green, build succeeds.

Smoke test manually against the running MCP server:

```bash
# Start HTTP server locally
node dist/cli.js serve &
# Call one tool from each module
curl -X POST http://localhost:PORT/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"memory_stats","arguments":{}}}'
curl -X POST http://localhost:PORT/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"project_list","arguments":{}}}'
curl -X POST http://localhost:PORT/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"skill_list","arguments":{}}}'
```

Expected: all three return valid JSON-RPC results. Kill the server.

- [ ] **Step 9: Commit**

```bash
git add packages/codegraph/src/mcp/tools \
        packages/codegraph/src/mcp/server.ts
git commit -m "refactor(mcp): split 1508-line server.ts into tools/{memory,projects,sessions,skills,codegraph}"
```

---

## Task 6: Centralize Constants

**Why:** `HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000` in proxy.ts, `SESSION_REUSE_WINDOW_MS = 4 * 60 * 60 * 1000` in proxy.ts, 15-min stale threshold implicit in server, 24h decay check in memory-store.ts:699. Changing any of these means hunting through files and hoping you found them all.

**Files:**
- Create: `packages/codegraph/src/constants.ts`
- Modify: `packages/codegraph/src/mcp/proxy.ts`
- Modify: `packages/codegraph/src/storage/memory-store.ts`
- Modify: `packages/codegraph/src/mcp/tools/sessions.ts` (autoCloseStale threshold)

- [ ] **Step 1: Create the constants module**

Create `packages/codegraph/src/constants.ts`:

```typescript
/**
 * Central timing and threshold constants for SkillBrain.
 * Change here, not in 4 different files.
 */

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

export const HEARTBEAT_INTERVAL_MS = 5 * MINUTE
export const SESSION_STALE_THRESHOLD_MS = 15 * MINUTE
export const SESSION_REUSE_WINDOW_MS = 4 * HOUR

export const MEMORY_DECAY_INTERVAL_HOURS = 24
export const MEMORY_STALE_VALIDATION_DAYS = 90

export const DEFAULT_DASHBOARD_PORT = 3333
```

- [ ] **Step 2: Replace hard-coded values in proxy.ts**

Modify `packages/codegraph/src/mcp/proxy.ts`:

```typescript
import { HEARTBEAT_INTERVAL_MS, SESSION_REUSE_WINDOW_MS } from '../constants.js'
```

Replace `const SESSION_REUSE_WINDOW_MS = 4 * 60 * 60 * 1000` (line 80) — delete the local declaration.
Replace `const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000` (line 145) — delete the local declaration.

- [ ] **Step 3: Replace hard-coded values in memory-store.ts**

Modify `packages/codegraph/src/storage/memory-store.ts`:

```typescript
import { MEMORY_DECAY_INTERVAL_HOURS } from '../constants.js'
```

Around line 699 (`const hoursSince = ...`), the comparison `hoursSince < 24` becomes `hoursSince < MEMORY_DECAY_INTERVAL_HOURS`. Adjust the naming where needed — the raw `24` literal should not appear in this file anymore.

- [ ] **Step 4: Replace stale threshold in sessions tool**

In `packages/codegraph/src/mcp/tools/sessions.ts` (post-split), find the `autoCloseStale` logic. Import `SESSION_STALE_THRESHOLD_MS` from `constants.ts` and use it instead of any inline `15 * 60 * 1000`.

- [ ] **Step 5: Build + test**

Run: `cd packages/codegraph && pnpm run build && pnpm run test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/codegraph/src/constants.ts \
        packages/codegraph/src/mcp/proxy.ts \
        packages/codegraph/src/storage/memory-store.ts \
        packages/codegraph/src/mcp/tools/sessions.ts
git commit -m "refactor: centralize timing constants in src/constants.ts"
```

---

# Phase 3 — Frontend Cleanup

## Task 7: Modularize app.js

**Why:** `public/app.js` is 994 lines of vanilla JS doing SPA routing, fetch, rendering, modal state, form serialization. Extracting three focused modules (`api.js`, `render.js`, `modal.js`) costs little and pays off at the next UI feature.

**Files:**
- Create: `packages/codegraph/public/js/api.js`
- Create: `packages/codegraph/public/js/render.js`
- Create: `packages/codegraph/public/js/modal.js`
- Modify: `packages/codegraph/public/app.js`
- Modify: `packages/codegraph/public/index.html`

- [ ] **Step 1: Extract fetch wrapper into api.js**

Create `packages/codegraph/public/js/api.js`:

```javascript
const API = '' // same-origin

async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (res.status === 401) {
    window.location.href = '/login.html'
    throw new Error('unauthorized')
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.headers.get('content-type')?.includes('application/json') ? res.json() : res.text()
}

export const api = {
  get: (path) => req(path),
  post: (path, body) => req(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => req(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => req(path, { method: 'DELETE' }),
}
```

In `app.js`, search for every `fetch(` call. Replace each with the equivalent `api.get/post/put/del`. Import at top: `import { api } from './js/api.js'`.

- [ ] **Step 2: Extract modal edit into modal.js**

Create `packages/codegraph/public/js/modal.js`. Copy these functions verbatim from `app.js`: `openEditProjectModal`, `editField`, `editSelect`, `memberRow`, `saveProject`, `closeEditModal`. At top of `modal.js`:

```javascript
import { api } from './api.js'
export { openEditProjectModal, closeEditModal, saveProject }
```

Note: if these functions reference a shared `openProjectDetail` (to re-render after save), either import it (`import { openProjectDetail } from './render.js'`) or keep `openProjectDetail` accessible via a callback parameter passed to `saveProject(event, name, onSaved)`.

In `app.js`, delete the moved function definitions and add: `import { openEditProjectModal, closeEditModal, saveProject } from './js/modal.js'`.

- [ ] **Step 3: Extract rendering helpers into render.js**

Create `packages/codegraph/public/js/render.js`. Move DOM-building helpers: `renderProjectList`, `renderProjectDetail`, `renderOverviewTab`, `renderAdminTab`, `renderEnvTab`, `renderActivityTab`, any `escapeHtml` / `formatDate` helpers. Export all of them.

Functions that call `api.*` should import it: `import { api } from './api.js'`.

In `app.js`, delete the moved code and add the imports.

- [ ] **Step 4: Update index.html to load app.js as a module**

Modify `packages/codegraph/public/index.html`. Find the `<script>` tag that loads `app.js`. Change to:

```html
<script type="module" src="/app.js"></script>
```

- [ ] **Step 5: Smoke-test in the browser**

```bash
cd packages/codegraph && node dist/cli.js serve
# open http://localhost:PORT in the browser
```

Click through each tab: Overview → Admin → Env Vars → Activity. Open a project, click Edit, add a team member, save. Expected: all flows work identically to before the split. Watch the browser console for module import errors.

- [ ] **Step 6: Commit**

```bash
git add packages/codegraph/public
git commit -m "refactor(ui): split app.js into js/{api,render,modal}.js modules"
```

---

# Post-Plan Verification

- [ ] **Final check: all tests pass**

Run: `cd packages/codegraph && pnpm run test`
Expected: migrator (3) + crypto (5) + projects-store (4) + proxy-dedup (5) = 17/17 green.

- [ ] **Final check: build produces a working bundle**

Run: `cd packages/codegraph && pnpm run build && node dist/cli.js --help`
Expected: CLI exits 0 and shows help.

- [ ] **Final check: migrations/ copied into dist/**

Run: `ls packages/codegraph/dist/storage/migrations/`
Expected: three `.sql` files listed.

- [ ] **Final check: deploy smoke test**

Redeploy to Coolify. Hit `memory.fl1.it/api/projects-meta/skillbrain`. Expected: 200 with project JSON. Open dashboard, click a project, click Edit, save. Expected: no regressions.

- [ ] **Final commit + tag if desired**

```bash
git tag -a v0.2.0-consolidation -m "SkillBrain consolidation: migrations, tests, constants, split server"
git push --follow-tags
```

---

# Notes for the Executor

- **Do not batch Phase 2 into Phase 1 commits** — Phase 1 must be independently deployable. If Phase 2 breaks something, we can still ship Phase 1.
- **Every task ends with `pnpm run test`.** If tests fail, stop and diagnose; do not proceed.
- **If you find placeholder-looking text in any task step, stop and ask.** Every step should have concrete code or commands.
- **The `migrations/` folder must be copied to `dist/`** or the server can't find migration files at runtime. The updated `build` script handles this.
- **Priority order matches the plan.** Phase 1 Task 1 (migrations) is the blocker — don't start Task 5 (split server) before Task 1 lands, because the split will touch db.ts imports and you want migration code stable first.
