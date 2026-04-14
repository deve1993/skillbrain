---
name: quality-gates
description: Quality gates, automated checks, and enforcement rules for fullstack projects. Scripts for secrets scanning, env validation, pre-deploy checks, dependency audit, conventional commits. Use when setting up a new project, before deploying, or when checking code quality.
version: 1.0.0
---

# Quality Gates — SkillBrain Automation

## Available Scripts

All scripts in `~/.config/skillbrain/hooks/`. Executable directly.

### 1. Secrets Scanner (`secrets-scan.sh`)

Scansiona per token, password, API keys esposti nel codice.

```bash
# Scansiona file staged (pre-commit)
bash ~/.config/skillbrain/hooks/secrets-scan.sh

# Scansiona tutto il progetto
bash ~/.config/skillbrain/hooks/secrets-scan.sh --all
```

**Patterns rilevati:**
- Stripe keys (`sk_live_`, `pk_live_`, `sk_test_`)
- AWS keys (`AKIA...`)
- Telegram bot tokens
- GitHub tokens (`ghp_`, `gho_`)
- Private keys (PEM)
- Connection strings con password
- JWT tokens hardcoded
- Resend keys (`re_...`)
- Sentry DSN con secret
- Slack webhook URLs
- Generic `password=`, `secret=`, `token=` assignments

### 2. Env Validation (`env-check.sh`)

Valida le environment variables di un progetto.

```bash
bash ~/.config/skillbrain/hooks/env-check.sh /path/to/project
```

**Cosa controlla:**
- `.env.local` esiste
- Confronta con `.env.template` (variabili mancanti/vuote)
- Auto-detect dipendenze da `package.json`:
  - Next.js → `NEXT_PUBLIC_APP_URL`
  - Payload → `DATABASE_URL`, `PAYLOAD_SECRET`
  - Stripe → `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - Auth.js → `AUTH_SECRET`
  - Resend → `RESEND_API_KEY`
  - Sentry → `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
  - Supabase → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Upstash → `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### 3. New Project Bootstrap (`new-project.sh`)

Crea `.env.local` per un nuovo progetto con secrets generati e valori copiati dal master.

```bash
bash ~/.config/skillbrain/hooks/new-project.sh /path/to/project "ProjectName"
```

**Cosa fa:**
1. Genera `AUTH_SECRET`, `PAYLOAD_SECRET`, `REVALIDATION_SECRET` con `openssl rand`
2. Crea `.env.local` con tutte le sezioni standard
3. Crea `.env.template` (committabile, senza valori)
4. Aggiorna `.gitignore` se necessario
5. Copia valori condivisi dal master `~/.config/skillbrain/.env` (Stripe, Resend, Sentry, etc.)

### 4. Pre-Deploy Checklist (`pre-deploy.sh`)

Verifica tutto prima di mandare in produzione.

```bash
bash ~/.config/skillbrain/hooks/pre-deploy.sh /path/to/project
```

**Checks:**
- Git: working tree clean, on main branch
- Dependencies: lock file exists, version field
- Build: `pnpm build` passa senza errori
- Lint: `pnpm lint` clean
- Types: `tsc --noEmit` clean
- Tests: `pnpm test` passa
- Env: file esiste, variabili critiche settate
- Security: nessun secret hardcoded, console.log count
- Performance: bundle sizes within budget

**Exit codes:** 0 = all clear, 1 = failures (deploy blocked)

### 5. Dependency Audit (`dep-audit.sh`)

Audit completo delle dipendenze.

```bash
bash ~/.config/skillbrain/hooks/dep-audit.sh /path/to/project
```

**Checks:**
- Vulnerabilita (`pnpm audit`) — critical, high, moderate
- Pacchetti outdated (major version)
- Heavy packages con alternative leggere
- Duplicati

### 6. Conventional Commits (`commit-msg-check.sh`)

Valida il formato del commit message.

```bash
bash ~/.config/skillbrain/hooks/commit-msg-check.sh .git/COMMIT_EDITMSG
```

**Format:** `type(scope): description`

| Type | Uso |
|------|-----|
| `feat` | Nuova feature |
| `fix` | Bug fix |
| `chore` | Manutenzione, deps, config |
| `docs` | Documentazione |
| `style` | Formatting (no code change) |
| `refactor` | Refactor (no feature/fix) |
| `perf` | Performance |
| `test` | Tests |
| `build` | Build system |
| `ci` | CI/CD |
| `revert` | Revert commit |

## Master Env File

Locazione: `~/.config/skillbrain/.env`

Contiene tutte le API keys condivise tra progetti. Organizzato per sezione:
Telegram, n8n, Database, Supabase, Auth, Payload, Stripe, Resend, Sentry, Analytics, AI/LLM, Upstash, Storage (S3/R2), Cloudinary, Pusher, Odoo, Coolify, Iubenda, App.

**Mai committare.** Mai copiare in un repo. Solo in `~/.config/` (fuori da qualsiasi repo git).

## Quando Usare Cosa

```
Nuovo progetto?
└── bash new-project.sh <path> "Name"
    └── bash env-check.sh <path>

Prima di commit?
└── bash secrets-scan.sh

Prima di deploy?
└── bash pre-deploy.sh <path>

Manutenzione settimanale?
└── bash dep-audit.sh <path>
```

## Regole Claude (Automatiche)

Queste regole sono in AGENTS.md e vengono seguite automaticamente:

1. **No hardcoded secrets** — sempre env vars
2. **No `any` / `@ts-ignore`** — type guard o generics
3. **Conventional commits** — `type(scope): desc`
4. **Branch naming** — `feat/`, `fix/`, `chore/`, `refactor/`
5. **Bundle budget** — < 300KB first-load JS per route
6. **No barrel imports** da librerie heavy
7. **Dependency check** prima di `pnpm add` (alternativa leggera?)
8. **Semantic HTML** + ARIA labels
9. **Error handling** — try/catch + log, mai swallow
10. **Health checks** — `/api/health` + `/api/ready` in ogni progetto
