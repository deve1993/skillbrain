# /cms-module Command

Aggiunge un modulo funzionale al CMS Payload per un tenant specifico.

## Trigger

```
/cms-module <modulo> <tenant>
```

**Esempi:**
```
/cms-module reservations ristorante-da-mario
/cms-module ecommerce techstartup
/cms-module events studio-rossi
/cms-module newsletter agenzia-xyz
```

## Moduli Disponibili

| Modulo | Descrizione | Collections aggiunte |
|--------|-------------|---------------------|
| `reservations` | Sistema prenotazioni | bookings, services, time-slots |
| `ecommerce` | Shop online | products, orders, cart, coupons |
| `events` | Gestione eventi | events, registrations, venues |
| `portfolio` | Portfolio lavori | projects, categories, clients |
| `faq` | FAQ interattive | faqs, categories |
| `newsletter` | Newsletter | subscribers, campaigns |
| `reviews` | Recensioni | reviews, review-requests |
| `jobs` | Offerte lavoro | jobs, applications |
| `memberships` | Abbonamenti | memberships, members |
| `affiliates` | Programma affiliati | affiliates, referrals, commissions |

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                  /cms-module WORKFLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. VERIFICA TENANT                                          │
│       → Controlla che il tenant esista su cms.pixarts.eu     │
│       ▼                                                      │
│  2. CONFIGURAZIONE CMS                                       │
│       @payload-cms                                           │
│       → Aggiunge collections al tenant                       │
│       → Configura access control                             │
│       → Aggiunge hooks necessari                             │
│       ▼                                                      │
│  3. FRONTEND INTEGRATION                                     │
│       @component-builder                                     │
│       → Componenti UI per il modulo                          │
│       → API routes per il modulo                             │
│       → i18n strings                                         │
│       ▼                                                      │
│  4. VERIFICA                                                 │
│       → Test CRUD operazioni                                 │
│       → Test accesso tenant                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Skills Caricate

- `pixarts/cms-modules` — Dettagli implementazione moduli
- `pixarts/multitenancy` — Pattern multi-tenant
- `payload` — Payload CMS 3.0
