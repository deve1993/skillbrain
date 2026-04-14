---
name: project-health-check
description: >
  Comprehensive health check of a Next.js/Payload CMS project.
  Use when user asks to "check the project", "audit the codebase",
  "what's the state of the project", "project health", or before a major release.
  Checks TypeScript errors, build status, missing env vars, i18n completeness,
  SEO basics, and Payload CMS configuration.
version: 1.0.0
user-invocable: true
argument-hint: "path del progetto da verificare (default: current directory)"
allowed-tools: ["bash", "read", "glob", "grep"]
context: "bash .Claude/scripts/load_project_context.sh"
---

# Project Health Check

Analisi completa della salute di un progetto Next.js + Payload CMS.

## Overview

Verifica 8 aree critiche e produce un report con score e raccomandazioni.

**Core principle:** Evidence-based assessment — solo dati reali, nessuna assunzione.

## Checks

### 1. TypeScript & Build
```bash
npm run build 2>&1 | tail -20
npm run typecheck 2>&1 | head -30
```
Check: zero errori TS, build passa

### 2. Lint
```bash
npm run lint 2>&1 | head -20
```
Check: zero errori lint

### 3. Environment Variables
Leggi `.env.example` o `AGENTS.md` per lista env vars attese.
Verifica che `.env.local` (o env del deployment) le contenga tutte.

### 4. i18n Completeness
```bash
ls messages/
```
Verifica che tutti i file locale (it.json, en.json, cs.json) esistano e abbiano le stesse chiavi.

### 5. SEO Basics
```bash
grep -r "generateMetadata\|metadata" src/app --include="*.tsx" -l
```
Check: ogni page.tsx ha metadata, robots.ts e sitemap.ts esistono.

### 6. Payload CMS
```bash
grep -r "collections" src/payload.config.ts 2>/dev/null | head -5
```
Check: config Payload presente, collections definite.

### 7. Performance
```bash
ls public/
```
Check: no immagini >500KB in public/, next/image usato dove serve.

### 8. Security
```bash
grep -r "console.log\|debugger" src --include="*.ts" --include="*.tsx" -l 2>/dev/null | head -5
```
Check: no console.log in produzione, secret keys non hardcoded.

## Report Format

```
PROJECT HEALTH REPORT
=====================
Project: [nome]
Date: [data]

SCORES:
✅ TypeScript/Build   [PASS/FAIL]
✅ Lint               [PASS/FAIL]  
⚠️  Environment Vars  [X/Y vars present]
✅ i18n               [IT/EN/CS present]
⚠️  SEO               [X/Y pages with metadata]
✅ Payload CMS        [PASS/FAIL]
✅ Performance        [PASS/FAIL]
✅ Security           [PASS/FAIL]

OVERALL: [score]/100

CRITICAL ISSUES:
- [lista problemi critici]

RECOMMENDATIONS:
- [lista miglioramenti]
```

## Examples

### Example 1: Pre-release check

User: "Check the project before we deploy"

Project health check:
1. Runs build → PASS
2. Checks i18n → cs.json missing 3 keys
3. Checks SEO → /contatti page missing metadata
4. Report: 75/100, 2 recommendations before deploy

### Example 2: New project setup

User: "What's the state of this new project?"

Project health check:
1. Verifica struttura cartelle
2. TypeScript: strict mode ON ✅
3. i18n: solo it.json, manca en.json ⚠️
4. Report: 60/100, set up EN translations

## Troubleshooting

### Build comando non trovato
Causa: package.json non nella directory corrente
Soluzione: Esegui dalla root del progetto: `cd Progetti/nome-progetto && /project-health-check`

### Payload config non trovato
Causa: Progetto senza Payload CMS
Soluzione: Salta il check Payload, report come N/A
