# /cms-setup Command

Configura l'integrazione Payload CMS per un progetto frontend esistente.

## Trigger

```
/cms-setup
/cms-setup [tenant-slug]
```

**Esempi:**
```
/cms-setup
/cms-setup ristorante-mario
/cms-setup techstartup
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    /cms-setup WORKFLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. CHECK                                                    │
│       Verifica progetto Next.js esistente                    │
│       Verifica .env con CMS_URL e TENANT_SLUG                │
│       ▼                                                      │
│  2. CMS CLIENT                                               │
│       @api-developer                                         │
│       → lib/payload.ts (singleton client)                    │
│       → Fetch functions (getPages, getPosts, etc.)           │
│       → Revalidation API route                               │
│       ▼                                                      │
│  3. TYPES                                                    │
│       → Genera/importa payload-types.ts                      │
│       → Type-safe fetch functions                            │
│       ▼                                                      │
│  4. CONTENT RENDERING                                        │
│       @component-builder                                     │
│       → Block renderer per layout CMS                        │
│       → Rich text renderer (Lexical)                         │
│       → Image component con CMS media                        │
│       ▼                                                      │
│  5. VERIFY                                                   │
│       → Fetch test con tenant filter                         │
│       → Revalidation test                                    │
│       → Build senza errori                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Output

- `lib/payload.ts` — CMS client singleton
- `lib/cms-fetch.ts` — Typed fetch functions
- `app/api/revalidate/route.ts` — On-demand ISR
- `components/cms/` — Block renderer, rich text, media
- `types/payload-types.ts` — Generated types
