---
name: codegraph-context
description: >
  Use at the START of any coding session or before touching code in a project.
  Triggers on: "lavora su X", "modifica X", "aggiungi feature a X", "fix in X",
  any request that implies working inside a specific project folder.
  Ensures the CodeGraph index is fresh and loads the 5-layer Cortex briefing.
  Without this, you are working blind — no impact analysis, no memory, no context.
user-invocable: true
argument-hint: "percorso o nome del progetto su cui lavorare"
---

# CodeGraph Context — Carica il cervello prima di lavorare

## Perché questa skill esiste

Lavorare su codice senza il grafo CodeGraph è come operare bendati.
Lavorare senza Memory Graph è come avere amnesia tra una sessione e l'altra.

Con il Cortex attivo posso:
- Sapere **esattamente** quali funzioni dipendono da quella che sto toccando
- Ricordare **bug, pattern, e decisioni** da sessioni precedenti
- Vedere **cosa è successo** nelle altre sessioni Claude Code
- Fare **impact analysis** prima di modificare

**Senza il Cortex: indovino. Con il Cortex: so.**

---

## Il Protocollo (eseguire sempre in ordine)

### Step 1 — Registra inizio sessione

```
session_start({
  sessionName: "MASTER_Fullstack",
  project: "{nome progetto corrente}",
  workspacePath: "{percorso workspace}",
  repo: "skillbrain"
})
```

### Step 2 — Carica il Cortex (5-layer briefing)

```bash
bash "/Users/dan/Desktop/progetti-web/MASTER_Fullstack session/.opencode/scripts/load_project_context.sh"
```

Questo genera:
- **Layer 1: Identity** — stack versions (Next.js, TS, Payload)
- **Layer 2: Event Log** — ultimi commit, file modificati, branch
- **Layer 3: Cross-Session** — cosa è successo nelle altre sessioni
- **Layer 4: Project Status** — Memory Graph stats, contradictions
- **Layer 5: Knowledge Synthesis** — top 5 memorie per confidence

### Step 3 — Identifica e indicizza il progetto target

```bash
node packages/codegraph/dist/cli.js list
```

**Repo già indicizzato?** → Verifica freshness:
```bash
node packages/codegraph/dist/cli.js status /percorso/progetto
```

**Repo NON indicizzato?** → Indicizza:
```bash
node packages/codegraph/dist/cli.js analyze /percorso/progetto
# o per non-git:
node packages/codegraph/dist/cli.js analyze /percorso --skip-git
```

### Step 4 — Carica contesto CodeGraph

```
codegraph_query(
  query: "main entry point architecture overview",
  repo: "nome-repo",
  limit: 5
)
```

### Step 5 — Carica memorie rilevanti per il task

```
memory_load({
  project: "{nome progetto}",
  activeSkills: ["next-best-practices", "systematic-debugging", ...],
  limit: 15,
  repo: "skillbrain"
})
```

Se il task ha un focus specifico, aggiungi una ricerca mirata:
```
memory_search({
  query: "{descrizione del task}",
  limit: 5,
  repo: "skillbrain"
})
```

### Step 6 — Controlla history cross-session

```
session_history({
  limit: 3,
  repo: "skillbrain"
})
```

### Step 7 — Conferma e procedi

```
✅ Cortex caricato per [nome-repo]
   📊 NNN nodi | NNN relazioni | NN flussi
   🧠 NN memorie caricate (top confidence: N)
   📋 Ultime N sessioni: [riassunto]
   🕐 Indice aggiornato al: [data]

Pronto a lavorare con piena consapevolezza.
```

---

## Quando RE-indicizzare durante il lavoro

| Situazione | Azione |
|-----------|--------|
| Hai aggiunto nuovi file | Re-indicizza |
| Hai spostato/rinominato file | Re-indicizza |
| Hai modificato molte funzioni (5+) | Re-indicizza |
| L'impact analysis dà risultati strani | Re-indicizza |
| Hai fatto un refactor strutturale | Re-indicizza |
| Stai modificando solo 1-2 funzioni | Non serve |

---

## A fine sessione

**OBBLIGATORIO**: Invoca `post-session-review` che:
1. Auto-cattura memorie dalla sessione
2. Applica decay al Memory Graph
3. Registra la fine sessione con `session_end`

---

## Integrazione con altre skills

- **Prima di** `systematic-debugging` → carica il grafo per tracciare il root cause
- **Prima di** `writing-plans` → carica il grafo per un piano accurato
- **Durante** `subagent-driven-development` → ogni subagent deve avere il nome del repo
- **Prima di** qualsiasi refactoring → usa `codegraph_impact` per il blast radius
