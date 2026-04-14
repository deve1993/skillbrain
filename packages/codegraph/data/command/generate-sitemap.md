# /generate-sitemap Command

Genera sitemap XML human-readable con XSL stylesheet per SEO tecnico ottimale.

## Trigger

```
/generate-sitemap
/generate-sitemap [progetto-path]
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│               /generate-sitemap WORKFLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. ANALISI PROGETTO                                         │
│       - Scansione routes (app/[locale]/**)                   │
│       - Rileva pagine dinamiche (blog, servizi, etc.)        │
│       - Identifica locales (it, en, cs)                      │
│       ▼                                                      │
│  2. GENERAZIONE                                              │
│       Skills: sitemap, seo                                   │
│       → src/app/sitemap.ts (Next.js MetadataRoute)           │
│       → public/sitemap.xsl (human-readable stylesheet)       │
│       → src/app/robots.ts                                    │
│       ▼                                                      │
│  3. VERIFICA                                                 │
│       → Valida hreflang tags                                 │
│       → Controlla priority e changeFrequency                 │
│       → Test render XML                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Skills Caricate

- `sitemap` — Pattern sitemap Next.js
- `seo` — SEO e hreflang best practices

## Output

- `src/app/sitemap.ts` — Sitemap con ISR
- `src/app/robots.ts` — robots.txt configurato
- `public/sitemap.xsl` — Stylesheet human-readable
