# SkillBrain Hardening Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical security leak, split monolithic http-server into route modules, clean orphaned sessions, and boost test coverage on core stores.

**Architecture:** Extract 7 route groups from http-server.ts (1921 LOC) into `src/mcp/routes/*.ts`, each owning its Express Router. Add a session-cleanup endpoint. Remove credentials leaked in project notes. Add integration tests for memory-store and projects-store.

**Tech Stack:** TypeScript, Express 5, better-sqlite3, Vitest

---

### Task 1: Remove leaked credentials from Agent_Lead_chatbot project notes

**Files:**
- Modify: `packages/codegraph/src/mcp/tools/projects.ts`

**Step 1: Clear the notes field via MCP tool call**

Use `project_update` to set notes to empty string for project `Agent_Lead_chatbot`.
If no direct update tool exists, run a one-off script:

```typescript
// run via: node -e "..."
import { openDb, closeDb } from './src/storage/db.js'
const db = openDb(process.env.SKILLBRAIN_ROOT || process.cwd())
db.prepare(`UPDATE projects SET notes = '' WHERE name = 'Agent_Lead_chatbot'`).run()
closeDb(db)
```

**Step 2: Verify the notes are cleared**

Run: `curl -s http://localhost:3737/api/projects | jq '.[] | select(.name=="Agent_Lead_chatbot") | .notes'`
Expected: `""` or `null`

**Step 3: Add notes sanitization to project_list_full tool**

In the MCP tool that returns project data, strip the `notes` field from responses — or at minimum never return it in bulk list endpoints. Notes containing secrets should never transit over MCP.

---

### Task 2: Split http-server.ts — Extract route modules

**Files:**
- Create: `packages/codegraph/src/mcp/routes/auth.ts`
- Create: `packages/codegraph/src/mcp/routes/memories.ts`
- Create: `packages/codegraph/src/mcp/routes/sessions.ts`
- Create: `packages/codegraph/src/mcp/routes/projects.ts`
- Create: `packages/codegraph/src/mcp/routes/skills.ts`
- Create: `packages/codegraph/src/mcp/routes/admin.ts`
- Create: `packages/codegraph/src/mcp/routes/review.ts`
- Create: `packages/codegraph/src/mcp/routes/user-profile.ts`
- Create: `packages/codegraph/src/mcp/routes/index.ts`
- Modify: `packages/codegraph/src/mcp/http-server.ts`

**Step 1: Create shared route context type**

Create `packages/codegraph/src/mcp/routes/index.ts`:

```typescript
import { Router } from 'express'

export interface RouteContext {
  skillbrainRoot: string
  dashboardPassword: string
  sessionSecret: string
  smtpConfig: { host: string; port: number; user: string; pass: string; from: string; secure: boolean }
  anthropicApiKey: string
  publicIssuer: string
  legacyTokenUserEmail: string
}

export type RouteFactory = (ctx: RouteContext) => Router
```

**Step 2: Extract auth routes**

Move `/auth/login` and `/api/auth/password` into `routes/auth.ts`:

```typescript
import { Router } from 'express'
import type { RouteContext } from './index.js'
// ... move hashPassword, verifyPassword, generatePassword here

export function createAuthRouter(ctx: RouteContext): Router {
  const router = Router()
  // POST /auth/login
  // PUT /api/auth/password
  return router
}
```

**Step 3: Extract memories routes**

Move `/api/memories`, `/api/memories/:id` (GET, DELETE, PUT) into `routes/memories.ts`.

**Step 4: Extract sessions routes**

Move `/api/sessions`, `/api/sessions/:id`, `/api/sessions/cleanup-duplicates` into `routes/sessions.ts`.

**Step 5: Extract projects routes**

Move `/api/projects`, `/api/projects/:name`, `/api/projects-meta/*`, `/api/worklog` into `routes/projects.ts`.

**Step 6: Extract skills routes**

Move `/api/skills`, `/api/skills/:name`, `/api/skills/:name/versions`, `/telemetry/skill-usage` into `routes/skills.ts`.

**Step 7: Extract admin routes**

Move `/api/admin/team/*`, `/api/admin/rotate-key`, `/api/admin/oauth/*` into `routes/admin.ts`.

**Step 8: Extract review routes**

Move `/api/review/*` into `routes/review.ts`.

**Step 9: Extract user-profile routes**

Move `/api/me`, `/api/me/api-keys/*`, `/api/me/env/*`, `/api/audit/*` into `routes/user-profile.ts`.

**Step 10: Wire routes into http-server.ts**

Replace all extracted route definitions with:

```typescript
import { createAuthRouter } from './routes/auth.js'
import { createMemoriesRouter } from './routes/memories.js'
// ...

app.use(createAuthRouter(routeCtx))
app.use(createMemoriesRouter(routeCtx))
app.use(createSessionsRouter(routeCtx))
app.use(createProjectsRouter(routeCtx))
app.use(createSkillsRouter(routeCtx))
app.use(createAdminRouter(routeCtx))
app.use(createReviewRouter(routeCtx))
app.use(createUserProfileRouter(routeCtx))
```

**Step 11: Verify build**

Run: `cd packages/codegraph && pnpm build`
Expected: Clean build, no errors.

**Step 12: Run existing tests**

Run: `cd packages/codegraph && pnpm test`
Expected: All existing tests pass.

**Step 13: Commit**

```bash
git add packages/codegraph/src/mcp/routes/ packages/codegraph/src/mcp/http-server.ts
git commit -m "refactor(server): split http-server.ts into 8 route modules"
```

---

### Task 3: Session cleanup — purge orphaned paused sessions

**Files:**
- Modify: `packages/codegraph/src/storage/memory-store.ts`
- Modify: `packages/codegraph/src/mcp/tools/sessions.ts`

**Step 1: Add cleanupOrphanedSessions method to MemoryStore**

```typescript
cleanupOrphanedSessions(olderThanDays = 7): number {
  const threshold = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
  const result = this.db.prepare(`
    DELETE FROM session_log
    WHERE status = 'paused'
      AND ended_at < ?
      AND (summary IS NULL OR summary LIKE 'Session ended (no activity%' OR summary LIKE 'Auto-closed%')
      AND memories_created = 0
  `).run(threshold)
  return result.changes
}
```

**Step 2: Expose as MCP tool in sessions.ts**

Add `session_cleanup` tool that calls this method.

**Step 3: Run test**

Run: `cd packages/codegraph && pnpm test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/codegraph/src/storage/memory-store.ts packages/codegraph/src/mcp/tools/sessions.ts
git commit -m "feat(sessions): add cleanup tool for orphaned paused sessions"
```

---

### Task 4: Add tests for projects-store (notes sanitization + env CRUD)

**Files:**
- Modify: `packages/codegraph/tests/projects-store.test.ts`

**Step 1: Write test for notes field not leaking secrets**

```typescript
it('should strip notes from listFull when containing potential secrets', () => {
  // Insert a project with notes containing an API key pattern
  // Call listFull and verify notes is sanitized
})
```

**Step 2: Run test to verify it fails**

Run: `cd packages/codegraph && pnpm test -- tests/projects-store.test.ts`
Expected: FAIL

**Step 3: Implement sanitization in projects-store.ts**

Add `sanitizeNotes()` that redacts values matching secret patterns (sk-*, eyJ*, passwords).

**Step 4: Run test to verify it passes**

Run: `cd packages/codegraph && pnpm test -- tests/projects-store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/codegraph/tests/projects-store.test.ts packages/codegraph/src/storage/projects-store.ts
git commit -m "feat(security): sanitize notes field in project list responses"
```

---

### Task 5: Add tests for memory-store core operations

**Files:**
- Modify: `packages/codegraph/tests/memory-retrieval.test.ts`

**Step 1: Add tests for session lifecycle (start → heartbeat → autoClose)**

```typescript
describe('session lifecycle', () => {
  it('should auto-close stale sessions with smart summary', () => { ... })
  it('should detect workType from git commits', () => { ... })
  it('should cleanup orphaned sessions', () => { ... })
})
```

**Step 2: Add tests for memory CRUD + FTS**

```typescript
describe('memory CRUD', () => {
  it('should update memory and sync FTS index', () => { ... })
  it('should delete memory', () => { ... })
  it('should handle edge operations', () => { ... })
})
```

**Step 3: Run tests**

Run: `cd packages/codegraph && pnpm test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/codegraph/tests/memory-retrieval.test.ts
git commit -m "test(memory): add session lifecycle and CRUD tests"
```
