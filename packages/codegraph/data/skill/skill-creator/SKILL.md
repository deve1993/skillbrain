---
name: skill-creator
description: >
  Interactive guide for creating new Skills 2.0-compliant skills.
  Use when user asks to "create a new skill", "build a skill for X",
  "add a skill to the workflow", or "teach Claude how to do Y consistently".
  Walks through use case definition, frontmatter generation, instruction writing,
  evals creation, and validation against Skills 2.0 standard.
version: 1.0.0
user-invocable: true
argument-hint: "descrivi il workflow che vuoi insegnare a Claude"
allowed-tools: ["read", "write", "bash", "glob"]
---

# Skill Creator 2.0

Guide interattiva per creare skill conformi allo standard Skills 2.0.

## Overview

Crea skill che si attivano al momento giusto, insegnano workflow specifici, e si testano automaticamente con evals.

**Core principle:** Una buona skill è specifica, testabile, e segue progressive disclosure.

## Process

### Step 1: Define Use Cases

Prima di scrivere qualsiasi codice, identifica 2-3 casi d'uso concreti:

```
Use Case: [nome]
Trigger: Quando l'utente dice "[frase]" o "[frase alternativa]"
Steps:
1. [step 1]
2. [step 2]
Result: [output atteso]
```

Chiedi all'utente:
- Qual è il workflow ripetitivo che vuoi automatizzare?
- Quali frasi usano tipicamente per chiederlo?
- Qual è il risultato atteso?

### Step 2: Generate Frontmatter

Genera il frontmatter YAML con tutti i campi 2.0 appropriati:

```yaml
---
name: [kebab-case-name]
description: >
  [Cosa fa la skill — 1 frase].
  Use when [trigger condition 1].
  Use when user asks to "[phrase 1]", "[phrase 2]".
version: 1.0.0
[user-invocable: true]  # se ha senso come slash command
[argument-hint: "..."]  # se user-invocable
[allowed-tools: [...]]  # se vuoi restringere i tool
[context: "bash scripts/load_context.sh"]  # se serve context injection
---
```

**Regole nome:**
- kebab-case: `my-skill-name`
- No spazi, no maiuscole, no underscore
- No "claude" o "anthropic" nel nome

**Description ottimale:**
- Include COSA fa + QUANDO usarla (trigger phrases)
- Max 1024 chars
- No XML tags, no `<` `>`

### Step 3: Write Instructions

Struttura raccomandata per il body:

```markdown
# Nome Skill

## Overview
Descrizione breve. Core principle in 1-2 frasi.

## When to Use
- Caso d'uso principale
- Caso d'uso secondario
- Non usare quando: [condizioni]

## Instructions

### Step 1: [Primo step]
Istruzione chiara e specifica.

### Step 2: [Secondo step]
...

## Examples

### Example 1: [Scenario tipico]
User: "..."
Azione: [cosa fa la skill]
Output: [risultato]

## Troubleshooting

### La skill non si attiva
Causa: Trigger phrases troppo generiche
Soluzione: Aggiungere frasi più specifiche nella description
```

**Best practices Skills 2.0:**
- Framing positivo (no NEVER/ALWAYS/DO NOT eccessivi)
- No XML tags nel body
- Progressive disclosure: frontmatter → body → references/

### Step 4: Create Directory Structure

```bash
mkdir -p skill-name/scripts
mkdir -p skill-name/references
mkdir -p skill-name/evals
```

### Step 5: Create Evals

Per ogni skill, creare:

**evals/trigger_evals.json:**
```json
{
  "skill": "skill-name",
  "should_trigger": ["query 1", "query 2", "query 3"],
  "should_not_trigger": ["irrelevant query 1", "irrelevant query 2"]
}
```

**evals/evals.json:**
```json
{
  "skill": "skill-name",
  "version": "1.0.0",
  "test_cases": [
    {
      "id": "basic",
      "input": "typical user request",
      "expected_output_contains": ["keyword1"],
      "expected_output_excludes": ["anti-pattern"]
    }
  ]
}
```

### Step 6: Validate

Checklist finale:

- [ ] `name` in kebab-case
- [ ] `description` include trigger phrases
- [ ] `version` presente
- [ ] Nessun XML tag nel body
- [ ] Sezione `## Examples` presente
- [ ] Sezione `## Troubleshooting` presente
- [ ] `evals/trigger_evals.json` con 5+ test
- [ ] `evals/evals.json` con 3+ test
- [ ] Se slash command: `user-invocable: true` + `argument-hint`

## Examples

### Example 1: Creare una skill per code review

User: "Crea una skill per fare code review del nostro stile"

Skill creator:
1. Chiede: quali pattern volete verificare? (naming, patterns, no-any, ecc.)
2. Genera frontmatter con trigger phrases come "review my code", "check this PR"
3. Scrive istruzioni con checklist specifica per il vostro stile
4. Crea evals con query tipo "Can you review this component?"

### Example 2: Skill per workflow n8n

User: "Voglio una skill che mi aiuti a creare workflow n8n"

Skill creator:
1. Chiede: quali tipi di workflow? (webhook, cron, data sync)
2. Genera trigger phrases: "create an n8n workflow", "automate this with n8n"
3. Scrive istruzioni che seguono best practice n8n
4. Crea evals con scenari concreti

## Troubleshooting

### La skill è troppo generica e si attiva sempre
Causa: Description troppo vaga
Soluzione: Aggiungere trigger phrases specifiche e negative examples negli evals

### La skill non si attiva mai
Causa: Trigger phrases troppo tecniche o rare
Soluzione: Usare il linguaggio naturale dell'utente nella description

### YAML syntax error al caricamento
Causa: Caratteri speciali (< > :) nella description senza quotes
Soluzione: Wrappare description in `>` block scalar o quotes
