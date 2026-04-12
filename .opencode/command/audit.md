# /audit Command

Esegue audit completo su un sito esistente: security, performance, SEO, accessibility.

## Trigger

```
/audit [URL o progetto]
```

**Esempi:**
```
/audit https://example.com
/audit ./src (progetto locale)
/audit performance https://mysite.com
/audit security ./src
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                      /audit WORKFLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PARALLEL AUDIT (tutti in contemporanea)                    │
│       ├── @security-auditor     → Headers, CSP, XSS, CORS  │
│       ├── @performance-engineer → CWV, Bundle, Images       │
│       ├── @seo-specialist       → Meta, Schema, Sitemap     │
│       └── @accessibility-specialist → WCAG 2.1 AA           │
│       ▼                                                      │
│  REPORT                                                      │
│       Audit report consolidato con:                          │
│       - Score per area                                       │
│       - Issues prioritizzati (CRITICAL → LOW)                │
│       - Fix suggeriti con codice                             │
│       - Quick wins evidenziati                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Output: Audit Report

```markdown
# Audit Report: [URL/Progetto]
Data: [data]

## Scores
| Area | Score | Status |
|------|-------|--------|
| Security | X/10 | [PASS/WARN/FAIL] |
| Performance | XX/100 | [PASS/WARN/FAIL] |
| SEO | XX/100 | [PASS/WARN/FAIL] |
| Accessibility | XX/100 | [PASS/WARN/FAIL] |

## Issues (prioritizzati)
[Lista issues per severity]

## Quick Wins
[Top 5 fix ad alto impatto / basso effort]
```
