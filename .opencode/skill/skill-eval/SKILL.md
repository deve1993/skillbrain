---
name: skill-eval
description: >
  Runs and analyzes eval test cases for Claude skills.
  Use when asked to "test a skill", "check if this skill works",
  "run evals", "verify skill quality", or after creating/modifying a skill.
version: 1.0.0
user-invocable: true
argument-hint: "nome della skill da testare"
allowed-tools: ["bash", "read", "glob"]
---

# Skill Eval Runner

Analizza e verifica la qualità delle skill tramite i file evals/.

## Overview

Esegue il ciclo RED-GREEN-REFACTOR adattato alle skill:
- RED: verifica che la skill risolva un problema reale
- GREEN: conferma che trigger e output siano corretti
- REFACTOR: suggerisce miglioramenti basati sui test

## Process

### Step 1: Locate Evals

```bash
ls .Claude/skill/{skill-name}/evals/
```

Cerca: `trigger_evals.json`, `evals.json`

### Step 2: Validate Trigger Accuracy

Leggi `trigger_evals.json` e verifica:
- Le query in `should_trigger` matchano la description della skill?
- Le query in `should_not_trigger` sono sufficientemente diverse?
- Ci sono abbastanza test cases? (minimo 5 per should_trigger)

Report:
```
Trigger Analysis for {skill-name}:
✅ should_trigger: {n} cases — coverage seems adequate
⚠️  should_not_trigger: {n} cases — consider adding more negative cases
```

### Step 3: Validate Quality Evals

Leggi `evals.json` e verifica:
- I test cases coprono i casi d'uso principali?
- Gli `expected_output_contains` sono realistici?
- Ci sono test per edge cases?

### Step 4: Run Script Validation

Se la skill ha scripts/:
```bash
bash .Claude/scripts/run_evals.sh 2>&1
```

### Step 5: Generate Report

```
SKILL EVAL REPORT: {skill-name}
================================
Trigger evals: {n} should_trigger, {m} should_not_trigger
Quality evals: {n} test cases
Scripts: {present/absent}

Issues found:
- [lista problemi]

Recommendations:
- [lista suggerimenti]

Overall quality: {PASS/NEEDS_IMPROVEMENT/FAIL}
```

## Examples

### Example 1: Testare skill brainstorming

```
/skill-eval brainstorming
→ Legge .Claude/skill/brainstorming/evals/
→ Analizza trigger_evals.json: 7 should_trigger, 4 should_not_trigger
→ Analizza evals.json: 3 test cases
→ Report: PASS — coverage adeguata
```

### Example 2: Nuova skill appena creata

```
/skill-eval my-new-skill
→ Legge .Claude/skill/my-new-skill/evals/
→ Trova solo 2 trigger cases
→ Report: NEEDS_IMPROVEMENT — aggiungere almeno 3 trigger cases
→ Suggerisce: "Add these trigger phrases: ..."
```

## Troubleshooting

### evals/ directory non trovata
Causa: La skill non ha ancora evals
Soluzione: Usa skill-creator per aggiungere evals, oppure copia dal template in skill-template-2.0/evals/

### JSON syntax error in evals file
Causa: Trailing comma o caratteri speciali
Soluzione: Valida con `python3 -m json.tool {file}`
