# SkillBrain

> **Your AI coding assistant forgets everything when you close the session.**  
> This fixes that — permanently.

![Skills](https://img.shields.io/badge/skills-300+-blue)
![Learnings](https://img.shields.io/badge/learnings-self--improving-green)
![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-blueviolet)
![OpenCode](https://img.shields.io/badge/OpenCode-compatible-blueviolet)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

**Built by [Daniel De Vecchi](https://www.linkedin.com/in/danieldevecchi/) · [GitHub](https://github.com/deve1993)**

---

## The Problem

You've been using Claude Code (or Cursor, Windsurf, OpenCode) for months. You've fixed the same bug three times. You've re-explained your preferred code style dozens of times. Every new session, the AI starts from zero — no memory of what you've built, how you work, or what went wrong last time.

This is not a Claude problem. It's an architecture problem. And it's solvable.

---

## The Solution

**Claude Persistent Skills System** is a structured, self-improving knowledge layer that sits between you and your AI assistant. It gives the AI:

- **Persistent memory** — learnings captured from every session, never lost
- **Project intelligence** — code knowledge graphs via [GitNexus](https://github.com/abhigyanpatwari/GitNexus) indexed before every session
- **Anti-poisoning** — a confidence scoring system that prevents bad learnings from propagating
- **Human-in-the-loop** — you approve promotions from project-specific to global knowledge
- **Semantic retrieval** — loads the 15 most relevant learnings per session, not all of them

The result: each session is smarter than the last. Mistakes made once are never repeated.

---

## How It Works

```mermaid
graph TD
    subgraph Session Start
        A[User names a project] --> B[gitnexus-context]
        B --> C[Index repo in GitNexus]
        C --> D[load-learnings]
        D --> E[Semantic query: top 15 relevant learnings]
        E --> F[AI starts with full context]
    end

    subgraph During Session
        F --> G[Work on code]
        G --> H{Mistake / Pattern / Correction?}
        H -->|Yes| I[capture-learning]
        I --> J[Validate schema]
        J --> K[Check contradictions]
        K --> L[Write to learnings.md]
    end

    subgraph Session End
        L --> M[post-session-review]
        M --> N[Audit for missed learnings]
        N --> O[Apply confidence decay]
        O --> P[Flag stale / deprecated]
        P --> Q[Update pending-review.md]
        Q --> R[Re-index skills graph]
    end
```

### The Learning Lifecycle

Every learning starts at `confidence: 1` (tentative) and evolves based on real usage:

```
Captured → confidence: 1   (treat as suggestion)
Validated 3x → confidence: 4   (reliable pattern)
Validated 8x → confidence: 8+  (established rule)
Not used in 15 sessions → pending-review
Not used in 30 sessions → deprecated
```

**Anti-poisoning**: learnings with `confidence ≤ 2` are surfaced as suggestions, not rules. Bad learnings decay and disappear. Good ones survive and strengthen.

---

## Architecture

```
.agents/
└── skills/
    ├── _schema/
    │   └── learning-template.yml      # Canonical learning schema
    ├── _pending/                       # Subagent temp files (race-condition safe)
    │
    ├── SKILLS-MAP.md                   # Visual graph of the entire ecosystem
    ├── pending-review.md               # Human review queue
    │
    ├── capture-learning/               # Writes validated learnings
    │   └── SKILL.md
    ├── post-session-review/            # Mandatory end-of-session audit
    │   └── SKILL.md
    ├── load-learnings/                 # Retrieval with hard cap
    │   └── SKILL.md
    ├── gitnexus-context/               # Loads code graph + learnings
    │   ├── SKILL.md
    │   └── learnings.md
    │
    ├── systematic-debugging/
    │   ├── SKILL.md
    │   └── learnings.md               # ← grows with every session
    ├── next-best-practices/
    │   ├── SKILL.md
    │   └── learnings.md
    └── [19 other skills]/
        ├── SKILL.md
        └── learnings.md
```

Each skill owns its learnings. The system is modular — add your own skills and they automatically get a `learnings.md`.

---

## Quick Start

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or compatible agent (OpenCode, Cursor with MCP)
- [GitNexus CLI](https://github.com/abhigyanpatwari/GitNexus) installed globally

```bash
npm install -g gitnexus
```

### Installation

**1. Clone into your project's `.agents/` folder**

```bash
cd /your/project
git clone https://github.com/deve1993/skillbrain .agents/skillbrain
```

Or install the skills globally:

```bash
git clone https://github.com/deve1993/skillbrain ~/.agents/skillbrain
```

**2. Index the skills folder**

```bash
gitnexus analyze .agents/skillbrain/skills --skip-git
```

**3. Add to your Claude Code config**

In your project's `AGENTS.md` or `.opencode/AGENTS.md`, add the skills path:

```markdown
Skills directory: .agents/skillbrain/skills/
```

**4. Start a session and say:**

```
"Lavora su [your project]"
# or
"Work on [your project]"
```

The `gitnexus-context` skill triggers automatically, loads your code graph, and pulls the relevant learnings.

### First Session

At the end of your first real coding session, invoke:

```
post-session-review
```

This captures what was learned and sets the flywheel in motion.

---

## Skill Reference

| Skill | Type | Purpose |
|-------|------|---------|
| `gitnexus-context` | Lifecycle | Loads code graph + learnings at session start |
| `load-learnings` | Lifecycle | Retrieves top 15 relevant learnings |
| `capture-learning` | Lifecycle | Writes validated learnings with schema enforcement |
| `post-session-review` | Lifecycle | End-of-session audit, decay, re-index |
| `using-superpowers` | Lifecycle | Orchestrates skill invocation order |
| `brainstorming` | Process | Explores design before implementation |
| `systematic-debugging` | Process | Root cause analysis — no guessing |
| `writing-plans` | Process | Creates implementation plans |
| `executing-plans` | Process | Executes plans task by task |
| `test-driven-development` | Process | TDD enforcement |
| `subagent-driven-development` | Process | Parallel task dispatch with review gates |
| `dispatching-parallel-agents` | Process | Multi-domain parallel work |
| `frontend-design` | Implementation | UI/UX design patterns |
| `next-best-practices` | Implementation | Next.js 15 App Router best practices |
| `vercel-react-best-practices` | Implementation | React performance optimization |
| `ui-ux-pro-max` | Implementation | Advanced UI system |
| `web-design-guidelines` | Implementation | Web design standards |
| `audit-website` | Implementation | Site health check |
| `verification-before-completion` | Quality | Verify before claiming done |
| `requesting-code-review` | Quality | Code review request template |
| `receiving-code-review` | Quality | Code review response protocol |
| `finishing-a-development-branch` | Quality | Branch completion workflow |
| `using-git-worktrees` | Quality | Isolated git worktrees |

---

## Multi-Agent Architecture

SkillBrain uses a **2-tier agent system** with parallel dispatch for complex tasks.

### Agent Hierarchy

```
@planner (Opus — deep reasoning)          @builder (Sonnet — fast execution)
    │                                          │
    ├── ux-designer                            ├── component-builder
    ├── ui-designer                            ├── api-developer
    ├── motion-designer                        ├── i18n-engineer
    ├── growth-architect                       ├── test-engineer
    ├── cro-designer                           ├── devops-engineer
    ├── seo-specialist                         ├── payload-cms
    └── saas-copywriter                        ├── n8n-workflow
                                               ├── performance-engineer
                                               └── security-auditor
```

### How Parallel Dispatch Works

```
User: "Build the landing page for Restaurant Da Mario"

1. Smart Intake → classifies as NEW_SITE → collects brief
2. @planner dispatches IN PARALLEL:
   ├── Agent(ux-designer): wireframes + user flow
   ├── Agent(growth-architect): funnel strategy
   └── Agent(cro-designer): conversion patterns
   → synthesizes into structured brief

3. @builder dispatches IN PARALLEL (git worktree isolation):
   ├── Agent(component-builder): Hero + Nav
   ├── Agent(component-builder): Content sections
   └── Agent(component-builder): Contact form + Footer
   → review + merge

4. Sequential: SEO → Tests → Deploy
```

### Task Routing

| Task Type | Lead | Parallel Subagents |
|-----------|------|--------------------|
| New site / landing | @planner → @builder | ux + ui + growth → component-builder × 3 |
| Marketing strategy | @planner | growth + cro + copywriter + seo |
| UI component | @builder | component-builder (+ ui-designer if needed) |
| Bug fix | @builder | direct (or systematic-debugging skill) |
| Full audit | @builder | security + performance + seo in parallel |
| CMS setup | @builder | payload-cms + api-developer |
| Deploy | @builder | devops-engineer |

### Isolation with Git Worktrees

Each parallel agent works in an **isolated git worktree** — no merge conflicts, no stepping on each other's changes. After completion, work is reviewed and merged back.

### Domain Skills (120 in `.claude/skill/`)

| Category | Skills |
|----------|--------|
| **Core** | nextjs, tailwind, shadcn, payload, i18n, seo |
| **Backend & API** | trpc, graphql (via graphql-architect), auth, forms, database |
| **Real-time** | realtime (SSE, Socket.io, Pusher, Supabase RT) |
| **Background Jobs** | background-jobs (BullMQ, Inngest, Trigger.dev, QStash) |
| **Monitoring** | monitoring-nextjs (Sentry, Pino, OpenTelemetry), analytics |
| **Security** | security-headers (CSP, CORS, rate limiting, OWASP), auth |
| **CI/CD** | ci-cd (GitHub Actions, Docker, Changesets, Turborepo) |
| **Performance** | performance (bundle, CWV, Lighthouse CI, caching) |
| **PWA** | pwa (service workers, push notifications, offline) |
| **Files** | file-handling (S3/R2, PDF gen, CSV/Excel, streaming) |
| **Payments** | payments (Stripe, LemonSqueezy) |
| **CMS** | payload, cms (Sanity, Strapi, Contentful) |
| **Deploy** | coolify, docker |
| **SEO** | 15+ skills (audit, technical, content, schema, geo, hreflang...) |
| **Marketing** | 20+ skills (CRO, copy, ads, email, analytics, A/B testing...) |
| **Legal** | gdpr, iubenda, legal-templates |
| **Video** | remotion, ffmpeg |
| **Frameworks** | astro, nuxt, sveltekit |

### External Skills (from skills.sh)

| Source | Count | Highlights |
|--------|-------|-----------|
| wshobson/agents | 149 | api-designer, graphql-architect, postgres-pro, typescript-pro, secure-code-guardian, monitoring-expert, sre-engineer, rag-architect, microservices-architect |
| expo/skills | 12 | building-native-ui, expo-cicd-workflows, expo-api-routes, expo-deployment |
| callstackincubator | 4 | react-native-best-practices, github-actions |
| jeffallan/claude-skills | ~20 | devops-engineer, terraform-engineer, kubernetes-specialist, websocket-engineer |
| redis/agent-skills | 1 | redis-development (data structures, caching, vector search) |
| vercel/ai | 1 | ai-sdk (generateText, streamText, tool calling, useChat) |

---

## The Learning System

### Capturing a Learning

Learnings are captured by the `capture-learning` skill. They follow a strict schema:

```yaml
## Learning L-next-002
id: "L-next-002"
date: "2025-01-15"
type: "bug-fix"
scope: "global"
tags: [next-intl, i18n, server-components]
confidence: 1
context: "In Next.js 15 App Router with next-intl..."
problem: "Using useTranslations() in a Server Component throws a runtime error"
solution: "Server Components: 'const t = await getTranslations()' — Client Components: 'const t = useTranslations()'"
reason: "getTranslations() is async Server-safe. useTranslations() is the React hook for Client Components. Not interchangeable."
validated_by: ["2025-01-15"]
```

Every learning requires all five core fields: `context`, `problem`, `solution`, `reason`, `tags`.  
Missing any field → rejected. Too generic → rejected. File paths → rejected.

### Anti-Poisoning: Contradiction Detection

Before writing a new learning, the system searches for existing learnings sharing 2+ tags:

```
⚠️ CONFLICT DETECTED
New:      "Always use fetch directly" [tags: fetch, api]
Existing: L-next-012 "Use the custom useFetch hook" — confidence: 4

A) New supersedes old
B) Both valid with different scope
C) Cancel
```

You decide. The system never auto-resolves contradictions.

### Confidence Decay

Learnings lose confidence over time if not validated:

| Sessions without use | Effect |
|---------------------|--------|
| 5+ sessions | `confidence -= 1` |
| 15+ sessions | `status: pending-review` |
| 30+ sessions | `status: deprecated` (not loaded) |

Deprecated learnings are not deleted — they stay in the file as history but are never loaded.

### Human Review Queue

High-stakes decisions always go to you:

```markdown
# pending-review.md

## 2025-01-20
### Promotion Candidates
- L-next-012: project-specific → global? Validated in 3 projects — approve/reject?

### Decay Alerts
- L-debug-003: 16 sessions without validation — keep or deprecate?
```

You review periodically. I apply your decisions.

---

## Why This Architecture

### The token math

| Without system | With system (after session 5) |
|---------------|-------------------------------|
| 8k–15k tokens exploring codebase | 0–3k (already know structure) |
| 3k–8k rediscovering patterns | Loaded in 15 learnings (~3k) |
| 5k–12k error/correction cycles | Minimal (errors don't repeat) |
| **16k–35k total** | **4k–12k total** |

**Net saving: ~14k tokens per session** after break-even (session 3–5).

### Why 15 learnings max

Loading all learnings would fill the context window. The hard cap of 15 ensures:
- Relevant learnings are always loaded
- Context window stays clean for actual work
- Retrieval quality stays high (sorted by confidence × recency × relevance)

### Why human-in-the-loop for promotions

Project-specific patterns should only become global after validation across multiple projects and explicit human approval. Automatic promotion risks converting a coincidence into a rule.

---

## Quality Gates & Automation

SkillBrain includes a full automation layer for code quality, security, and operations.

### Automation Scripts (`~/.config/skillbrain/hooks/`)

| Script | Purpose |
|--------|---------|
| `secrets-scan.sh` | Pre-commit scanner — detects 15+ patterns (Stripe, AWS, Telegram, GitHub, JWT, DB strings, private keys) |
| `env-check.sh <path>` | Validates env vars against `.env.template` + auto-detects required vars from `package.json` dependencies |
| `new-project.sh <path>` | Bootstraps `.env.local` with generated secrets (`AUTH_SECRET`, `PAYLOAD_SECRET`) + copies shared keys from master env |
| `pre-deploy.sh <path>` | Full deploy checklist: git status, build, lint, types, tests, env, security scan, bundle size |
| `dep-audit.sh <path>` | Dependency audit: vulnerabilities, outdated packages, heavy bundles with lighter alternatives |
| `commit-msg-check.sh` | Conventional commit format enforcement (`feat:`, `fix:`, `chore:`, etc.) |

### Master Environment File

All shared API keys live in `~/.config/skillbrain/.env` (never committed). Organized by service: Telegram, Database, Supabase, Auth, Stripe, Resend, Sentry, Analytics, AI/LLM, Upstash, S3/R2, Cloudinary, Odoo, Coolify.

New projects auto-copy shared keys via `new-project.sh`.

### Enforced Rules (in AGENTS.md)

**Security:** No hardcoded secrets, no `any`/`@ts-ignore`, input sanitization with Zod, CSP headers in production.

**Quality:** Conventional commits, branch naming (`feat/`, `fix/`, `chore/`), no `console.log` in production, proper error handling (try/catch + log).

**Performance:** Bundle budget < 300KB first-load JS, no barrel imports from heavy libs, dependency weight check before `pnpm add`.

**Accessibility:** Semantic HTML, ARIA labels, focus management, WCAG AA contrast.

**Deploy:** `pre-deploy.sh` mandatory, health checks (`/api/health` + `/api/ready`), source maps to Sentry only.

### Telegram Bot

An always-on Telegram bot provides remote control of the workspace from your phone:

| Command | Action |
|---------|--------|
| `/status` | Workspace stats (skills, learnings, projects, disk space) |
| `/projects` | List all projects with env status |
| `/env <name>` | Check env vars for a project |
| `/audit <name>` | Run dependency audit |
| `/deploy <name>` | Run pre-deploy checklist |
| `/secrets <name>` | Scan for exposed secrets |
| `/learnings` | Show recent captured learnings |
| `/skills` | Skill count by category |
| `/ip` | Public and local IP |
| `/uptime` | System uptime and running processes |

The bot runs as a macOS LaunchAgent — starts on boot, auto-restarts on crash.

---

## Extending the System

### Adding a new skill

1. Create the directory: `.agents/skillbrain/skills/your-skill-name/`
2. Write `SKILL.md` with frontmatter
3. The system automatically creates `learnings.md` on next `post-session-review`

### Adding seed learnings

Use `capture-learning` with `confidence: 3` (human-validated):

```yaml
confidence: 3
created_in: "manual-seed-YYYY-MM-DD"
```

### Adding a new project

```bash
# Git repo
gitnexus analyze /path/to/project

# Non-git folder
gitnexus analyze /path/to/project --skip-git
```

Then start a session and say "work on [project-name]".

---

## FAQ

**Q: Does this work with Cursor / Windsurf / OpenCode?**  
A: Yes, any agent that supports MCP and skill/rules files. GitNexus MCP works with all major editors.

**Q: Will it work on Windows?**  
A: The skill system works anywhere. GitNexus currently has best support on macOS/Linux.

**Q: Does `--embeddings` work on macOS?**  
A: The `--embeddings` flag during `analyze` crashes on macOS (threading bug in the native binary). Omit it — embeddings load automatically at query time and work correctly.

**Q: How long until I see value?**  
A: Sessions 1–2 are setup. Sessions 3–5 break even. From session 6+ you consistently save tokens and avoid repeated mistakes.

**Q: Can I use this with multiple projects?**  
A: Yes. GitNexus supports multiple indexed repos. The `scope: project-specific` field in learnings ensures project patterns don't bleed globally.

---

## Contributing

Contributions welcome — especially:

- New skills for common stacks (Vue, SvelteKit, Django, etc.)
- Seed learnings for popular frameworks
- Bug reports for the capture-learning validation logic
- Translations of the lifecycle skills

Open an issue or a PR. If you build something interesting on top of SkillBrain, tag me — I'd love to see it.

---

## About the Author

Hi, I'm **Daniel De Vecchi** — a fullstack developer focused on AI-native development workflows, Next.js, and building systems that make AI coding assistants genuinely reliable in production.

SkillBrain is the memory system I built for my own daily workflow. After months of losing context between sessions and re-explaining the same patterns, I decided to solve it properly.

→ **Follow my work:** [LinkedIn](https://www.linkedin.com/in/danieldevecchi/) · [GitHub](https://github.com/deve1993)  
→ **Questions or ideas?** Open an issue or reach out on LinkedIn.

---

## License

MIT — use freely, attribute if you build on it.

---

*Built with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) + [GitNexus](https://github.com/abhigyanpatwari/GitNexus)*
