# /check Command

Esegue audit completo di un progetto o del sistema OpenCode per trovare parti mancanti, problemi e miglioramenti.

## Trigger

```
/check                          # Auto-detect: progetto corrente
/check system                   # Solo sistema OpenCode (agenti, skills, config)
/check project                  # Solo progetto client nella directory corrente
/check project ./path/to/site   # Progetto client specifico
/check all                      # Entrambi
```

## Workflow

```
┌──────────────────────────────────────────────────────────────┐
│                      /check WORKFLOW                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. DETECT TARGET                                            │
│     ├── Ha package.json + next.config? → Progetto client     │
│     ├── Ha opencode.json + .Claude/?   → Sistema OpenCode    │
│     └── Entrambi?                      → Check entrambi      │
│                                                               │
│  2. DELEGATE to @project-checker                             │
│     task(                                                     │
│       subagent_type="project-checker",                       │
│       load_skills=["payload", "pixarts/client-site"],        │
│       prompt="Check [target] at [path]. Run ALL checks..."   │
│     )                                                         │
│                                                               │
│  3. REPORT (lista sintetica)                                 │
│     🔴 Critici: X | 🟡 Warning: X | 🟢 OK: X               │
│     + Lista issues per categoria                             │
│                                                               │
│  4. AUTO-FIX (con conferma)                                  │
│     Per ogni fix disponibile:                                │
│     → Mostra cosa verrà fatto                                │
│     → Chiedi conferma Y/N                                    │
│     → Applica e verifica                                     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Categorie di Check

### Sistema OpenCode
| Area | Cosa controlla |
|------|---------------|
| Config coerenza | opencode.json ↔ file agenti ↔ AGENTS.md |
| Skills | Esistenza file, referenze corrette |
| Comandi | File comandi presenti per ogni /comando |
| Agent prompts | Qualità e completezza dei prompt |

### Progetto Client
| Area | Cosa controlla |
|------|---------------|
| 📁 Struttura | File standard Next.js presenti |
| 🌍 i18n | Chiavi traduzione complete IT/EN/CZ |
| 🔍 SEO | Meta, sitemap, robots, schema.org, hreflang |
| 🔒 GDPR | Cookie banner, privacy, consenso form |
| 🔷 TypeScript | Strict mode, no any, no ts-ignore |
| ♿ Accessibilità | Alt text, headings, labels, contrast |
| ⚡ Performance | Images, fonts, bundle, lazy loading |
| 📦 Dipendenze | Vulnerabilità, outdated, lock file |
| 🗺️ Sitemap | Completezza, hreflang, priority, XSL |
| 🔗 CMS | Env vars, tenant, revalidation |

## Output

```markdown
## 🔍 Project Check Report — [nome progetto]
Data: [data]

### Sommario
🔴 Critici: 3 | 🟡 Warning: 7 | 🟢 OK: 15

### 🔴 Critici
- [GDPR] Cookie banner mancante → Auto-fix: installa Iubenda component
- [SEO] sitemap.ts non trovato → Auto-fix: genera sitemap standard
- [TypeScript] 12 errori di tipo → Correggi manualmente

### 🟡 Warning
- [i18n] 5 chiavi mancanti in en.json → Auto-fix: aggiungi placeholder
- [a11y] 3 immagini senza alt → Auto-fix: aggiungi alt=""
...

### 🟢 OK
- [Struttura] Tutti i file layout presenti ✓
- [CMS] Integrazione Payload configurata ✓
...

### 🔧 Auto-fix disponibili (3)
1. Genera sitemap.ts standard — Confermi?
2. Aggiungi 5 chiavi i18n mancanti con placeholder — Confermi?
3. Aggiungi alt="" a 3 immagini — Confermi?
```

## Integrazione nei Workflow

Il check viene eseguito automaticamente come step finale in:
- `/frontend` → dopo il build
- `/new-client` → prima del deploy (step QA)

Può essere disabilitato con flag `--no-check`.
