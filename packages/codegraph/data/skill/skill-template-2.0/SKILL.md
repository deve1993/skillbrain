---
name: skill-template-2.0
description: >
  Reference template for creating Skills 2.0-compliant skill files.
  Use when creating a new skill or upgrading an existing skill to Skills 2.0 format.
  Includes all supported frontmatter fields, progressive disclosure structure,
  evals/, scripts/, references/ directory layout, and examples.
version: 2.0.0
compatibility: >
  Claude Code, Claude.ai. Scripts require Python 3.9+ or Bash 5+.
  Context injection requires shell access.
metadata:
  author: pixarts-workflow
  last-updated: 2026-03
---

# Skill Template 2.0 — Reference Guide

> Template ufficiale per creare skill conformi allo standard Skills 2.0 di Anthropic.
> Copiare questo template, rinominare la cartella, e personalizzare ogni sezione.

---

## Struttura Directory

```
your-skill-name/
├── SKILL.md                   # Obbligatorio - istruzioni + frontmatter
├── scripts/                   # Opzionale - Python/Bash eseguibili
│   ├── load_context.sh        # Esempio: context injection
│   └── validate.py            # Esempio: validazione output
├── references/                # Opzionale - doc caricate on-demand
│   ├── api-guide.md
│   └── examples/
├── assets/                    # Opzionale - template, font, icone
│   └── report-template.md
└── evals/                     # Raccomandato - test automatici
    ├── trigger_evals.json     # Test trigger accuracy
    └── evals.json             # Test qualità output
```

---

## Frontmatter Fields — Guida Completa

### Campi Skills 1.0 (base)

| Campo | Tipo | Obbligatorio | Note |
|-------|------|:---:|------|
| `name` | string | ✅ | kebab-case, no spazi, no maiuscole |
| `description` | string | ✅ | Max 1024 chars. Include COSA fa + QUANDO usarla (trigger phrases) |
| `license` | string | - | MIT, Apache-2.0, ecc. |
| `compatibility` | string | - | Requisiti ambiente (1-500 chars) |
| `metadata` | object | - | Coppie key-value custom (author, version, mcp-server) |

### Campi Skills 2.0 (nuovi)

| Campo | Tipo | Note |
|-------|------|------|
| `version` | string | Semantic versioning: `1.0.0` |
| `allowed-tools` | list | Limita i tool disponibili: `["bash", "read", "write", "glob"]` |
| `argument-hint` | string | Hint per slash command: `"descrivi cosa vuoi fare"` |
| `user-invocable` | bool | `true` = la skill diventa `/nome-skill` slash command |
| `model` | string | Override modello: `claude-opus-4`, `claude-sonnet-4-5` |
| `disable-model-invocation` | bool | `true` = esegui solo scripts, no LLM call |
| `context` | string | Shell command per context injection: `"bash scripts/load_context.sh"` |
| `agent` | object | Config subagent spawning |
| `hooks` | object | Lifecycle hooks: `pre`, `post` |

### Esempi Frontmatter Completi

**Skill semplice (aggiornamento minimo):**
```yaml
---
name: my-skill
description: >
  Analyzes React components for accessibility issues.
  Use when user asks to "check a11y", "audit accessibility",
  or when building new UI components.
version: 1.0.0
---
```

**Skill con slash command:**
```yaml
---
name: frontend-audit
description: >
  Audits frontend code for performance, accessibility, and best practices.
  Use when user asks to "audit", "review", "check" a component or page.
version: 1.2.0
user-invocable: true
argument-hint: "path al componente o pagina da auditare"
allowed-tools: ["read", "glob", "bash"]
---
```

**Skill con context injection:**
```yaml
---
name: nextjs-optimizer
description: >
  Optimizes Next.js components following current project conventions.
  Use when working on Next.js pages, components, or app router files.
version: 2.0.0
context: "bash scripts/load_nextjs_context.sh"
allowed-tools: ["read", "write", "bash", "glob"]
---
```

**Skill con hooks e subagent:**
```yaml
---
name: full-workflow
description: >
  End-to-end workflow execution with review checkpoints.
  Use when executing multi-step implementation plans.
version: 1.0.0
hooks:
  pre: "bash scripts/setup.sh"
  post: "bash scripts/cleanup.sh"
agent:
  model: claude-opus-4
  max_tokens: 8192
---
```

---

## Struttura Body SKILL.md — Standard 2.0

```markdown
# Nome Skill

## Overview
Descrizione breve. Core principle in 1-2 frasi.

## When to Use
- Caso d'uso 1
- Caso d'uso 2
- NON usare quando: [condizioni]

## Instructions

### Step 1: [Primo step]
Spiegazione chiara e concreta.

Esempio:
```bash
python scripts/process.py --input {filename}
```

### Step 2: [Secondo step]
...

## Examples

### Example 1: [Scenario comune]
User: "Crea un componente card"
Azione: [Descrizione]
Output: [Risultato atteso]

### Example 2: [Scenario edge case]
...

## Troubleshooting

### Errore: [Messaggio comune]
Causa: [Perché succede]
Soluzione: [Come risolvere]

### La skill non si attiva
Causa: Description trigger phrases non corrispondono
Soluzione: Usa frasi più specifiche nella request
```

---

## Context Injection — Pattern

Il campo `context` esegue uno shell command **prima** che Claude veda il prompt.
Usa per iniettare dati live: versioni, configurazioni, stato del progetto.

```bash
#!/bin/bash
# scripts/load_context.sh - Esempio context injection

echo "## Project Context (auto-injected)"
echo "Next.js version: $(node -p "require('./package.json').dependencies.next" 2>/dev/null || echo 'N/A')"
echo "TypeScript: $(cat tsconfig.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('compilerOptions',{}).get('strict','N/A'))" 2>/dev/null)"
echo "Current branch: $(git branch --show-current 2>/dev/null)"
echo "Modified files: $(git diff --name-only 2>/dev/null | head -5)"
```

---

## Evals — Struttura

### trigger_evals.json — Test di attivazione

```json
{
  "skill": "your-skill-name",
  "description": "Test che la skill si attivi/non attivi correttamente",
  "should_trigger": [
    "Query che DEVE attivare la skill",
    "Altra query che deve attivarla",
    "Ancora un'altra query trigger"
  ],
  "should_not_trigger": [
    "Query che NON deve attivare la skill",
    "Altro esempio da ignorare"
  ]
}
```

### evals.json — Test di qualità output

```json
{
  "skill": "your-skill-name",
  "version": "1.0.0",
  "test_cases": [
    {
      "id": "basic-functionality",
      "input": "Descrizione del task da eseguire",
      "expected_output_contains": ["keyword1", "keyword2"],
      "expected_output_excludes": ["anti-pattern1"],
      "description": "Verifica funzionalità base"
    },
    {
      "id": "edge-case",
      "input": "Caso limite",
      "expected_output_contains": ["handling corretto"],
      "description": "Gestione edge case"
    }
  ]
}
```

---

## Regole Nome Skill

- `kebab-case` ✅ → `my-skill-name`
- No spazi ❌ → `My Skill Name`
- No underscore ❌ → `my_skill_name`
- No maiuscole ❌ → `MySkillName`
- No `claude` o `anthropic` nel nome ❌ (riservati)

---

## Writing Best Practices (Skills 2.0)

### Description field — La cosa più importante

Deve includere ENTRAMBI:
1. **Cosa fa** la skill
2. **Quando usarla** (trigger phrases esplicite)

**Buono:**
```yaml
description: >
  Generates accessible, responsive React components with TypeScript.
  Use when user asks to "create a component", "build a button/form/modal",
  or when working on UI elements in any React/Next.js project.
```

**Cattivo:**
```yaml
description: React component generator
```

### Framing positivo

Skills 2.0 preferisce framing positivo invece di proibizioni:

**Skills 1.0 (evitare):**
```markdown
NEVER write untested code.
ALWAYS run tests before committing.
DO NOT skip validation.
```

**Skills 2.0 (preferire):**
```markdown
Write tests before implementation — this ensures code meets spec.
Run tests before committing to verify everything works.
Validate inputs at each step for reliability.
```

### Progressive Disclosure

1. **Frontmatter** (sempre in system prompt) — solo trigger + quando usare
2. **Body SKILL.md** (caricato quando rilevante) — istruzioni complete
3. **references/** (caricati on-demand) — documentazione pesante

Mantieni il body SKILL.md sotto **500 righe** per core skills, **200 righe** per skill semplici.

---

## Checklist Creazione Skill 2.0

- [ ] `name` in kebab-case, corrisponde al nome cartella
- [ ] `description` include cosa fa + trigger phrases
- [ ] `version` presente (`1.0.0`)
- [ ] `compatibility` se ha requisiti specifici
- [ ] Framing positivo (no NEVER/ALWAYS/DO NOT eccessivi)
- [ ] Nessun XML tag (`<TAG>`) nel body
- [ ] Sezione `## Examples` presente
- [ ] Sezione `## Troubleshooting` presente
- [ ] `evals/trigger_evals.json` con 5+ test cases
- [ ] `evals/evals.json` con 3+ test cases qualità
- [ ] Se candidata slash command: `user-invocable: true` + `argument-hint`
- [ ] Se ha context injection: `context: "bash scripts/..."` + script creato
- [ ] Se restringe tool: `allowed-tools: [...]`
