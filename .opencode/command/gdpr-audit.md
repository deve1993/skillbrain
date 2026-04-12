# /gdpr-audit Command

Audit compliance GDPR: tracking, cookie consent, form, privacy policy.

## Trigger

```
/gdpr-audit
/gdpr-audit [URL o path-progetto]
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                   /gdpr-audit WORKFLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PARALLEL AUDIT (tutti in contemporanea)                    │
│       ├── Cookie & Tracking                                  │
│       │   → GA4, Plausible, Meta Pixel, etc.                 │
│       │   → Caricamento condizionale al consenso            │
│       ├── Form & Dati                                        │
│       │   → Checkbox consenso presente                       │
│       │   → Data retention policy                            │
│       ├── Documenti Legali                                   │
│       │   → Privacy Policy presente e linkato                │
│       │   → Cookie Policy aggiornata                         │
│       └── Banner Cookie                                      │
│           → Presente e configurato correttamente             │
│           → Granularità consenso (per categoria)             │
│       ▼                                                      │
│  REPORT GDPR                                                 │
│       → Score compliance (0-100)                             │
│       → Issues critici (violazioni dirette)                  │
│       → Issues medi (raccomandazioni)                        │
│       → Auto-fix dove possibile                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Skills Caricate

- `gdpr` — Requisiti GDPR/CCPA
- `iubenda` — Integrazione Iubenda
- `analytics` — Setup analytics condizionale

## Output

```markdown
# GDPR Audit Report — [progetto]
Score: XX/100

## 🔴 Violazioni
- [item]

## 🟡 Raccomandazioni
- [item]

## 🟢 Compliant
- [item]

## Fix Disponibili
- [auto-fix list]
```
