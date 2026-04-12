# CMS Team - Pixarts Client Workflow

Sistema multi-agente per l'implementazione automatizzata di siti web client con Payload CMS multi-tenant.

## Quick Start

```bash
/new-client "Nome Cliente"
```

## Agenti

| # | Agente | Ruolo | Output |
|---|--------|-------|--------|
| 15 | `@client-intake` | Questionario interattivo | `brief.json` |
| 16 | `@tenant-setup` | Setup CMS multi-tenant | `tenant-config.json` |
| 17 | `@site-scaffolder` | Init Next.js project | Repository GitHub |
| 18 | `@site-builder` | Sviluppo frontend | Sito completo |
| 19 | `@site-deployer` | Deploy Coolify | Sito live + SSL |
| 20 | `@site-qa` | Quality Assurance | QA Report |

## Workflow

```
/new-client → @client-intake → @tenant-setup → @site-scaffolder → @site-builder → @site-deployer → @site-qa
```

## CMS Reference

- **Admin**: https://cms.pixarts.eu/admin
- **API**: https://cms.pixarts.eu/api
- **Database**: MongoDB Atlas

## Skills Correlate

- `pixarts/workflow` - Workflow completo
- `pixarts/multitenancy` - Pattern multi-tenant
- `pixarts/client-site` - Stack frontend

## Stack Tecnologico

- Next.js 15+ (App Router)
- TypeScript 5+
- Tailwind CSS 4
- shadcn/ui
- Framer Motion
- next-intl (i18n)
- Payload CMS 3.0
- Coolify (deploy)

## File Generati

```
.client-briefs/
└── [slug]/
    ├── brief.json
    ├── tenant-config.json
    └── .env.local

.qa-reports/
└── [date]-[slug]/
    ├── qa-report.md
    ├── lighthouse.json
    └── screenshots/
```
