---
name: pixarts/workflow
description: Pixarts complete workflow - intake, CMS setup, scaffold, build, deploy, QA. Use when implementing full client site projects, managing multi-phase delivery, or coordinating CMS and frontend setup.
version: 1.0.0
context: "bash .Claude/scripts/load_project_context.sh"
---

# Pixarts Workflow Skill

Workflow completo per l'implementazione di siti web client con Payload CMS multi-tenant.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PIXARTS CLIENT WORKFLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FASE 0: INTAKE              @client-intake                                  │
│  ─────────────────           Questionario interattivo                        │
│  Output: brief.json          (1 domanda alla volta)                          │
│                                                                              │
│           ▼                                                                  │
│                                                                              │
│  FASE 1: CMS SETUP           @tenant-setup                                   │
│  ─────────────────           - Crea tenant in cms.pixarts.eu                 │
│  Output: tenant-config.json  - Crea utente admin                             │
│                              - Configura collections                         │
│                              - Setup header/footer                           │
│                                                                              │
│           ▼                                                                  │
│                                                                              │
│  FASE 2: SCAFFOLD            @site-scaffolder                                │
│  ─────────────────           - Crea repo GitHub                              │
│  Output: progetto Next.js    - Init Next.js 15 + TypeScript                  │
│                              - Setup shadcn/ui + Tailwind                    │
│                              - Configura i18n                                │
│                              - CMS client pronto                             │
│                                                                              │
│           ▼                                                                  │
│                                                                              │
│  FASE 3: BUILD               @site-builder                                   │
│  ─────────────────           - Sviluppa componenti                           │
│  Output: sito completo       - Crea pagine dal brief                         │
│                              - Implementa form/features                      │
│                              - Animazioni Framer Motion                      │
│                              - i18n translations                             │
│                                                                              │
│           ▼                                                                  │
│                                                                              │
│  FASE 4: DEPLOY              @site-deployer                                  │
│  ─────────────────           - Configura Coolify                             │
│  Output: sito live           - Setup dominio + SSL                           │
│                              - CI/CD GitHub Actions                          │
│                              - Webhook revalidation                          │
│                                                                              │
│           ▼                                                                  │
│                                                                              │
│  FASE 5: QA                  @site-qa                                        │
│  ─────────────────           - Test performance (Lighthouse)                 │
│  Output: QA report           - Test accessibilita                            │
│                              - Test SEO                                      │
│                              - Test cross-browser                            │
│                              - Test funzionale                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Agenti Coinvolti

| Agente | File | Ruolo |
|--------|------|-------|
| `@client-intake` | `15-client-intake.md` | Raccolta requisiti interattiva |
| `@tenant-setup` | `16-tenant-setup.md` | Configurazione CMS |
| `@site-scaffolder` | `17-site-scaffolder.md` | Init progetto frontend |
| `@site-builder` | `18-site-builder.md` | Sviluppo completo |
| `@site-deployer` | `19-site-deployer.md` | Deploy Coolify |
| `@site-qa` | `20-site-qa.md` | Quality Assurance |

## File di Output per Fase

### FASE 0: Intake
```
.client-briefs/
└── [slug]/
    ├── brief.json        # Requisiti strutturati
    └── notes.md          # Note aggiuntive
```

### FASE 1: CMS Setup
```
.client-briefs/
└── [slug]/
    ├── brief.json
    ├── tenant-config.json  # Config tenant CMS
    └── .env.local          # Variabili ambiente
```

### FASE 2: Scaffold
```
[slug]-site/              # Repository GitHub
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── hooks/
│   ├── types/
│   └── i18n/
├── Dockerfile
├── package.json
└── ...
```

### FASE 3: Build
```
[slug]-site/
├── src/
│   ├── app/[locale]/
│   │   ├── page.tsx       # Homepage
│   │   └── (routes)/      # Altre pagine
│   ├── components/
│   │   ├── layout/        # Header, Footer
│   │   ├── sections/      # Hero, Services, etc.
│   │   └── shared/        # Container, Section
│   └── i18n/messages/     # Traduzioni
└── ...
```

### FASE 4: Deploy
```
.client-briefs/
└── [slug]/
    └── deploy-config.json  # Config Coolify
```

### FASE 5: QA
```
.qa-reports/
└── [date]-[slug]/
    ├── qa-report.md       # Report completo
    ├── lighthouse.json    # Metriche performance
    ├── a11y.json          # Report accessibilita
    └── screenshots/       # Screenshot test
```

## Stack Tecnologico

| Layer | Tecnologia |
|-------|------------|
| Framework | Next.js 15+ (App Router) |
| Language | TypeScript 5+ |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui + Radix |
| Animation | Framer Motion |
| i18n | next-intl |
| Forms | react-hook-form + Zod |
| CMS | Payload CMS 3.0 |
| Database | MongoDB Atlas |
| Deploy | Coolify (Docker) |

## Comandi Disponibili

| Comando | Descrizione |
|---------|-------------|
| `/new-client [nome]` | Avvia workflow completo |
| `/cms-setup` | Solo configurazione CMS |

## Regole Critiche

1. **MAI saltare fasi** - Ogni fase produce output per la successiva
2. **Questionario interattivo** - 1 domanda alla volta, attendi risposta
3. **Brief-driven** - Ogni decisione deriva dal brief approvato
4. **Filtro tenant SEMPRE** - Su ogni query API al CMS
5. **i18n fin dall'inizio** - Tutte le stringhe traducibili
6. **Mobile-first** - Design responsive partendo da mobile
7. **Performance** - Target Lighthouse > 90

## Esempio Flusso Completo

```markdown
# Utente
/new-client Ristorante Da Mario

# Sistema
@client-intake inizia questionario:
"Come si chiama l'azienda?" → "Ristorante Da Mario"
"Che tipo di attivita?" → "Ristorante italiano"
...
(18 domande interattive)
...
Brief completato!

# Sistema
@tenant-setup:
- Tenant "ristorante-da-mario" creato
- Admin user creato
- Collections: pages, services, testimonials, faq
- Lingue: IT, EN

# Sistema
@site-scaffolder:
- Repo github.com/deve1993/ristorante-da-mario-site creato
- Next.js 15 inizializzato
- shadcn/ui configurato
- CMS client pronto

# Sistema
@site-builder:
- Homepage con Hero, Menu, Testimonials, CTA
- Pagina Menu con grid servizi
- Pagina Contatti con form
- i18n IT/EN

# Sistema
@site-deployer:
- Deploy su Coolify
- Dominio: ristorantedamario.it
- SSL: Let's Encrypt
- CI/CD: GitHub Actions

# Sistema
@site-qa:
- Lighthouse: 96/100
- Accessibilita: 98/100
- SEO: 100/100
- Test funzionali: PASS

READY FOR LAUNCH!
```
