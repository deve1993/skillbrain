# Pixarts Workflow — Guida di Riferimento

Panoramica completa di comandi, agenti e skill disponibili nel sistema.

---

## Comandi

I comandi attivano workflow pre-configurati. Si usano con `/nome-comando`.

### Sviluppo & Progetti

| Comando | Cosa fa | Quando usarlo |
|---------|---------|---------------|
| `/new-project "Nome"` | Bootstrap automatico: Next.js + i18n + shadcn + Dockerfile + GitHub repo + n8n monitoring (18 step automatici) | Nuovo progetto da zero, senza design |
| `/new-client "Nome"` | Workflow completo nuovo cliente: intake → CMS → scaffold → build → deploy → QA | Nuovo sito client con tutto il processo |
| `/update-project "Nome"` | Aggiorna progetto esistente: dipendenze, CI/CD, build, check qualità | Manutenzione progetto già live |
| `/frontend` | Workflow design → dev → deploy coordinato da tutti gli agenti | Nuovo sito/app con processo completo |
| `/design` | Solo fase design (UX + UI + Motion), senza codice | Quando serve solo il concept visivo |
| `/review` | Code review approfondita su file, cartelle o changeset | Dopo un'implementazione |
| `/check [target]` | Audit progetto o sistema: struttura, i18n, SEO, GDPR, TS, a11y, performance | Verifica completezza pre-lancio |

### CMS & Contenuti

| Comando | Cosa fa | Quando usarlo |
|---------|---------|---------------|
| `/cms-setup` | Configura integrazione Payload CMS per un progetto esistente | Connettere frontend a cms.pixarts.eu |
| `/cms-module <modulo> <tenant>` | Aggiunge modulo funzionale al CMS (reservations, ecommerce, events…) | Estendere funzionalità di un tenant |

**Moduli CMS disponibili:** `reservations` `ecommerce` `events` `portfolio` `faq` `newsletter` `reviews` `jobs` `memberships` `affiliates`

### Marketing & Conversione

| Comando | Cosa fa | Quando usarlo |
|---------|---------|---------------|
| `/marketing` | Strategy + copy + CRO + SEO + tracking per landing page | Landing page ottimizzata per conversione |
| `/analyze` | Analisi competitor, trend, tecnologie via ricerca web | Ricerca di mercato pre-progetto |
| `/clone <url>` | Clona un sito esistente in Next.js (pixel-perfect via Firecrawl + Playwright) | Reverse engineering / ispirazioni |

### SEO & Compliance

| Comando | Cosa fa | Quando usarlo |
|---------|---------|---------------|
| `/generate-sitemap` | Genera sitemap XML human-readable con XSL stylesheet | SEO tecnico, prima del lancio |
| `/audit` | Audit completo: security, performance, SEO, accessibility | Verifica sito esistente |
| `/gdpr-audit` | Audit compliance GDPR: tracking, cookie consent, form, privacy | Pre-lancio compliance |
| `/generate-legal` | Genera Privacy Policy, Cookie Policy, T&C (IT/EN/CZ) | Documenti legali per qualsiasi sito |

### Automazione & Video

| Comando | Cosa fa | Quando usarlo |
|---------|---------|---------------|
| `/n8n <descrizione>` | Crea e gestisce workflow n8n: automazioni, webhook, integrazioni | Automatizzare processi |
| `/video` | Video programmatici con Remotion: intro, social clip, OG video | Contenuti video dinamici |

---

## Agenti

Gli agenti sono specialisti invocabili direttamente. Due modalità:
- **Modalità semplice**: `@planner` per pianificare, `@builder` per costruire
- **Modalità avanzata**: invoca direttamente l'agente specializzato che ti serve

### Super-Agenti (Modalità Semplice)

| Agente | Cosa fa | Usa quando |
|--------|---------|------------|
| `@planner` | Analizza, pianifica, definisce strategia. Coordina internamente: @ux-designer, @growth-architect, @cro-designer, @tech-seo-specialist | "Crea un piano per…", "Analizza…", "Strategia per…" |
| `@builder` | Costruisce, scrive codice, fixa bug, deploya. Coordina: @project-architect, @component-builder, @api-developer, @i18n-engineer, @devops-engineer | "Implementa…", "Costruisci…", "Correggi…" |

### Team Design

| Agente | `subagent_type` | Cosa fa |
|--------|-----------------|---------|
| `@ux-designer` | `ux-designer` | User flows, wireframes, architettura informativa |
| `@ui-designer` | `ui-designer` | Visual design, palette colori, tipografia, componenti |
| `@motion-designer` | `motion-designer` | Animazioni, transizioni, micro-interactions |
| `@video-creator` | `video-creator` | Video Remotion (intro, social, OG video) |

### Team Dev

| Agente | `subagent_type` | Cosa fa |
|--------|-----------------|---------|
| `@project-architect` | `project-architect` | Setup progetto, scaffold, architettura |
| `@component-builder` | `component-builder` | Componenti UI, shadcn/ui, Tailwind |
| `@api-developer` | `api-developer` | Backend, API Routes, validazione, CMS integration |
| `@i18n-engineer` | `i18n-engineer` | Traduzioni IT/EN/CZ, localizzazione |
| `@test-engineer` | `test-engineer` | Unit test, E2E, visual regression, a11y test |
| `@code-reviewer` | `code-reviewer` | Code review approfondita |
| `@documentation-writer` | `documentation-writer` | README, guide, documentazione tecnica |
| `@web-analyst` | `web-analyst` | Scraping, reverse engineering, competitor, pipeline `/clone` |

### Team CMS (Workflow /new-client)

| Agente | `subagent_type` | Ruolo nel workflow |
|--------|-----------------|-------------------|
| `@client-intake` | `client-intake` | Questionario interattivo → `brief.json` + `brief.md` |
| `@tenant-setup` | `tenant-setup` | Setup CMS multi-tenant → `tenant-config.json` |
| `@site-scaffolder` | `site-scaffolder` | Init Next.js → repository GitHub |
| `@site-builder` | `site-builder` | Sviluppo frontend completo |
| `@site-deployer` | `site-deployer` | Deploy Coolify → sito live + SSL |
| `@site-qa` | `site-qa` | Quality assurance pre-lancio |
| `@payload-cms` | `payload-cms` | Collections, access control, hooks, multi-tenancy |

### Team Ops

| Agente | `subagent_type` | Cosa fa |
|--------|-----------------|---------|
| `@seo-specialist` | `seo-specialist` | Meta tags, schema.org, sitemap, keyword |
| `@performance-engineer` | `performance-engineer` | Bundle size, Core Web Vitals, lazy loading |
| `@security-auditor` | `security-auditor` | Headers, CSP, vulnerabilità, audit |
| `@devops-engineer` | `devops-engineer` | Docker, Coolify, CI/CD, monitoring |
| `@accessibility-specialist` | `accessibility-specialist` | WCAG 2.1, ARIA, screen reader |
| `@project-checker` | `project-checker` | Audit: struttura, i18n, SEO, GDPR, TS, a11y, perf |

### Team Marketing

| Agente | `category` | Cosa fa |
|--------|-----------|---------|
| `@growth-architect` | `deep` | Strategy, funnel design, brief marketing |
| `@saas-copywriter` | `writing` | Copy persuasivo B2B, headline, CTA, email |
| `@cro-designer` | `visual-engineering` | Layout CRO, A/B test design |
| `@tech-seo-specialist` | `deep` | SEO tecnico, GEO (AI search), structured data |
| `@analytics-specialist` | `deep` | Tracking plan, GA4, eventi conversione |
| `@mobile-specialist` | `visual-engineering` | Mobile UX, touch targets, CWV mobile |

### Team Odoo

| Agente | `subagent_type` | Cosa fa |
|--------|-----------------|---------|
| `@odoo-model-builder` | `odoo-model-builder` | Modelli Python, campi, relazioni, security |
| `@odoo-view-creator` | `odoo-view-creator` | Viste form/tree/kanban, xpath inheritance |
| `@odoo-api-builder` | `odoo-api-builder` | HTTP controllers, REST API, webhook |
| `@odoo-database-analyst` | `odoo-database-analyst` | Analisi modelli, query PostgreSQL, debug |
| `@portal-developer` | `portal-developer` | Pagine portal customer-facing in Odoo |
| `@odoo18-migration` | `odoo18-migration` | Migrazione moduli v14/15/16/17 → Odoo 18 |
| `@odoo-translation-specialist` | `odoo-translation-specialist` | File .po, localizzazione moduli |
| `@odoo-user-guide-writer` | `odoo-user-guide-writer` | Documentazione utente IT/EN |
| `@odoo-store-documenter` | `odoo-store-documenter` | Docs per Odoo Apps Store |
| `@project-analysis-html-generator` | `project-analysis-html-generator` | Stime progetto, preventivi HTML |

### Automazione

| Agente | `subagent_type` | Cosa fa |
|--------|-----------------|---------|
| `@n8n-workflow` | `n8n-workflow` | Workflow automation, webhook, integrazioni n8n |

---

## File Generati Automaticamente

### `/new-project` genera in `Progetti/<slug>/`

```
src/
├── app/[locale]/          # App Router con next-intl
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Header, Footer, Navigation
│   └── shared/            # Componenti riusabili
├── lib/
│   ├── payload.ts         # Client CMS
│   ├── fonts.ts           # Inter + Geist Mono
│   └── utils.ts           # cn() e helpers
├── i18n/                  # Config + messaggi IT/EN/CZ
└── types/                 # TypeScript types

.env.local                 # Variabili ambiente
.env.example               # Template variabili
Dockerfile                 # Multi-stage build
docker-compose.yml         # Per test locale
.github/workflows/ci.yml   # CI: lint + typecheck + build + test + security + lighthouse
scripts/check-project.mjs  # Audit qualità locale
```

### `/new-client` genera in più luoghi

```
.client-briefs/<slug>/
├── brief.json             # Dati strutturati per gli agenti
└── brief.md               # Versione human-readable

Progetti/<slug>/           # Tutto il sito (vedi /new-project)

.qa-reports/<date>-<slug>/
├── qa-report.md
├── lighthouse.json
└── screenshots/
```

---

## Stack Tecnologico di Default

| Layer | Tecnologia |
|-------|-----------|
| Framework | Next.js 15+ (App Router, RSC) |
| Language | TypeScript 5+ strict mode |
| Styling | Tailwind CSS 4 + shadcn/ui |
| i18n | next-intl (IT/EN/CZ) |
| CMS | Payload CMS 3.0 (cms.pixarts.eu) |
| Database | MongoDB (gestito dal CMS) |
| Deploy | Coolify (Docker multi-stage) |
| CI/CD | GitHub Actions |
| Monitoring | n8n (schedule ogni 6h) |

---

## Riferimenti Rapidi

| Cosa | Dove |
|------|------|
| Admin CMS | https://cms.pixarts.eu/admin |
| API CMS | https://cms.pixarts.eu/api |
| Skills disponibili | `.Claude/skill/INDEX.md` |
| Guida modalità semplice | `.Claude/guides/SIMPLE_MODE.md` |
| Script bootstrap | `.Claude/scripts/new-project.mjs` |
| Template CI/CD | `.Claude/templates/project-automation/.github/workflows/ci.yml` |
| Brief clienti | `.client-briefs/<slug>/` |
| Progetti | `Progetti/<slug>/` |
