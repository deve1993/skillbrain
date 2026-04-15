# SkillBrain

> **Your AI coding assistant forgets everything when you close the session.**  
> This fixes that — permanently.

**One MCP connection. 253 skills, collective memory, project tracking, work logs — served from a single remote server.** Claude Code, Claude Desktop, or any MCP client connects and gets the full system. Zero local files needed.

![MCP Tools](https://img.shields.io/badge/MCP%20tools-28-34d399)
![Skills](https://img.shields.io/badge/skills-253-blue)
![Memory Graph](https://img.shields.io/badge/Memory%20Graph-typed%20SQLite-8b5cf6)
![Dual Mode](https://img.shields.io/badge/MCP-stdio%20%2B%20HTTP-f59e0b)
![Dashboard](https://img.shields.io/badge/Hub-6%20pages-ec4899)
![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-blueviolet)
![Claude Desktop](https://img.shields.io/badge/Claude%20Desktop-compatible-blueviolet)
![Self Hosted](https://img.shields.io/badge/self--hosted-Coolify%20%2F%20Docker-ff6b35)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

**Built by [Daniel De Vecchi](https://www.linkedin.com/in/danieldevecchi/) · [GitHub](https://github.com/deve1993)**

---

## 2-Minute Setup

Add this to your Claude Code config (`~/.claude.json` → `mcpServers`):

```json
"codegraph": {
  "command": "node",
  "args": ["/path/to/skillbrain/packages/codegraph/dist/cli.js", "mcp-proxy"],
  "env": {
    "SKILLBRAIN_MCP_URL": "https://your-server.com/mcp",
    "CODEGRAPH_AUTH_TOKEN": "your-token"
  }
}
```

Restart Claude Code. You now have 28 tools, 253 skills, and collective memory.

For **Claude Desktop**, add the same to `~/Library/Application Support/Claude/claude_desktop_config.json`.

---

## See It In Action

### Resume a project after days away

```
> session_resume({ project: "Quickfy" })

## Resume Context: Quickfy

### Last Session
- Date: 2026-04-15
- Task: add stripe payments
- Status: paused
- Summary: Implemented Stripe checkout + webhook handler
- Next steps: Add subscription renewals and account page
- Branch: feat/payments
- Commits: abc123, def456

### Project Memories (3)
- [BugFix conf:3] Cookie forwarding in Server Actions needs explicit headers()
- [Pattern conf:3] Centralize Payload Local API calls in lib/payload.ts
```

### Find the right skill for any task

```
> skill_route({ task: "add stripe payments" })

Recommended: payments (494 lines), churn-prevention (241), pricing-strategy (232)

> skill_read({ name: "payments" })
→ Full Stripe integration guide: checkout, webhooks, subscriptions, error handling
```

### Search collective memory

```
> memory_search({ query: "payload cms access control" })

M-bugfix-xxx [BugFix conf:3]
  "Every collection in multi-tenant Payload MUST have access control functions..."
```

This bug was fixed once, weeks ago, in a completely different session. Without SkillBrain, you'd spend 20 minutes rediscovering it.

---

## Before vs After

| | Without SkillBrain | With SkillBrain |
|---|---|---|
| **Same bug, 3rd time** | 20 min rediscovering | `memory_search` → 2 seconds |
| **New session** | Start from zero | Auto-loads context + top memories |
| **Multiple sessions** | Isolated silos | One shared database — instant sync |
| **Resume after days** | "Where was I?" | `session_resume` → exact state |
| **"Don't do X"** | Forgotten next session | `AntiPattern` with decay — persists |
| **Stale knowledge** | Old patterns pollute | Auto-decay: unused → deprecated |
| **Which skill to use?** | Search docs manually | `skill_route` → instant match |

---

## What Is SkillBrain?

A **self-improving AI brain** deployed on your server. Seven integrated systems:

### 1. Skills-as-a-Service (253 skills)
Domain knowledge served via MCP. Next.js, Stripe, SEO, CRO, Payload CMS, Docker, 20+ marketing skills, 15+ SEO skills — loaded on demand when you need them.

```
skill_list()         → browse all 253 skills
skill_route(task)    → find the best skills for your task
skill_read(name)     → load full skill content
```

### 2. Memory Graph
Typed knowledge graph with 8 memory types and 5 relationship types, stored in SQLite with full-text search.

**Memory types:** Fact, Preference, Decision, Pattern, AntiPattern, BugFix, Goal, Todo

**Edge types:** RelatedTo, Updates, Contradicts, CausedBy, PartOf

Every memory has confidence scoring (1-10) with automatic decay. Bad memories fade. Good ones strengthen.

### 3. Collective Memory
One shared SQLite database on the server. All clients — Claude Code, Claude Desktop, any MCP client — read and write to the same memory. A bug fixed in session A is instantly searchable from session B.

```
Claude Code  ──proxy──→ server ──→ SQLite (shared)
Claude Desktop ──proxy──→ server ──→ SQLite (shared)
Browser       ──HTTPS──→ server ──→ Dashboard
```

### 4. Project Tracking
Projects are auto-derived from sessions. When you work on "Quickfy", the project exists. Every session records: task, status, deliverables, next steps, branch, commits.

```
project_list()                → all projects with status
session_resume({ project })   → full context to continue work
```

### 5. Work Log
Deliverables tracking per project. Not just "what session happened" but "what was actually built."

```
session_end({
  deliverables: "Contact form with Zod validation",
  workType: "feature",
  nextSteps: "Add email sending via Resend"
})
```

### 6. Hub Dashboard
Web dashboard at your server URL. Password-protected. Six pages:
- **Home** — stats, recent memories, sessions
- **Projects** — all projects with status and context
- **Work Log** — deliverables timeline per project
- **Skills** — browse/search 253 skills
- **Memory** — explore memories with filters and detail
- **Sessions** — timeline of all sessions

### 7. Auto-Session Tracking
The proxy auto-detects your project (from `package.json` or folder name), git branch, and client type (Code vs Desktop). Sessions are created and closed automatically. Zero manual intervention.

---

## 28 MCP Tools

### Memory (7)
| Tool | Purpose |
|------|---------|
| `memory_add` | Save a memory (auto-detects contradictions) |
| `memory_search` | Full-text search across all memory fields |
| `memory_query` | Filter by type, project, skill, confidence |
| `memory_load` | Load top-scored memories for current session |
| `memory_add_edge` | Create relationships between memories |
| `memory_stats` | Statistics and active contradictions |
| `memory_decay` | Apply decay cycle (reinforce/decay/deprecate) |

### Skills (9)
| Tool | Purpose |
|------|---------|
| `skill_list` | List all skills with filters |
| `skill_read` | Read full skill content |
| `skill_route` | Find best skills for a task |
| `skill_stats` | Skills statistics by type/category |
| `agent_list` | List all 19 agents |
| `agent_read` | Read agent prompt |
| `command_list` | List all 23 commands |
| `command_read` | Read command content |
| `cortex_briefing` | 5-layer working memory briefing |

### Sessions (4)
| Tool | Purpose |
|------|---------|
| `session_start` | Log session with project + task |
| `session_end` | Close with deliverables + next steps |
| `session_resume` | Full context to continue a project |
| `session_history` | Recent sessions, filter by project |

### Projects (1)
| Tool | Purpose |
|------|---------|
| `project_list` | All projects with status and context |

### Code Intelligence (7)
| Tool | Purpose |
|------|---------|
| `codegraph_query` | Semantic search by concept |
| `codegraph_context` | 360-degree view of a symbol |
| `codegraph_impact` | Blast radius before editing |
| `codegraph_detect_changes` | Map git diff to affected symbols |
| `codegraph_rename` | Graph-aware multi-file rename |
| `codegraph_list_repos` | All indexed repositories |
| `codegraph_cypher` | Raw SQL against the graph |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Claude Code / Claude Desktop / Any MCP Client          │
│       │                                                  │
│       ↓ stdio                                            │
│  proxy.ts (auto-session, auto-project, auto-branch)     │
│       │                                                  │
│       ↓ HTTPS                                            │
│  your-server.com/mcp (Coolify / Docker)                  │
│       │                                                  │
│       ├── 28 MCP tools                                   │
│       ├── 253 skills (SQLite FTS)                        │
│       ├── Memory Graph (8 types, 5 edges)                │
│       ├── Sessions + Projects + Work Log                 │
│       └── Hub Dashboard (6 pages, password-protected)    │
│                                                          │
│       ↓                                                  │
│  SQLite (single source of truth)                         │
└─────────────────────────────────────────────────────────┘
```

---

## Self-Hosted Setup

### Option A: Connect to existing server (2 minutes)

Just add the MCP config as shown in [2-Minute Setup](#2-minute-setup).

### Option B: Deploy your own server

**1. Clone and build**

```bash
git clone https://github.com/deve1993/skillbrain
cd skillbrain/packages/codegraph
npm install && npm run build
```

**2. Import skills**

```bash
node dist/cli.js import-skills ../..
```

**3. Run locally**

```bash
# Local MCP (stdio — for single machine)
node dist/cli.js mcp

# HTTP server (for remote access + dashboard)
node dist/cli.js mcp --http --port 3737 --auth-token your-secret
```

**4. Deploy on Coolify / Docker**

```bash
docker build -t skillbrain .
docker run -p 3737:3737 \
  -v skillbrain-data:/data \
  -e DASHBOARD_PASSWORD=your-password \
  -e CODEGRAPH_AUTH_TOKEN=your-token \
  skillbrain
```

On Coolify: point to `packages/codegraph/Dockerfile`, set env vars, add persistent volume at `/data`.

**5. Configure clients**

```json
"codegraph": {
  "command": "node",
  "args": ["/path/to/dist/cli.js", "mcp-proxy"],
  "env": {
    "SKILLBRAIN_MCP_URL": "https://your-server.com/mcp",
    "CODEGRAPH_AUTH_TOKEN": "your-token"
  }
}
```

---

## How It Compares

| Feature | CLAUDE.md | Mem0 / Zep | Spacebot | **SkillBrain** |
|---------|-----------|------------|----------|----------------|
| Memory | Manual text | Vector DB | Typed graph (Rust) | **Typed graph (SQLite + MCP)** |
| Cross-session | No | API calls | Chat channels | **Shared SQLite via proxy** |
| Memory types | None | Key-value | 8 types | **8 types + 5 edge types** |
| Contradiction detection | No | No | No | **Auto on save** |
| Confidence decay | No | No | No | **Automatic** |
| Skills | No | No | Generic | **253 domain skills** |
| Project tracking | No | No | No | **Auto-derived + work log** |
| Code intelligence | No | No | No | **AST + impact + call graph** |
| Dashboard | No | Cloud UI | No | **6-page self-hosted Hub** |
| Setup | 0 min | API key | Cargo build | **2 min (MCP config)** |
| Works with | Claude Code | Any LLM | Discord/Slack | **Any MCP client** |

---

## Skill Categories (253 total)

| Category | Count | Examples |
|----------|-------|---------|
| Frontend | 9 | nextjs, tailwind, shadcn, i18n, animations |
| Backend | 7 | trpc, auth, forms, database, payments |
| SEO | 14 | audit, technical, content, schema, geo, hreflang |
| Marketing | 15 | CRO, copywriting, pricing, launch strategy |
| Infrastructure | 3 | ci-cd, coolify, docker |
| CMS | 3 | payload, cms, mongodb |
| Process | 105 | brainstorming, debugging, TDD, planning |
| Agents | 19 | planner, builder, ux-designer, seo-specialist |
| Commands | 23 | /frontend, /audit, /new-project, /deploy |

---

## FAQ

**Q: Does this work with Cursor / Windsurf / OpenCode?**  
A: Yes — any tool that supports MCP.

**Q: Can multiple people share the same server?**  
A: Yes. The dashboard is password-protected. MCP uses Bearer token auth. Multiple clients connect to the same SQLite.

**Q: What happens offline?**  
A: The proxy needs internet to reach the server. For offline use, run `node cli.js mcp` directly (local SQLite, no server).

**Q: How does it get smarter over time?**  
A: Every session captures memories (bugs, patterns, decisions). Confidence grows with validation, decays without use. Bad knowledge fades. Good knowledge persists. Skills route better as more memories accumulate.

**Q: What inspired this?**  
A: [Spacebot.sh](https://spacebot.sh) by Spacedrive — their typed memory system with graph edges. We adapted it for MCP + SQLite + self-hosted deployment.

---

## Contributing

Contributions welcome:
- New domain skills
- Memory Graph integrations
- Dashboard improvements
- Multi-language support

---

## License

MIT — use freely, attribute if you build on it.

---

*Built with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) + SkillBrain collective memory*
