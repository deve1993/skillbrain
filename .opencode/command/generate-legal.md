# /generate-legal Command

Genera documenti legali per un sito web: Privacy Policy, Cookie Policy, Termini e Condizioni.

## Trigger

```
/generate-legal
/generate-legal --locale=it,en,cs
/generate-legal --type=privacy
/generate-legal --type=cookie
/generate-legal --type=terms
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                 /generate-legal WORKFLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. RACCOLTA INFO                                            │
│       - Nome azienda, P.IVA, indirizzo                       │
│       - Tipo sito (e-commerce, SaaS, info)                   │
│       - Strumenti usati (GA4, Stripe, etc.)                  │
│       - Lingue richieste (IT default, + EN, CS)              │
│       ▼                                                      │
│  2. GENERAZIONE                                              │
│       Skills: legal-templates, gdpr                          │
│       → Privacy Policy (GDPR compliant)                      │
│       → Cookie Policy (con tabella cookie)                   │
│       → Termini e Condizioni                                 │
│       ▼                                                      │
│  3. OUTPUT                                                   │
│       → File .mdx per ogni documento + lingua                │
│       → Pagine Next.js in /privacy, /cookie, /terms          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Skills Caricate

- `legal-templates` — Template documenti legali
- `gdpr` — Compliance GDPR/CCPA

## Output

```
src/app/[locale]/
├── privacy/page.tsx
├── cookie/page.tsx
└── terms/page.tsx

content/legal/
├── privacy.it.mdx
├── privacy.en.mdx
├── cookie.it.mdx
├── cookie.en.mdx
├── terms.it.mdx
└── terms.en.mdx
```
