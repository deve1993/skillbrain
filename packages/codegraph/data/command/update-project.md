# /update-project Command

Aggiorna un progetto client esistente: dipendenze, scaffold, automation, check qualità.

## ⛔ REGOLA DIRECTORY (FERREA)

Il progetto esiste già in `Progetti/<slug>/`. NON creare nuovi file nella root.

## Trigger

```
/update-project "Nome Azienda"
/update-project "Nome Azienda" --deps-only
/update-project "Nome Azienda" --check-only
/update-project "Nome Azienda" --no-build
```

## Come funziona

Il comando esegue lo script `.Claude/scripts/update-project.mjs`:

```bash
node .Claude/scripts/update-project.mjs "Nome Cliente"
# oppure con flag:
node .Claude/scripts/update-project.mjs "Nome Cliente" --deps-only
node .Claude/scripts/update-project.mjs "Nome Cliente" --check-only
node .Claude/scripts/update-project.mjs "Nome Cliente" --no-build
```

**Esempi:**
```
/update-project "Ristorante Da Mario"      → aggiorna Progetti/ristorante-da-mario/
/update-project "Studio Legale Rossi" --deps-only  → solo npm update
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                /update-project WORKFLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. VERIFICA                                                 │
│     - Controlla che Progetti/<slug>/ esista                  │
│     - Legge .client-briefs/<slug>/brief.json se disponibile  │
│     ▼                                                        │
│  2. DIPENDENZE                                               │
│     - npm outdated                                           │
│     - npm update (patch/minor, mai major senza conferma)     │
│     - npm audit fix                                          │
│     ▼                                                        │
│  3. AUTOMATION (se mancante o vecchia)                       │
│     - Aggiorna .github/workflows/ci.yml al template corrente │
│     - Aggiorna scripts/check-project.mjs se serve           │
│     - Verifica Husky + lint-staged configurati               │
│     ▼                                                        │
│  4. BUILD VERIFY                                             │
│     - npm run lint:fix                                       │
│     - npm run build                                          │
│     ▼                                                        │
│  5. CHECK                                                    │
│     @project-checker → Audit: i18n, SEO, GDPR, TS, a11y     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Comportamento per Flag

| Flag | Cosa fa |
|------|---------|
| *(nessuno)* | Esegue tutto il workflow completo |
| `--deps-only` | Solo step 2 (dipendenze + audit) |
| `--check-only` | Solo step 5 (project checker) |
| `--no-build` | Salta step 4 (utile in CI veloci) |

## Regole Update Dipendenze

- **Patch e minor** (es. `1.2.3 → 1.2.4`, `1.2.3 → 1.3.0`) → aggiorna silenziosamente
- **Major** (es. `1.x → 2.x`) → mostra la lista, chiede conferma prima di aggiornare
- **Next.js, React, TypeScript** → sempre chiede conferma (breaking changes frequenti)
- `npm audit fix` → applicato sempre; `--force` solo su conferma esplicita

## Output Finale

Report sommario con:
- Dipendenze aggiornate (N pacchetti)
- Vulnerabilità risolte (N)
- Errori lint risolti (N)
- Esito build (✓ / ⚠)
- Esito check qualità (score)

## Skills Caricate Automaticamente

- `pixarts/client-site` — Stack e pattern standard
- `pixarts/template-architecture` — Struttura file corretta
- `eslint` — Auto-fix ESLint

## Note

- Non tocca il CMS o il tenant Payload
- Non fa deploy (usa `/deploy` o Coolify direttamente)
- Salva log dell'aggiornamento in `.client-briefs/<slug>/update-log.md`
