# SkillBrain — Project Instructions

> Project-specific configuration. SkillBrain protocol (sessions, memories, skills, credentials) is in the Global CLAUDE.md.
> Smart Intake, Form/ESLint/CodeGraph protocols, and delegation map are in AGENTS.md.

---

## Architecture

```
.claude/                     → project config + skills + agents
  skill/                     → 120 domain skills (mirror — load via skill_read, not from disk)
  command/                   → 23 slash commands
  agent/                     → 12 agent prompts (old format)
  agents/                    → 23 agents (new format with frontmatter)
  scripts/                   → automation scripts
  guides/                    → reference docs
  SYSTEM.md                  → system registry, versions, MCP status

.agents/skills/              → 112 lifecycle/process/quality skills (mirror)

AGENTS.md                    → Smart Intake + Iron Rules + Delegation Map
Progetti/                    → client project directories
packages/codegraph/          → SkillBrain MCP server (core)
```

---

## Multi-Agent System

### 2-Level Architecture

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

| Task type | Lead agent | Parallel subagents |
|-----------|-----------|---------------------|
| New site / landing | @planner → @builder | ux + ui + growth → component-builder + api-developer |
| Marketing / strategy | @planner | growth-architect + cro-designer + saas-copywriter + seo-specialist |
| UI component | @builder | component-builder (+ ui-designer if needed) |
| Fix / debug | @builder | (direct, or systematic-debugging skill) |
| Full audit | @builder | security-auditor + performance-engineer + seo-specialist in parallel |
| Deploy | @builder | devops-engineer |
| CMS setup | @builder | payload-cms + api-developer |
| Refactor | @builder | CodeGraph impact analysis first, then component-builder |

### Effort Levels

| Effort | Use | Equiv temp |
|--------|-----|-----------|
| `max` | Planner, growth-architect — deep reasoning | ~0.7 |
| `high` | Builder, component-builder — precise execution | ~0.3 |
| `medium` | Test, i18n, devops — repetitive tasks | ~0.2 |
| `low` | Mechanical tasks | ~0.1 |

---

## Stack Defaults (Pixarts clients)

| Component | Technology |
|-----------|-----------|
| **Framework** | Next.js 15+ (App Router, RSC) |
| **Styling** | Tailwind CSS + shadcn/ui |
| **CMS** | Payload CMS (multi-tenant, `cms.pixarts.eu`) |
| **i18n** | next-intl |
| **Deploy** | Coolify (Docker multi-stage) |
| **Forms** | react-hook-form + Zod + Server Actions |
| **SEO** | next/metadata + JSON-LD + sitemap.xml |
| **Analytics** | Plausible / PostHog |
| **Odoo** | fl1.cz/odoo (CRM leads via API) |

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/new-project "Name"` | Bootstrap new client project |
| `/new-client` | Full client onboarding workflow |
| `/frontend` | Frontend build workflow |
| `/design` | Design workflow (UI/UX) |
| `/marketing` | Marketing strategy workflow |
| `/audit` | Site audit (perf, a11y, SEO, security) |
| `/clone` | Website cloning pipeline |
| `/video` | Video production (AI gen + Remotion) |
| `/cms-setup` | Payload CMS setup |
| `/cms-module` | Add CMS module |
| `/n8n` | n8n workflow automation |
| `/gdpr-audit` | GDPR compliance audit |
| `/generate-legal` | Generate privacy/cookie/T&C |
| `/generate-sitemap` | Sitemap generation |
| `/review` | Code review |
| `/check` | Health check |
| `/system-sync` | Sync system registry |

To use: read `.claude/command/{name}.md` and follow its protocol.

---

## Deployment

| | |
|---|---|
| **Platform** | Coolify (self-hosted) |
| **Container** | Docker multi-stage |
| **CI/CD** | GitHub Actions |
| **SSL** | Let's Encrypt (auto) |
| **CMS** | `cms.pixarts.eu` (separate) |

---

## Quality Standards

### Engineering

| Metric | Target |
|--------|--------|
| Lighthouse Performance | > 90 |
| Lighthouse Accessibility | > 95 |
| Lighthouse SEO | > 95 |
| TypeScript | Strict mode |
| Test Coverage | > 80% |

### Marketing (B2B Tech Benchmarks)

| Metric | Target |
|--------|--------|
| Landing Page CR | 2.5% - 5% |
| Form Completion Rate | 40% - 60% |
| Bounce Rate | < 50% |
| Time on Page | > 2 min |

---

## Environment Variables

Master env: SkillBrain `user_env_get` — contains all shared API keys.

Per project:
- `bash ~/.config/skillbrain/hooks/new-project.sh <path>` → generates `.env.local`
- `bash ~/.config/skillbrain/hooks/env-check.sh <path>` → validates required env vars

Key vars: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CMS_URL`, `TENANT_SLUG`, `REVALIDATION_SECRET`.

---

**Version**: 3.0.0
**Last update**: May 2026
