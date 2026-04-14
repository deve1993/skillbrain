---
name: project-automation
description: 4-layer project automation system - Husky pre-commit, GitHub Actions CI/CD, n8n monitoring, check scripts. Use when setting up project automation, configuring pre-commit hooks, establishing CI/CD pipelines, or adding quality checks.
version: 1.0.0
---

# Project Automation Skill

Sistema di automazione a 4 layer per quality assurance su progetti client Pixarts.

## I 4 Layer

```
Layer 1: PRE-COMMIT    → Ogni commit     → Husky + lint-staged
Layer 2: CI/CD         → Ogni push/PR    → GitHub Actions
Layer 3: MONITORING    → Ogni 6 ore      → n8n workflows
Layer 4: ON-DEMAND     → Quando serve    → @project-checker (AI)
```

## Layer 1: Pre-commit (Husky + lint-staged)

**Cosa blocca**: errori TypeScript, lint violations, codice non formattato.
**Quando gira**: prima di ogni `git commit`.

### Setup

```bash
npm install -D husky lint-staged
npx husky init
```

Crea `.husky/pre-commit`:
```bash
npx lint-staged
```

Crea `lint-staged.config.mjs`:
```javascript
export default {
  '*.{ts,tsx}': [
    'eslint --fix',
    () => 'tsc --noEmit',
  ],
  '*.{ts,tsx,js,jsx,json,css,md}': [
    'prettier --write',
  ],
};
```

Aggiungi a `package.json`:
```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

---

## Layer 2: CI/CD (GitHub Actions)

**Cosa controlla**: build, lint, type check, security audit, Lighthouse.
**Quando gira**: ad ogni push su main/develop e ad ogni PR.

### File: `.github/workflows/ci.yml`

Template in `.Claude/templates/project-automation/.github/workflows/ci.yml`

**Jobs:**
1. `quality` — TypeScript check, lint, project checker script, build
2. `security` — npm audit per vulnerabilità critiche
3. `lighthouse` — Solo su PR, misura performance/a11y/SEO con budget

### Lighthouse Budget

Template in `.Claude/templates/project-automation/lighthouse-budget.json`

Target:
- LCP < 2.5s
- FCP < 2s
- TTI < 5s
- JS bundle < 300KB
- Total < 1.5MB

---

## Layer 3: Monitoring (n8n)

**Cosa controlla**: uptime, SSL, response time, sitemap, robots.txt.
**Quando gira**: ogni 6 ore automaticamente.

### Workflow n8n

Template in `.Claude/templates/project-automation/n8n-monitoring-template.json`

**Checks:**
1. Health endpoint (`/api/health`) → sito up?
2. SSL → certificato valido?
3. Response time homepage → < 3 secondi?
4. Sitemap.xml → esiste e risponde 200?
5. Robots.txt → esiste?

**Alert**: email (o Slack) se qualsiasi check fallisce.

### Setup

```
/n8n crea workflow monitoring per sito [NOME_CLIENTE] su [URL]
```

Oppure importa il template JSON in n8n manualmente.

---

## Layer 4: On-demand (@project-checker AI)

**Cosa controlla**: tutto quello che gli script non coprono — qualità copy, UX review, suggerimenti architetturali, auto-fix intelligente.
**Quando gira**: su richiesta con `/check`.

### Uso

```
/check                  → auto-detect progetto
/check project          → solo progetto client
/check system           → solo configurazione OpenCode
```

L'agente:
1. Esegue prima `npm run check` (script automatico)
2. Analizza i risultati
3. Aggiunge check qualitativi che solo l'AI può fare
4. Propone auto-fix con conferma

---

## Template Completo

Tutti i file template si trovano in:
```
.Claude/templates/project-automation/
├── scripts/
│   └── check-project.mjs      → Script Node.js (9 categorie di check)
├── .github/
│   └── workflows/
│       └── ci.yml              → GitHub Actions CI
├── lighthouse-budget.json      → Budget Lighthouse
├── lint-staged.config.mjs      → Config lint-staged
├── husky-setup.sh              → Script setup Husky
├── package-scripts.json        → Scripts da aggiungere a package.json
└── n8n-monitoring-template.json → Template workflow n8n
```

## Setup per Nuovo Progetto

L'agente `@site-scaffolder` include automaticamente l'automazione:

```
1. Copia scripts/check-project.mjs → <progetto>/scripts/
2. Copia .github/workflows/ci.yml → <progetto>/.github/workflows/
3. Copia lighthouse-budget.json → <progetto>/
4. Copia lint-staged.config.mjs → <progetto>/
5. Esegui husky-setup.sh
6. Aggiungi scripts da package-scripts.json al package.json
7. Dopo il deploy: crea workflow n8n di monitoring
```

## npm Scripts Disponibili

| Script | Cosa fa |
|--------|---------|
| `npm run check` | Esegue tutti i check localmente |
| `npm run check:fix` | Check + auto-fix problemi semplici |
| `npm run check:ci` | Check in CI mode (exit 1 se critici) |
| `npm run typecheck` | Solo TypeScript check |
| `npm run lint` | Solo ESLint |
| `npm run lint:fix` | ESLint + auto-fix |
| `npm run format` | Prettier su tutto il progetto |
| `npm run format:check` | Verifica formatting senza modificare |
| `npm run audit` | npm security audit |
