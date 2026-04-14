# Skill Index

Skill on-demand disponibili in `.Claude/skill/`. Caricale con il tool `skill` quando il task lo richiede.

**Core skills (sempre caricate)**: nextjs, tailwind, shadcn, payload, i18n, seo

---

## ⚡ Skills 2.0 — Upgrade Completato (Marzo 2026)

Aggiornamento completo al nuovo standard Anthropic **Skills 2.0**. Cosa è cambiato:

| Feature | Skills 1.0 | Skills 2.0 |
|---------|-----------|-----------|
| Frontmatter | `name`, `description` | +`version`, `allowed-tools`, `context`, `hooks`, `user-invocable`, `argument-hint` |
| Slash commands | Solo `.Claude/commands/` | Unificati: `user-invocable: true` |
| Context injection | Statico | `context: "bash scripts/..."` inietta dati live |
| Testing | Nessuno | `evals/trigger_evals.json` + `evals/evals.json` |
| Scripts | Nessuno | `scripts/` per automazione e context injection |

### 🔰 Slash Commands Disponibili (Skills 2.0)

Queste skill sono ora invocabili direttamente con `/nome`:

| Slash Command | Skill | Argument Hint |
|--------------|-------|---------------|
| `/brainstorming` | `brainstorming` | "descrivi cosa vuoi creare o progettare" |
| `/frontend-design` | `frontend-design` | "nome componente e tipo di interfaccia" |
| `/writing-plans` | `writing-plans` | "descrivi il task da pianificare" |
| `/systematic-debugging` | `systematic-debugging` | "descrivi il bug o comportamento inatteso" |
| `/verification-before-completion` | `verification-before-completion` | "cosa verificare prima di dichiarare done" |
| `/skill-creator` | `skill-creator` | "descrivi il workflow da insegnare" |
| `/skill-eval` | `skill-eval` | "nome della skill da testare" |
| `/project-health-check` | `project-health-check` | "path progetto da verificare" |

### 🛠️ Utility Scripts (`.Claude/scripts/`)

| Script | Uso |
|--------|-----|
| `audit_skills.py` | Analizza compliance 2.0 di tutte le skill → `python3 .Claude/scripts/audit_skills.py` |
| `run_evals.sh` | Valida tutti gli evals JSON → `bash .Claude/scripts/run_evals.sh` |
| `load_project_context.sh` | Context injection live (versioni, git, stack) |

### 📊 Stato Upgrade per Tier

| Tier | Skill | Status |
|------|-------|--------|
| **Core** (8 skill) | brainstorming, frontend-design, verification-before-completion, systematic-debugging, writing-plans, executing-plans, subagent-driven-development, dispatching-parallel-agents | ✅ Completamente aggiornate |
| **Infra** | nextjs, payload, pixarts/client-site, pixarts/workflow | ✅ Context injection aggiunta |
| **Template** | skill-template-2.0 | ✅ Creato — usare come base per nuove skill |
| **Nuove** | skill-creator, skill-eval, project-health-check | ✅ Create 2.0-native |
| **Domain** (~60) | tutte le altre | 🔄 Upgrade leggero (version + trigger phrases) |

---

## 🆕 Nuove Skill 2.0-Native

| Skill | Contenuto |
|-------|-----------|
| `skill-template-2.0` | Template completo per creare nuove skill 2.0: frontmatter reference, struttura directory, esempi evals |
| `skill-creator` | Guida interattiva per creare nuove skill 2.0: use case definition → frontmatter → evals |
| `skill-eval` | Analizza e verifica evals di una skill: trigger accuracy, quality test cases, report |
| `project-health-check` | Health check completo progetto Next.js/Payload: build, lint, i18n, SEO, env vars, sicurezza |

---

## Skill On-Demand

| Skill | Linee | Contenuto |
|-------|-------|-----------|
| `analytics` | 558 | Plausible, PostHog, Umami, Vercel Analytics, cookie consent |
| `animations` | 163 | Framer Motion, CSS animations, scroll effects, reduced motion |
| `astro` | 232 | Astro 5+, Content Collections, Islands, SSG/SSR |
| `auth` | 650 | Auth.js v5, OAuth, Credentials, JWT, RBAC, permissions |
| `agent-browser` | 318 | CLI browser automation (Vercel Labs), scraping, sessioni |
| `cms` | 564 | Sanity, Strapi, Contentful — headless CMS integration |
| `coolify` | 127 | Docker multi-stage, CI/CD, SSL, health checks |
| `database` | 477 | Prisma, Drizzle, migrations, seeding, connection pooling |
| `email` | 554 | Resend, React Email, templates transazionali |
| `ffmpeg` | 120 | Transcodifica, filtri, thumbnail generation, ottimizzazione video server-side |
| `fonts` | 271 | next/font, download, self-hosting, licenze, struttura |
| `forms` | 793 | react-hook-form, Zod, Server Actions, file upload |
| `media` | 561 | Uploadthing, Cloudinary, Vercel Blob, image optimization |
| `nuxt` | 190 | Nuxt 3, Vue 3, Composition API, Nitro server |
| `payments` | 487 | Stripe, LemonSqueezy, subscriptions, webhooks |
| `remotion` | 929 | Video programmatici con React, Remotion v4, rendering |
| `scraping` | 204 | Playwright scraping, reverse engineering, clonazione siti |
| `state` | 682 | Zustand, TanStack Query, React Context, optimistic updates |
| `sveltekit` | 187 | SvelteKit, Svelte 5 Runes, load functions |
| `testing` | 174 | Vitest, Playwright E2E, Testing Library, a11y testing |
| `n8n` | 280 | n8n workflow automation, nodi, connessioni, MCP server, API REST, pattern |
| `odoo-crm-lead` | ~280 | Integrazione Odoo CRM Lead via API, protocollo form, webhook, template Next.js |
| `odoo-api-query` | ~250 | Query Odoo 18 via REST/JSON API con bearer token, discovery-first approach, introspection modelli/campi |
| `project-automation` | ~120 | 4-layer automation: Husky, GitHub Actions, n8n monitoring, check script |
| `website-cloning` | ~350 | Pipeline v2.0 clonazione siti: Firecrawl + Design Copier + Playwright, per-section tokens, interactive states, dark mode, screenshot diff |

### MCP Tools (skill per agenti con accesso diretto via MCP)

| Skill | Linee | Contenuto |
|-------|-------|-----------|
| `figma` | ~200 | Figma MCP: leggi design, estrai tokens, mappa Tailwind/shadcn, workflow design-to-code |
| `stitch` | ~150 | Google Stitch MCP: genera UI da prompt, estrai tokens, converti HTML/CSS → Tailwind/shadcn |
| `mongodb` | ~180 | MongoDB MCP: query Payload CMS collections, debug dati tenant, aggregazioni, best practices |
| `docker` | ~200 | Docker MCP: gestione container Coolify, log inspection, debug deploy, monitor risorse |

### Pixarts (workflow client)

| Skill | Linee | Contenuto |
|-------|-------|-----------|
| `pixarts/workflow` | 222 | Workflow completo creazione siti client |
| `pixarts/multitenancy` | 483 | Pattern multi-tenant Payload CMS |
| `pixarts/client-site` | 595 | Stack frontend standard client Pixarts |
| `pixarts/design-system` | ~200 | Design tokens, componenti standard, layout system, dark mode |
| `pixarts/template-architecture` | ~180 | Struttura cartelle Next.js, root layout, block renderer, config files |
| `pixarts/cms-modules` | ~250 | Pattern moduli CMS: reservations, ecommerce, events, portfolio, ecc. |

### Compliance & Legal

| Skill | Linee | Contenuto |
|-------|-------|-----------|
| `gdpr` | ~200 | Checklist GDPR, cookie audit, form consent, diritti utente |
| `legal-templates` | ~200 | Template Privacy Policy, Cookie Policy, T&C (IT/EN/CZ) |
| `iubenda` | ~180 | Integrazione Iubenda, cookie banner, Google Consent Mode v2 |

### SEO & Sitemap

| Skill | Linee | Contenuto |
|-------|-------|-----------|
| `sitemap` | ~180 | Sitemap Next.js, XSL styling, hreflang, sitemap index |

### SEO Avanzato (claude-seo, installato globalmente in `~/.claude/skills/`)

Sistema completo di audit e analisi SEO con comando `/seo`. Usa per **diagnostica e analisi**, le skill locali (`seo-for-devs`) per **implementazione Next.js**.

| Skill (globale) | Contenuto |
|-----------------|-----------|
| `seo` | Orchestrator: 12 sub-skills, 6 subagents, score 0-100, industry detection |
| `seo-audit` | Full site audit con subagent paralleli |
| `seo-page` | Deep single-page analysis |
| `seo-technical` | Technical SEO (8 categorie: crawlability, indexability, security, CWV...) |
| `seo-content` | E-E-A-T content quality assessment (Sept 2025 QRG) |
| `seo-schema` | Schema markup detection, validazione, generazione (con deprecation tracking) |
| `seo-images` | Image optimization analysis |
| `seo-sitemap` | Sitemap analysis e generazione |
| `seo-geo` | GEO: AI Overviews, ChatGPT/Perplexity citation, llms.txt compliance |
| `seo-plan` | Strategic planning per SaaS, local, ecommerce, publisher, agency |
| `seo-programmatic` | Programmatic SEO con quality gates (warning 100+, hard stop 500+) |
| `seo-competitor-pages` | Competitor comparison pages ("X vs Y", "alternatives to X") |
| `seo-hreflang` | Hreflang/i18n audit e generazione (ISO 639-1 + ISO 3166-1) |
| `seo-sitemap-advanced` | Sitemap index avanzato, XSL styling, hreflang entries, multi-sitemap per Next.js |

### Marketing Core (landing page, conversione, copy)

| Skill | Linee | Contenuto |
|-------|-------|-----------|
| `landing-architecture` | 364 | Struttura LP, hero patterns, sezioni, template shadcn |
| `copywriting` | ~300 | Copy B2B tech, PAS/AIDA/FAB, vocabolario, headline, CTA — merge best-of-both |
| `cro-patterns` | 526+ | CRO strategico + UI patterns: form, pricing, CTA, social proof, exit intent |
| `analytics-tracking` | ~350 | Event taxonomy, tracking plan, GA4/PostHog/Plausible — merge best-of-both |
| `email-sequence` | ~350 | Nurture sequences, cold email, automation, deliverability — merge best-of-both |
| `ab-testing` | ~300 | Experiment design, hypothesis framework, sample size, statistical analysis |
| `seo-for-devs` | — | SEO tecnico per sviluppatori, Next.js specifico |
| `mobile-first` | — | Thumb zone, touch targets, mobile CWV |
| `motion-system` | — | Layer system animazioni (CSS → Framer → Canvas) |

### Marketing Avanzato (GitHub: coreyhaines31/marketingskills)

Skill strategy-focused importate da `coreyhaines31/marketingskills`. Si complementano con le skill dev-focused locali.

**Foundation (caricare sempre con task marketing):**

| Skill | Contenuto |
|-------|-----------|
| `product-marketing-context` | ⭐ Foundation skill — contesto prodotto/audience/competitor, da leggere PRIMA di ogni altra skill marketing |

**Copy & Messaggi:**

| Skill | Contenuto |
|-------|-----------|
| `copy-editing` | Editing copy per chiarezza, persuasione, brevità |
| `social-content` | Contenuti LinkedIn, Twitter/X, thread, post virali |
| `cold-email` | Outreach B2B, personalizzazione, sequenze cold email |
| `ad-creative` | Copy e struttura per paid ads (Meta, Google, LinkedIn) |

**CRO Specializzato:**

| Skill | Contenuto |
|-------|-----------|
| `signup-flow-cro` | Ottimizzazione flusso registrazione, riduzione attrito |
| `form-cro` | Form conversion: campi, copy, progressive disclosure |
| `popup-cro` | Exit intent, popup strategici, timing e targeting |
| `onboarding-cro` | User onboarding, activation, time-to-value |
| `paywall-upgrade-cro` | Upgrade prompts, paywall design, upsell patterns |

**Growth & Strategy:**

| Skill | Contenuto |
|-------|-----------|
| `launch-strategy` | Piano di lancio prodotto/feature, sequenza e canali |
| `pricing-strategy` | Modelli di pricing, anchor, packaging, fremium vs trial |
| `marketing-ideas` | Generazione idee marketing creative e non convenzionali |
| `marketing-psychology` | Principi psicologici: scarcity, social proof, reciprocità |
| `free-tool-strategy` | Free tool/calculator come canale acquisizione SEO+lead |
| `referral-program` | Programmi referral: meccaniche, incentivi, implementazione |
| `churn-prevention` | Riduzione churn: early signals, win-back, retention |

**Sales & Revenue:**

| Skill | Contenuto |
|-------|-----------|
| `sales-enablement` | Sales deck, battle cards, objection handling, collateral |
| `revops` | Revenue operations, funnel alignment, pipeline metrics |
| `paid-ads` | Strategia paid advertising: budget, bidding, ottimizzazione |

**SEO & Content:**

| Skill | Contenuto |
|-------|-----------|
| `content-strategy` | Pillar/cluster, topic research, prioritizzazione contenuti |
| `site-architecture` | Gerarchia pagine, navigazione, URL structure, internal linking |
| `competitor-alternatives` | Pagine "vs", "alternative a", comparison page SEO |
| `programmatic-seo` | SEO programmatico: template, dati, scale con quality gates |
| `ai-seo` | Ottimizzazione per AI search (ChatGPT, Perplexity, Gemini) |
| `seo-audit` | Audit SEO marketing-focused (diverso dal global claude-seo) |
| `schema-markup` | Structured data: FAQ, Review, Organization, breadcrumb |

## Skill da skills.sh (installate via npx skills)

Skill installate da [skills.sh](https://skills.sh/) in `.agents/skills/` con symlink a `.opencode/skill/`. Aggiornabili con `npx skills update`.

### UI & Frontend (Vercel Labs + community)

| Skill | Fonte | Contenuto |
|-------|-------|-----------|
| `frontend-design` | anthropics (verified) | ⭐ Skill ufficiale Anthropic: design thinking avant-coding, evita "AI slop", typography distintiva, motion, composizione spaziale, atmosfera. 277k installs |
| `ui-ux-pro-max` | nextlevelbuilder | ⭐ Database-driven: 50+ stili, 97 palette, 57 font pairing, 99 UX guidelines, CLI Python per design system per-progetto, 9 stack (shadcn, nextjs, tailwind...) |
| `next-best-practices` | vercel-labs | Next.js 15+ ufficiale: RSC boundaries, async params/cookies, hydration errors, self-hosting Docker, parallel routes, metadata OG |
| `vercel-react-best-practices` | vercel-labs | React best practices: componenti, performance, patterns Vercel |
| `web-design-guidelines` | vercel-labs | Linee guida web design: accessibilità, layout, tipografia, responsive |
| `audit-website` | squirrelscan | Audit automatico sito: performance, accessibilità, SEO, sicurezza |

### Agent Superpowers (obra/superpowers)

Meta-skill per migliorare comportamento agenti. 14 skill da `obra/superpowers` (267k installs totali).

| Skill | Contenuto |
|-------|-----------|
| `brainstorming` | **Usa prima di qualsiasi lavoro creativo** — esplora user intent, requisiti e design prima di implementare |
| `systematic-debugging` | Debugging metodico step-by-step: isola, riproduce, radice del problema |
| `writing-plans` | Strutturare piani di lavoro chiari e verificabili |
| `executing-plans` | Eseguire piani in modo disciplinato, un passo alla volta |
| `test-driven-development` | TDD workflow: test prima, poi implementazione |
| `subagent-driven-development` | Sviluppo coordinato da sub-agenti: delega, verifica, integra |
| `dispatching-parallel-agents` | Pattern esecuzione parallela agenti per task indipendenti |
| `verification-before-completion` | Quality gate pre-consegna: checklist prima di dichiarare done |
| `requesting-code-review` | Come preparare e richiedere code review efficace |
| `receiving-code-review` | Come ricevere e integrare feedback da code review |
| `using-git-worktrees` | Git worktrees per lavorare su branch multiple in parallelo |
| `finishing-a-development-branch` | Checklist per completare un branch: lint, test, PR description |
| `using-superpowers` | Guida all'uso di tutte le superpowers insieme |
| `writing-skills` | Principi di scrittura tecnica chiara ed efficace |

## Quando Caricare

| Task | Skill da caricare |
|------|-------------------|
| Sistema di login/registrazione | `auth` |
| Form complessi con validazione | `forms` |
| Gestione stato client/server | `state` |
| Upload file/immagini | `media` |
| Email transazionali | `email` |
| Pagamenti/subscriptions | `payments` |
| Video con Remotion | `remotion` |
| Database/ORM setup | `database` |
| Deploy Coolify/Docker | `coolify` |
| Scraping/reverse engineering | `scraping`, `agent-browser` |
| Progetto Astro | `astro` |
| Progetto SvelteKit | `sveltekit` |
| Progetto Nuxt | `nuxt` |
| Analytics setup | `analytics` |
| Animazioni avanzate | `animations`, `motion-system` |
| Font management | `fonts` |
| CMS headless (non Payload) | `cms` |
| Nuovo sito client Pixarts | `pixarts/workflow`, `pixarts/multitenancy`, `pixarts/client-site` |
| Design system / visual patterns | `pixarts/design-system` |
| Scaffold nuovo progetto | `pixarts/template-architecture` |
| Aggiungere moduli CMS | `pixarts/cms-modules` |
| Test suite completa | `testing` |
| Automazione workflow n8n | `n8n` |
| Elaborazione video server-side (FFmpeg) | `ffmpeg` |
| Landing page/marketing | `landing-architecture`, `copywriting`, `cro-patterns` |
| Copy B2B / messaggi persuasivi | `copywriting`, `product-marketing-context` |
| Strategia di lancio / go-to-market | `launch-strategy`, `product-marketing-context` |
| Pricing e packaging | `pricing-strategy` |
| Content strategy / blog planning | `content-strategy` |
| Architettura sito / navigazione | `site-architecture` |
| Pagine vs/alternative competitor | `competitor-alternatives` |
| A/B testing | `ab-testing`, `analytics-tracking` |
| Email marketing / sequenze | `email-sequence` |
| Mobile optimization | `mobile-first` |
| GDPR audit / compliance | `gdpr`, `iubenda` |
| Documenti legali (privacy, cookie, T&C) | `legal-templates` |
| Sitemap / SEO tecnico | `sitemap` |
| SEO audit completo sito | `/seo audit <url>` (comando globale claude-seo) |
| Analisi E-E-A-T contenuti | `/seo content <url>` (comando globale claude-seo) |
| Ottimizzazione AI search (GEO) | `/seo geo <url>` (comando globale claude-seo) |
| Schema markup validazione | `/seo schema <url>` (comando globale claude-seo) |
| Piano strategico SEO | `/seo plan <type>` (comando globale claude-seo) |
| Setup automazione progetto | `project-automation` |
| Clonazione siti web / reverse engineering UI | `website-cloning`, `scraping` |
| Form con invio a Odoo CRM | `odoo-crm-lead`, `forms` |
| Implementazione da design Figma (URL fornito) | `figma`, `frontend-ui-ux` |
| Generare UI da prompt testuale (senza Figma) | `stitch`, `frontend-ui-ux` |
| Debug database Payload CMS / query MongoDB | `mongodb`, `payload` |
| Debug container / deploy issues Coolify | `docker`, `coolify` |
| Design frontend distintivo, anti "AI slop" | `frontend-design` |
| UI/UX design system per progetto (colori, font, stile) | `ui-ux-pro-max` |
| Next.js 15+ best practices / debug RSC | `next-best-practices` |
| React patterns e performance avanzata | `vercel-react-best-practices` |
| Linee guida web design generali | `web-design-guidelines` |
| Audit sito (performance, a11y, SEO) | `audit-website` |
| Prima di lavoro creativo (componenti, features, design) | `brainstorming` |
| Debugging complesso dopo 2+ tentativi falliti | `systematic-debugging` |
| Pianificare task multi-step | `writing-plans`, `executing-plans` |
| Implementazione con TDD | `test-driven-development` |
| Coordinare più sub-agenti su task complesso | `subagent-driven-development`, `dispatching-parallel-agents` |
| Verifica qualità prima di dichiarare done | `verification-before-completion` |
| Code review (richiedere/ricevere) | `requesting-code-review`, `receiving-code-review` |
| Completare un branch / prepare PR | `finishing-a-development-branch`, `using-git-worktrees` |
| Creare una nuova skill 2.0 | `skill-creator`, `writing-skills` |
| Testare / verificare una skill | `skill-eval` |
| Audit salute progetto pre-deploy | `project-health-check` |
| Template per nuova skill | `skill-template-2.0` |

---

## 🆕 Nuove Skill Custom (Aprile 2026)

Skill create per colmare i gap fullstack. Specifiche per lo stack Next.js/Payload/Tailwind.

### Backend & API

| Skill | Linee | Contenuto |
|-------|-------|-----------|
| `trpc` | 366 | tRPC v11 con Next.js App Router — routers, procedures, middleware, subscriptions SSE, React Query, server caller per RSC |
| `realtime` | 425 | Real-time: SSE con ReadableStream, Socket.io custom server, Pusher/Ably, Supabase Realtime, chat, presence, notifications live |
| `background-jobs` | 832 | BullMQ, Inngest, Trigger.dev v3, Upstash QStash — code splitting, retry, DLQ, cron, event-driven, decision matrix |

### Infrastructure & DevOps

| Skill | Linee | Contenuto |
|-------|-------|-----------|
| `ci-cd` | 344 | GitHub Actions pipeline completa (lint→test→build→deploy), preview deploys, Docker build+push, Changesets release, Turborepo monorepo CI |
| `monitoring-nextjs` | 437 | Sentry (client/server/edge), Pino structured logging, OpenTelemetry tracing, health checks, error handling architecture, Slack alerting |
| `security-headers` | 834 | CSP con nonce, CORS, rate limiting (Upstash), CSRF, input sanitization, secrets management, OWASP Top 10 checklist per Next.js |

### Performance & UX

| Skill | Linee | Contenuto |
|-------|-------|-----------|
| `performance` | 416 | Bundle analyzer, Core Web Vitals (LCP/CLS/INP), SSR streaming, caching strategy, memory leaks, Lighthouse CI con GitHub Actions |
| `pwa` | 381 | @serwist/next, manifest, caching strategies, offline fallback, push notifications (VAPID/web-push), install prompt, iOS workaround |
| `file-handling` | 436 | S3/R2/Vercel Blob, presigned URLs, React PDF invoice, HTML-to-PDF, CSV/Excel import-export, streaming download, magic bytes validation |

### Skill Installate da skills.sh (Aprile 2026)

Skill esterne installate con `npx skills add`. Disponibili in `.agents/skills/`.

| Pacchetto | Skill principali installate |
|-----------|----------------------------|
| `wshobson/agents` (149) | `api-designer`, `graphql-architect`, `postgres-pro`, `database-optimizer`, `typescript-pro`, `secure-code-guardian`, `security-reviewer`, `monitoring-expert`, `sre-engineer`, `microservices-architect`, `rag-architect`, `kubernetes-specialist`, `websocket-engineer`, `react-expert`, `nextjs-developer`, `sql-pro`, `error-handling-patterns`, `golang-pro`, `rust-engineer`, `python-pro` |
| `redis/agent-skills` | `redis-development` — Redis data structures, RQE, vector search, semantic caching, performance |
| `vercel/ai` | `ai-sdk` — Vercel AI SDK, generateText, streamText, tool calling, useChat, providers |
| `expo/skills` (12) | `building-native-ui`, `native-data-fetching`, `expo-tailwind-setup`, `expo-cicd-workflows`, `expo-api-routes`, `expo-deployment`, `expo-dev-client`, `expo-module`, `use-dom`, `expo-ui-swiftui`, `expo-ui-jetpack-compose` |
| `callstackincubator/agent-skills` | `react-native-best-practices`, `upgrading-react-native`, `react-native-brownfield-migration`, `github-actions` |
| `jeffallan/claude-skills` | `devops-engineer`, `terraform-engineer`, `websocket-engineer`, `typescript-pro`, `test-master`, `fullstack-guardian`, `cloud-architect`, `chaos-engineer`, `kubernetes-specialist` |

### Routing Aggiornato (Nuove Skill)

| Task | Skill da caricare |
|------|-------------------|
| tRPC type-safe API | `trpc`, `typescript-pro` |
| WebSocket / real-time / chat | `realtime`, `websocket-engineer` |
| SSE / live notifications | `realtime` |
| Background jobs / code asincroni | `background-jobs` |
| GitHub Actions / CI pipeline | `ci-cd`, `devops-engineer` |
| Error tracking / logging / Sentry | `monitoring-nextjs`, `monitoring-expert` |
| Security headers / CSP / CORS | `security-headers`, `secure-code-guardian` |
| Rate limiting | `security-headers` |
| Performance / bundle size / CWV | `performance` |
| Lighthouse CI | `performance`, `ci-cd` |
| PWA / offline / service worker | `pwa` |
| Push notifications | `pwa` |
| File upload S3/R2 | `file-handling` |
| PDF generation | `file-handling` |
| CSV/Excel import-export | `file-handling` |
| GraphQL schema / API | `graphql-architect` |
| PostgreSQL optimization | `postgres-pro`, `database-optimizer` |
| Redis caching / sessions | `redis-development` |
| AI features / chatbot / RAG | `ai-sdk`, `rag-architect` |
| React Native / Expo | `react-native-best-practices`, `building-native-ui`, `expo-*` |
| Kubernetes / infra | `kubernetes-specialist`, `devops-engineer` |
| Terraform / IaC | `terraform-engineer` |
| TypeScript advanced patterns | `typescript-pro` |
| Microservices architecture | `microservices-architect` |
| SRE / SLOs / incident response | `sre-engineer` |

---

## 🧠 SkillBrain — Lifecycle Obbligatorio

> Skill in `.agents/skills/`. **Non opzionali** — sono il sistema nervoso della sessione.

### Protocollo sessione

| Momento | Skill | Azione |
|---------|-------|--------|
| **Inizio sessione** ("lavora su X", "fix in X") | `codegraph-context` | Carica grafo codebase + 15 learnings rilevanti |
| **Durante il lavoro** (errore risolto, pattern trovato, correzione utente) | `capture-learning` | Scrive learning validato in `learnings.md` |
| **Fine sessione** ("ho finito", "basta", "fine") | `post-session-review` | Audit + decay + n8n notify + re-index |

### Routing SkillBrain

| Situazione | Skill |
|-----------|-------|
| Inizio qualsiasi sessione su un progetto | `.agents/skills/codegraph-context` |
| Hai risolto un bug non ovvio (2+ tentativi) | `.agents/skills/capture-learning` |
| L'utente ti ha corretto un approccio | `.agents/skills/capture-learning` |
| Hai trovato un pattern/quirk di libreria | `.agents/skills/capture-learning` |
| Stai per terminare la sessione | `.agents/skills/post-session-review` |
| Vuoi vedere i learnings attuali | `.agents/skills/load-learnings` |
| Vuoi la mappa delle skill | `.agents/skills/SKILLS-MAP.md` |
