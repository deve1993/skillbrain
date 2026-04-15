# SkillBrain — Claude Code Bootstrap

> This project is a **self-improving AI coding workspace** with 300+ skills, persistent learnings, and code intelligence.
> Everything under `.claude/` (symlink → `.opencode/`) is part of you. Use it.

---

## SkillBrain Real-Time Protocol (MANDATORY)

You are connected to the SkillBrain collective memory via MCP. Use it continuously — not just at session end.

### On session start (FIRST THING YOU DO):

```
session_start({
  sessionName: "Claude Code",
  project: "{project name from user request}",
  task: "{what the user asked to do}",
  branch: "{current git branch if applicable}"
})
```

Then check for previous work:
```
session_resume({ project: "{project name}" })
```

If there's previous context, read it and inform the user: "I see you last worked on X, status was Y, next steps were Z."

### During work (CONTINUOUS — every time you learn something):

**Save immediately when any of these happen:**

| Event | Action |
|-------|--------|
| Bug fixed after 2+ attempts | `memory_add({ type: "BugFix", ... })` |
| User corrects your approach | `memory_add({ type: "Preference", ... })` |
| You discover a non-obvious pattern | `memory_add({ type: "Pattern", ... })` |
| You make an architectural decision | `memory_add({ type: "Decision", ... })` |
| Something should NOT be done | `memory_add({ type: "AntiPattern", ... })` |
| A technical fact is verified | `memory_add({ type: "Fact", ... })` |

**Do NOT wait for session end. Save in real-time.**

Before working on unfamiliar code, search for existing knowledge:
```
memory_search({ query: "{what you're about to do}" })
```

Before loading a skill from disk, try the server first:
```
skill_route({ task: "{current task}" })
skill_read({ name: "{skill name}" })
```

### On session end:

```
session_end({
  sessionId: "{from session_start}",
  summary: "{what was accomplished}",
  nextSteps: "{what should be done next — CRITICAL for continuity}",
  status: "completed" | "paused" | "blocked",
  filesChanged: [...],
  commits: [...],
  blockers: "{if any}"
})
```

### Rules:
1. **NEVER skip session_start** — without it, this session is invisible to future sessions
2. **NEVER skip session_end with nextSteps** — without it, resuming work is guesswork
3. **Save memories IN REAL-TIME** — waiting for session end means losing context if the session crashes
4. **Always search before implementing** — `memory_search` before coding, `skill_route` before designing
5. **Include project name in EVERY session** — sessions without project are uncategorized noise

### What's automatic (you DON'T need to do these):
- Session tracking: the MCP proxy auto-creates a session on connect and auto-closes on disconnect
- Project detection: auto-derived from working directory (`package.json` name or folder name)
- Branch detection: auto-read from `git branch --show-current`

You only need to manually call `session_start` if you want to set a specific **task description**. Otherwise it happens automatically.

---

## Architecture

```
.claude/                     → symlink to .opencode/
  skill/                     → 120 domain skills (SEO, auth, payments, marketing, CMS, API, realtime, monitoring...)
  command/                   → 23 slash commands (/new-project, /frontend, /audit...)
  agent/                     → 56 agent prompts (orchestrator, planner, builder, designers...)
  scripts/                   → automation (audit_skills.py, run_evals.sh, load_project_context.sh)
  guides/                    → reference docs
  SYSTEM.md                  → system registry, versions, MCP status
  skill/INDEX.md             → full skill catalog with "when to load" routing table

.agents/skills/              → 112 lifecycle/process/quality/external skills
  codegraph-context/          → code intelligence loader (session start)
  capture-learning/          → persist learnings (during session)
  post-session-review/       → audit + decay + re-index (session end)
  load-learnings/            → semantic retrieval of top-15 learnings
  _schema/                   → learning validation templates
  _pending/                  → subagent temp files for learning merge
  SKILLS-MAP.md              → visual ecosystem graph

AGENTS.md                    → Smart Intake Protocol + Form Protocol + ESLint Protocol + CodeGraph Protocol
Progetti/                    → client project directories
```

---

## Skill System — How To Use

### Domain Skills (112 in `.claude/skill/`)

When a task matches a domain, **read the SKILL.md** before working:

```
Read .claude/skill/{name}/SKILL.md
```

**Routing table** (see `.claude/skill/INDEX.md` for complete list):

| Task | Load skill |
|------|-----------|
| Next.js / React / App Router | `nextjs` |
| Tailwind CSS | `tailwind` |
| shadcn/ui components | `shadcn` |
| Payload CMS | `payload` |
| i18n / translations | `i18n` |
| SEO implementation | `seo`, `seo-for-devs` |
| Forms + validation | `forms` |
| Auth (Auth.js v5) | `auth` |
| Payments (Stripe) | `payments` |
| Email (Resend) | `email` |
| Database (Prisma/Drizzle) | `database` |
| Animations (Framer Motion) | `animations` |
| Landing page architecture | `landing-architecture`, `copywriting`, `cro-patterns` |
| Deploy (Coolify/Docker) | `coolify`, `docker` |
| Video (Remotion) | `remotion` |
| n8n automation | `n8n` |
| Form → Odoo CRM | `odoo-crm-lead`, `forms` |
| GDPR / legal | `gdpr`, `iubenda`, `legal-templates` |
| New client site (Pixarts) | `pixarts/workflow`, `pixarts/client-site`, `pixarts/multitenancy` |
| Design system | `pixarts/design-system` |
| Website cloning | `website-cloning`, `scraping` |
| Marketing strategy | `product-marketing-context`, `launch-strategy`, `pricing-strategy` |
| CRO patterns | `cro-patterns`, `form-cro`, `signup-flow-cro`, `popup-cro` |
| tRPC type-safe APIs | `trpc`, `typescript-pro` |
| Real-time / WebSocket / chat | `realtime`, `websocket-engineer` |
| Background jobs / queues | `background-jobs` |
| CI/CD / GitHub Actions | `ci-cd`, `devops-engineer` |
| Error tracking / logging / Sentry | `monitoring-nextjs`, `monitoring-expert` |
| Security headers / CSP / CORS | `security-headers`, `secure-code-guardian` |
| Performance / bundle / CWV | `performance` |
| PWA / offline / push notifications | `pwa` |
| File upload S3/R2 / PDF / CSV | `file-handling` |
| GraphQL API | `graphql-architect` |
| PostgreSQL optimization | `postgres-pro`, `database-optimizer` |
| Redis / caching | `redis-development` |
| AI features / chatbot / RAG | `ai-sdk`, `rag-architect` |
| React Native / Expo | `react-native-best-practices`, `building-native-ui` |
| Kubernetes / infra | `kubernetes-specialist`, `devops-engineer` |
| TypeScript advanced | `typescript-pro` |

### Process Skills (via Skill tool — already registered)

These are invocable directly: `brainstorming`, `systematic-debugging`, `writing-plans`, `executing-plans`, `test-driven-development`, `subagent-driven-development`, `dispatching-parallel-agents`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `using-git-worktrees`, `finishing-a-development-branch`, `frontend-design`, `ui-ux-pro-max`, `next-best-practices`, `vercel-react-best-practices`, `web-design-guidelines`, `audit-website`.

### Lifecycle Skills (follow manually by reading SKILL.md)

| When | Skill | Action |
|------|-------|--------|
| Session start on a project | `.agents/skills/codegraph-context/SKILL.md` | Index repo + load top-15 learnings |
| Bug fixed non-obviously (2+ attempts) | `.agents/skills/capture-learning/SKILL.md` | Write validated learning |
| User corrected my approach | `.agents/skills/capture-learning/SKILL.md` | Write preference/anti-pattern learning |
| Pattern discovered | `.agents/skills/capture-learning/SKILL.md` | Write pattern learning |
| Session ending | `.agents/skills/post-session-review/SKILL.md` | Audit + decay + merge pending + re-index |

---

## Smart Intake Protocol

**Before executing any request, classify it** (see AGENTS.md for full matrix):

| Signal | Type | Action |
|--------|------|--------|
| "landing page", "sito", "website" | NUOVO_SITO | Brief required → `/frontend` |
| "componente", "feature", "button" | COMPONENTE | Start directly |
| "fix", "bug", "errore" | FIX | Start directly (use `systematic-debugging` if complex) |
| "audit", "performance", "SEO" | AUDIT | Start directly → `/audit` |
| "nuovo cliente", "client" | CLIENT | Brief required → `/new-client` |
| "refactor", "rinomina" | REFACTOR | CodeGraph impact analysis first |
| "form" (any form) | **FORM PROTOCOL** | Ask where to send data before implementing |
| "marketing", "conversione" | MARKETING | Brief required → `/marketing` |

---

## Iron Rules (from AGENTS.md)

### 1. Form Protocol
Every time a form is created, **stop and ask**:
```
FORM DETECTED: Dove vuoi inviare i dati?
1. Odoo CRM Lead  2. Payload CMS  3. Email  4. Custom  5. Multiple
```
Then load the appropriate skill (`odoo-crm-lead`, `forms`, `email`, `payload`).

### 2. ESLint Auto-Fix
On any ESLint/TypeScript error during build/lint/test:
1. Run `npm run lint:fix` immediately
2. Fix remaining errors manually
3. Never use `// eslint-disable`, `@ts-ignore`, `as any`
4. Re-run the original command to verify

### 3. CodeGraph Code Intelligence
Before modifying any existing function/class/method:
1. `codegraph_impact({target: "symbolName", direction: "upstream"})` — check blast radius
2. `codegraph_context({name: "symbolName"})` — 360-degree view
3. If risk = HIGH/CRITICAL → warn user before proceeding
4. Before commit: `codegraph_detect_changes()` to verify scope

### 4. Directory Rule
Client projects go in `Progetti/<slug-cliente>/`. Never create project files in the workspace root.

---

## Slash Commands (`.claude/command/`)

| Command | Purpose |
|---------|---------|
| `/new-project "Name"` | Bootstrap new client project in Progetti/ |
| `/new-client` | Full client onboarding workflow |
| `/frontend` | Frontend build workflow |
| `/design` | Design workflow (UI/UX) |
| `/marketing` | Marketing strategy workflow |
| `/audit` | Site audit (perf, a11y, SEO, security) |
| `/clone` | Website cloning pipeline |
| `/video` | Remotion video workflow |
| `/cms-setup` | Payload CMS setup |
| `/cms-module` | Add CMS module (reservations, ecommerce...) |
| `/n8n` | n8n workflow automation |
| `/gdpr-audit` | GDPR compliance audit |
| `/generate-legal` | Generate privacy/cookie/T&C documents |
| `/generate-sitemap` | Sitemap generation |
| `/review` | Code review |
| `/critique` | Design critique |
| `/normalize` | Normalize code patterns |
| `/polish` | Polish UI details |
| `/harden` | Security hardening |
| `/system-sync` | Sync system registry |
| `/check` | Health check |
| `/analyze` | Code analysis |
| `/update-project` | Update project deps/config |

To use: read `.claude/command/{name}.md` and follow its protocol.

---

## Learnings System

Each skill has a `learnings.md` with validated lessons from past sessions. Before working in a domain, check if relevant learnings exist:

```
Read .claude/skill/{domain}/learnings.md
Read .agents/skills/{skill}/learnings.md
```

Learnings have confidence scores (1-10). Trust high-confidence learnings. Question low-confidence ones.

---

## Multi-Agent System (`.claude/agents/`)

19 custom agents in `.claude/agents/`, ognuno con model, effort, tools e prompt dedicato. Claude Code li invoca automaticamente via Agent tool quando il task matcha la description.

### Architettura a 2 livelli

```
@planner (Opus, effort:max)          @builder (Sonnet, effort:high)
    │                                      │
    ├── ux-designer                        ├── project-architect
    ├── ui-designer                        ├── component-builder
    ├── motion-designer                    ├── api-developer
    ├── growth-architect (Opus)            ├── i18n-engineer
    ├── cro-designer                       ├── test-engineer
    └── seo-specialist                     ├── devops-engineer
         saas-copywriter                   ├── payload-cms
                                           ├── n8n-workflow
                                           ├── performance-engineer
                                           └── security-auditor (read-only)
```

### Agent Routing

| Task type | Lead agent | Subagents paralleli |
|-----------|-----------|---------------------|
| Nuovo sito / landing | @planner → @builder | ux + ui + growth in parallelo → component-builder + api-developer |
| Marketing / strategy | @planner | growth-architect + cro-designer + saas-copywriter + seo-specialist |
| Componente UI | @builder | component-builder (+ ui-designer se serve design) |
| Fix / debug | @builder | (diretto, o systematic-debugging skill) |
| Audit completo | @builder | security-auditor + performance-engineer + seo-specialist in parallelo |
| Deploy | @builder | devops-engineer |
| CMS setup | @builder | payload-cms + api-developer |
| Refactor | @builder | (CodeGraph impact analysis prima, poi component-builder) |

### Come funziona il dispatch

```
Richiesta utente: "Costruisci la landing per Ristorante Da Mario"

1. Smart Intake → NUOVO_SITO → brief
2. @planner (Agent tool, model:opus):
   - Dispatcha in parallelo:
     Agent(ux-designer): wireframes + user flow
     Agent(growth-architect): strategy + funnel
     Agent(cro-designer): conversion patterns
   - Sintetizza in brief strutturato
3. @builder (Agent tool, model:sonnet):
   - Dispatcha in parallelo (worktree isolation):
     Agent(component-builder, isolation:worktree): Hero + Nav
     Agent(component-builder, isolation:worktree): Sezioni content
     Agent(component-builder, isolation:worktree): Contact form + Footer
   - Review + merge
4. Agent(seo-specialist): metadata + schema.org
5. Agent(test-engineer): E2E tests
6. Agent(devops-engineer): Docker + deploy
```

### Effort Levels (sostituto temperature)

| Effort | Uso | Equivalente temp |
|--------|-----|-----------------|
| `max` | Planner, growth-architect — ragionamento profondo | ~0.7 |
| `high` | Builder, component-builder, api-developer — esecuzione precisa | ~0.3 |
| `medium` | Test, i18n, devops — task ripetitivi | ~0.2 |
| `low` | Task meccanici | ~0.1 |

### Agent Teams (sperimentale)

Agent Teams e' abilitato via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings.json. Permette:
- Un team lead coordina teammates indipendenti
- Teammates lavorano in parallelo con task list condivisa
- Comunicazione inter-agente

---

## Stack Defaults (Pixarts clients)

- **Framework**: Next.js 15+ (App Router, RSC)
- **Styling**: Tailwind CSS + shadcn/ui
- **CMS**: Payload CMS (multi-tenant)
- **i18n**: next-intl
- **Deploy**: Coolify (Docker multi-stage)
- **Forms**: react-hook-form + Zod + Server Actions
- **SEO**: next/metadata + JSON-LD + sitemap.xml
- **Analytics**: Plausible / PostHog
- **Odoo**: fl1.cz/odoo (CRM leads via API)
