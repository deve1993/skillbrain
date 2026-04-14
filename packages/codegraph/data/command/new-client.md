# /new-client Command

Workflow completo per creazione sito web di un nuovo cliente: intake → CMS → scaffold → build → deploy → QA.

## ⛔ REGOLA DIRECTORY (FERREA)

Il progetto viene creato in `Progetti/<slug-cliente>/`. Il nome viene convertito in slug kebab-case:
- "Ristorante Da Mario" → `Progetti/ristorante-da-mario/`
- "Studio Legale Rossi" → `Progetti/studio-legale-rossi/`
- "TechStartup SRL" → `Progetti/techstartup-srl/`

**TUTTI gli agenti in questo workflow ricevono il `workdir` = `Progetti/<slug>/`**

## Trigger

```
/new-client "Nome Azienda"
```

**Esempi:**
```
/new-client "Ristorante Da Mario"     → Progetti/ristorante-da-mario/
/new-client "Studio Legale Rossi"      → Progetti/studio-legale-rossi/
/new-client "TechStartup SRL"         → Progetti/techstartup-srl/
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                   /new-client WORKFLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. INTAKE                                                   │
│       @client-intake          → Client Brief                 │
│       (Raccolta requisiti interattiva)                       │
│       ▼                                                      │
│  2. CMS SETUP                                                │
│       @tenant-setup           → Tenant + User + .env         │
│       @payload-cms            → Collections config           │
│       ▼                                                      │
│  3. SCAFFOLD                                                 │
│       @site-scaffolder        → Progetto Next.js base        │
│       ▼                                                      │
│  4. DESIGN + BUILD                                           │
│       @ui-designer            → Visual design                │
│       @site-builder           → Implementazione completa     │
│       @i18n-engineer          → Traduzioni IT/EN/CZ          │
│       ▼                                                      │
│  5. DEPLOY                                                   │
│       @site-deployer          → Docker → Coolify → Live      │
│       ▼                                                      │
│  6. QA                                                       │
│       @site-qa                → Test completo pre-lancio     │
│       ▼                                                      │
│  7. CHECK (automatico, skip con --no-check)                  │
│       @project-checker        → Audit completo:              │
│       struttura, i18n, SEO, GDPR, TS, a11y, perf, sitemap   │
│       → Auto-fix con conferma per problemi semplici          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisiti

- Accesso a `cms.pixarts.eu` (admin)
- Dominio del cliente configurato
- Brief del cliente (o raccolto via @client-intake)

## Skills Caricate Automaticamente

- `pixarts/workflow` — Workflow standard client
- `pixarts/multitenancy` — Pattern multi-tenant
- `pixarts/client-site` — Stack frontend client
