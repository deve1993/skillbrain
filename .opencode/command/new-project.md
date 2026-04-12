# /new-project Command

Bootstrap automatico di un nuovo progetto client Pixarts. Esegue lo script `new-project.mjs` che crea `Progetti/<slug>/` completo in pochi minuti, senza nessuna configurazione manuale.

## ⛔ REGOLA DIRECTORY (FERREA)

Il progetto viene creato in `Progetti/<slug-cliente>/`. Il nome viene convertito in slug kebab-case:
- "Ristorante Da Mario" → `Progetti/ristorante-da-mario/`
- "Studio Legale Rossi" → `Progetti/studio-legale-rossi/`
- "TechStartup SRL" → `Progetti/techstartup-srl/`

**NON creare mai file di progetto nella root di Lavori-Web.**

## Trigger

```
/new-project "Nome Cliente"
```

**Esempi:**
```
/new-project "Ristorante Da Mario"   → Progetti/ristorante-da-mario/
/new-project "Studio Legale Rossi"   → Progetti/studio-legale-rossi/
/new-project "TechStartup SRL"       → Progetti/techstartup-srl/
```

## Come funziona

Il comando esegue:

```bash
node .Claude/scripts/new-project.mjs "Nome Cliente"
```

Lo script automatizza tutto il bootstrap — non serve intervento manuale.

## Cosa viene creato

```
Progetti/<slug>/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   └── not-found.tsx
│   │   ├── api/
│   │   │   ├── health/route.ts
│   │   │   └── revalidate/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── robots.ts
│   │   └── sitemap.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── footer.tsx
│   │   │   └── language-switcher.tsx
│   │   └── shared/
│   │       ├── container.tsx
│   │       └── section.tsx
│   ├── lib/
│   │   ├── utils.ts         ← cn() helper
│   │   └── payload.ts       ← CMS client (getTenant, getPage)
│   ├── i18n/
│   │   ├── config.ts
│   │   ├── request.ts
│   │   └── routing.ts
│   ├── config/
│   │   └── site.ts
│   └── types/
│       └── index.ts
├── messages/
│   ├── it.json
│   ├── en.json
│   └── cs.json
├── middleware.ts
├── next.config.ts           ← standalone + next-intl
├── .env.example
├── .env.local               ← placeholder (MAI committare)
├── Dockerfile               ← multi-stage build
├── .dockerignore
├── .gitignore
├── .husky/pre-commit        ← lint-staged auto-check
├── .github/workflows/ci.yml ← GitHub Actions CI
└── scripts/check-project.mjs ← audit struttura progetto
```

## Stack installato

| Layer | Tecnologia |
|-------|-----------|
| Framework | Next.js 15 + TypeScript + App Router |
| Styling | Tailwind CSS 4 + shadcn/ui |
| i18n | next-intl (IT/EN/CZ) |
| CMS | Payload CMS 3.0 client (`lib/payload.ts`) |
| Form | react-hook-form + Zod |
| Automation | Husky + lint-staged + GitHub Actions |
| Deploy | Dockerfile multi-stage (Coolify-ready) |

**shadcn/ui components installati:** button, card, input, label, form, dialog, sheet, badge, separator, skeleton

## Cosa NON fa (gestisci manualmente)

- ❌ Setup tenant Payload CMS (`cms.pixarts.eu`)
- ❌ Workflow n8n
- ❌ Deploy su Coolify
- ❌ Configurazione DNS / dominio

## ESLint Auto-Fix (automatico)

Lo script esegue `npm run lint:fix` automaticamente dopo il setup. Se ci sono errori ESLint non risolvibili automaticamente, vengono segnalati alla fine — correggili prima del primo commit.

## Verifica build

Lo script esegue `npm run build` come verifica finale. Se fallisce, l'errore è mostrato con il path del file problematico.

## Dopo il bootstrap

1. Configura `.env.local` con i valori reali (TENANT_SLUG, NEXT_PUBLIC_SITE_URL, REVALIDATION_SECRET)
2. Setup tenant su `cms.pixarts.eu` (manuale)
3. Avvia dev server: `cd Progetti/<slug> && npm run dev`
4. Continua con `/frontend` per design + implementazione completa
