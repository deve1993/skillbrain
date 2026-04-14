# Skills-as-a-Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Serve all 255 skills, 19 agents, 23 commands, and Cortex briefing from the remote MCP server on Coolify, so any Claude Code/Desktop session gets the full SkillBrain system with zero local setup beyond a 3-line MCP config.

**Architecture:** Store skills/agents/commands in SQLite alongside the Memory Graph. Serve them as MCP tools and resources. The existing proxy (`mcp-proxy`) already forwards all remote tools to local stdio — new tools appear automatically.

**Tech Stack:** TypeScript, SQLite (better-sqlite3), MCP SDK, Express, existing CodeGraph infrastructure.

---

### Task 1: Skills SQLite Schema + Store

**Files:**
- Modify: `packages/codegraph/src/storage/memory-schema.ts`
- Create: `packages/codegraph/src/storage/skills-store.ts`

**Step 1: Add skills table to schema**

Add to `memory-schema.ts`:

```sql
CREATE TABLE IF NOT EXISTS skills (
  name TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('domain','lifecycle','process','agent','command')),
  tags TEXT NOT NULL DEFAULT '[]',
  lines INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_type ON skills(type);

CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
  name, description, content, tags,
  content='skills', content_rowid='rowid'
);
```

**Step 2: Create SkillsStore class**

Create `skills-store.ts` with:

```typescript
export class SkillsStore {
  // CRUD
  upsert(name, category, description, content, type, tags): void
  get(name): Skill | undefined
  list(type?): Skill[]
  
  // Search
  search(query, limit?): { skill: Skill; rank: number }[]
  
  // Routing
  route(taskDescription): Skill[]  // FTS search + category matching
  
  // Batch import
  importFromFilesystem(skillsDir, type): number
  
  // Stats
  stats(): { total, byType, byCategory }
}
```

**Step 3: Build and verify**

Run: `cd packages/codegraph && npx tsc`

**Step 4: Commit**

```
feat: add skills table schema and SkillsStore
```

---

### Task 2: Import Script — Filesystem → SQLite

**Files:**
- Create: `packages/codegraph/src/storage/import-skills.ts`
- Modify: `packages/codegraph/src/cli.ts`

**Step 1: Create import script**

Walks `.opencode/skill/`, `.agents/skills/`, `.opencode/agents/`, `.opencode/command/` and imports all files:

```typescript
export function importAllSkills(workspacePath: string): {
  skills: number, agents: number, commands: number
}
```

Parses YAML frontmatter from each SKILL.md/AGENT.md, extracts name + description + category, stores full markdown content.

**Step 2: Add CLI command**

```
codegraph import-skills [path]   # Import skills/agents/commands to SQLite
```

**Step 3: Test locally**

```bash
node packages/codegraph/dist/cli.js import-skills .
# Expected: ✅ Imported: 255 skills, 19 agents, 23 commands
```

**Step 4: Commit**

```
feat: add import-skills CLI command — filesystem to SQLite
```

---

### Task 3: MCP Tools — skill_list, skill_read, skill_route

**Files:**
- Modify: `packages/codegraph/src/mcp/server.ts`

**Step 1: Add 3 skill tools to createMcpServer()**

```typescript
// skill_list — list all skills, optionally filtered by type/category
server.tool('skill_list', 'List all available skills', {
  type: z.enum(['domain','lifecycle','process','agent','command']).optional(),
  category: z.string().optional(),
}, async ({ type, category }) => { ... })

// skill_read — get full content of a skill
server.tool('skill_read', 'Read the full content of a skill', {
  name: z.string().describe('Skill name'),
}, async ({ name }) => { ... })

// skill_route — given a task, find the best skills to load
server.tool('skill_route', 'Given a task description, find the best skills to load', {
  task: z.string().describe('What the user wants to do'),
  limit: z.number().optional().default(5),
}, async ({ task, limit }) => { ... })
```

**Step 2: Build and test via HTTP**

```bash
curl -sk -X POST https://memory.fl1.it/mcp \
  -H "mcp-session-id: $SID" \
  -d '{"method":"tools/call","params":{"name":"skill_list","arguments":{"type":"domain"}}}'
```

**Step 3: Commit**

```
feat: add skill_list, skill_read, skill_route MCP tools
```

---

### Task 4: MCP Tools — agent_list, agent_read, command_list, command_read

**Files:**
- Modify: `packages/codegraph/src/mcp/server.ts`

**Step 1: Add 4 more tools**

These reuse `SkillsStore` with `type` filter:

```typescript
// agent_list — list all 19 agents
server.tool('agent_list', ...)

// agent_read — get full agent prompt
server.tool('agent_read', ...)

// command_list — list all 23 commands
server.tool('command_list', ...)

// command_read — get full command content
server.tool('command_read', ...)
```

**Step 2: Build and test**

**Step 3: Commit**

```
feat: add agent_list, agent_read, command_list, command_read MCP tools
```

---

### Task 5: MCP Tool — cortex_briefing

**Files:**
- Modify: `packages/codegraph/src/mcp/server.ts`

**Step 1: Add cortex_briefing tool**

Generates the 5-layer context briefing server-side:

```typescript
server.tool('cortex_briefing', 'Generate 5-layer working memory briefing', {
  project: z.string().optional(),
  task: z.string().optional(),
}, async ({ project, task }) => {
  // Layer 1: Identity (from skills DB — CLAUDE.md equivalent)
  // Layer 2: Event Log (from session_log)
  // Layer 3: Cross-Session (recent sessions)
  // Layer 4: Project Status (memory stats, contradictions)
  // Layer 5: Knowledge Synthesis (top memories for task via FTS)
})
```

**Step 2: Test**

```bash
curl ... '{"method":"tools/call","params":{"name":"cortex_briefing","arguments":{"task":"add stripe payments"}}}'
```

**Step 3: Commit**

```
feat: add cortex_briefing MCP tool — 5-layer server-side context
```

---

### Task 6: MCP Resources — skillbrain:// URIs

**Files:**
- Modify: `packages/codegraph/src/mcp/server.ts`

**Step 1: Add resource endpoints**

```typescript
server.resource('skillbrain://skills', ...)       // List all skills
server.resource('skillbrain://skills/{name}', ...) // Read one skill
server.resource('skillbrain://agents', ...)        // List all agents
server.resource('skillbrain://agents/{name}', ...) // Read one agent
server.resource('skillbrain://commands', ...)       // List all commands
```

**Step 2: Commit**

```
feat: add skillbrain:// MCP resources for skills, agents, commands
```

---

### Task 7: Import Skills to Coolify Server

**Step 1: Run import locally to populate local DB**

```bash
node packages/codegraph/dist/cli.js import-skills .
```

**Step 2: Upload skills to remote via MCP HTTP batch call**

Script that reads from local DB and calls `skill_upsert` (or direct SQLite upload via Coolify terminal) for all 255+19+23 items.

Alternative: add the import command to the Dockerfile CMD so it auto-imports on first boot from bundled skill files.

**Step 3: Verify remote**

```bash
curl -sk https://memory.fl1.it/api/health
# Expected: skills: 297 (255 + 19 + 23)
```

**Step 4: Commit + Push + Redeploy**

```
feat: import 297 skills/agents/commands to Coolify server
```

---

### Task 8: Update Dashboard with Skills View

**Files:**
- Modify: `packages/codegraph/src/mcp/http-server.ts`

**Step 1: Add skills stats to /api/health and /api/data**

```json
{
  "status": "ok",
  "memories": 13,
  "skills": 255,
  "agents": 19,
  "commands": 23,
  ...
}
```

**Step 2: Add skills section to HTML status page**

Show skills by category, agents list, commands list.

**Step 3: Commit**

```
feat: add skills/agents/commands to dashboard
```

---

### Task 9: Bundle Skills in Docker Image

**Files:**
- Modify: `packages/codegraph/Dockerfile`
- Create: `packages/codegraph/data/` (bundled skill files)

**Step 1: Copy skill files into Docker image**

```dockerfile
# Copy skill data for import on first boot
COPY --from=builder /app/data/skills/ ./data/skills/
```

**Step 2: Add entrypoint script**

```bash
#!/bin/sh
# Import skills if DB is empty (first boot)
node dist/cli.js import-skills /app/data/skills 2>/dev/null || true
# Start HTTP MCP server
exec node dist/cli.js mcp --http
```

**Step 3: Commit + Push + Redeploy**

```
feat: bundle skills in Docker image, auto-import on first boot
```

---

### Task 10: Update README + Final Verification

**Files:**
- Modify: `README.md`

**Step 1: Update Quick Start**

New 3-line setup:

```json
// Add to ~/.claude.json or Claude Desktop config:
"codegraph": {
  "command": "node",
  "args": ["/path/to/cli.js", "mcp-proxy"],
  "env": {
    "SKILLBRAIN_MCP_URL": "https://memory.fl1.it/mcp",
    "CODEGRAPH_AUTH_TOKEN": "your-token"
  }
}
```

That's it. 300+ skills, memories, agents, cortex — all from the server.

**Step 2: End-to-end verification**

1. `skill_list()` → 255 skills
2. `skill_route({ task: "add stripe payments" })` → [payments, forms, auth]
3. `skill_read({ name: "payments" })` → 487 lines of Stripe patterns
4. `agent_list()` → 19 agents
5. `cortex_briefing({ task: "fix auth bug" })` → 5-layer briefing
6. `memory_search({ query: "auth" })` → relevant memories
7. Dashboard at `memory.fl1.it` shows everything

**Step 3: Commit**

```
docs: update README — Skills-as-a-Service, 3-line setup
```

---

## Execution Order & Dependencies

```
Task 1 (schema)
  └→ Task 2 (import script)
       └→ Task 3 (skill tools) ─┐
       └→ Task 4 (agent tools) ─┼→ Task 7 (import to Coolify)
       └→ Task 5 (cortex)      ─┤     └→ Task 9 (Docker bundle)
       └→ Task 6 (resources)   ─┘          └→ Task 10 (README)
                                     └→ Task 8 (dashboard)
```

Tasks 3-6 can run in parallel after Task 2.
