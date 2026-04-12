---
name: gitnexus-context
description: >
  Use at the START of any coding session or before touching code in a project.
  Triggers on: "lavora su X", "modifica X", "aggiungi feature a X", "fix in X",
  any request that implies working inside a specific project folder.
  Ensures the GitNexus knowledge graph is indexed and fresh before writing a single line of code.
  Without this, you are working blind — no impact analysis, no call graph, no blast radius.
version: 1.0.0
user-invocable: true
argument-hint: "percorso o nome del progetto su cui lavorare"
allowed-tools: ["bash", "gitnexus_list_repos", "gitnexus_query", "gitnexus_context", "gitnexus_impact"]
---

# GitNexus Context — Carica il cervello prima di lavorare

## Perché questa skill esiste

Lavorare su codice senza il grafo GitNexus è come operare bendati.
Ogni modifica potrebbe rompere 10 altre cose che non conosco.

Con il grafo attivo posso:
- Sapere **esattamente** quali funzioni dipendono da quella che sto toccando
- Fare **impact analysis** prima di modificare
- Tracciare **flussi di esecuzione** completi
- Rinominare simboli in **tutti i file** senza perderne uno

**Senza il grafo: indovino. Con il grafo: so.**

---

## Il Protocollo (eseguire sempre in ordine)

### Step 1 — Identifica il progetto target

Determina il percorso assoluto del progetto su cui devo lavorare.

Se l'utente dice un nome ("lavora su Quickfy") cerca il percorso nei repo già indicizzati:

```bash
# Controlla quali repo sono già indicizzati
curl -s http://localhost:4747/api/repos 2>/dev/null
# oppure usa il tool MCP
# gitnexus_list_repos()
```

Se il server non risponde → il processo `gitnexus serve` non è attivo.
In quel caso avvisa l'utente: **"Avvia `gitnexus serve` in un terminale separato per abilitare la web UI."**
Il MCP funziona comunque — continua.

---

### Step 2 — Controlla se il repo è indicizzato

```bash
gitnexus list 2>&1
```

**Caso A — Repo già indicizzato:** vai allo Step 3.

**Caso B — Repo NON indicizzato:** indicizza subito:

```bash
# Se è un repo git:
gitnexus analyze /percorso/progetto

# Se NON è un repo git (no .git directory):
gitnexus analyze /percorso/progetto --skip-git
```

Attendi il completamento. Output atteso:
```
Repository indexed successfully (Xs)
NNN nodes | NNN edges | NN clusters | NN flows
```

---

### Step 3 — Verifica che l'indice sia fresco

L'indice è "fresco" se corrisponde all'ultimo stato del codice.

**Per repo git** — confronta il lastCommit nell'indice con HEAD:

```bash
cd /percorso/progetto && git rev-parse HEAD
# confronta con "lastCommit" restituito da gitnexus_list_repos
```

Se i commit **non coincidono** → re-indicizza:
```bash
gitnexus analyze /percorso/progetto
```

**Per repo senza git** — controlla se ci sono file modificati di recente rispetto alla data di indicizzazione:

```bash
find /percorso/progetto -name "*.ts" -o -name "*.js" -o -name "*.py" | \
  xargs ls -lt 2>/dev/null | head -5
# Se i file sono più recenti dell'indexedAt → re-indicizza
```

---

### Step 4 — Carica il contesto del progetto

Con il repo indicizzato e fresco, esegui una query iniziale per orientarti:

```
gitnexus_query(
  query: "main entry point architecture overview",
  repo: "nome-repo",
  limit: 5
)
```

Questo mi dà i flussi principali del progetto — senza di questo parto dal nulla.

---

### Step 4b — Carica i learnings rilevanti

Invoke `load-learnings` immediately after the graph query:

```
load-learnings(
  context: "{current project name} — {user's task description}"
)
```

This uses semantic search to surface the 15 most relevant past learnings for this session.
Without this step, past mistakes and patterns are invisible — the whole memory system is bypassed.

---

### Step 5 — Conferma e procedi

Comunica all'utente:

```
✅ Contesto GitNexus caricato per [nome-repo]
   📊 NNN nodi | NNN relazioni | NN flussi
   🕐 Indice aggiornato al: [data]
   
Pronto a lavorare con piena consapevolezza del codice.
```

Poi procedi con il task originale dell'utente.

---

## Quando RE-indicizzare durante il lavoro

Non serve re-indicizzare ad ogni modifica. Re-indicizza quando:

| Situazione | Azione |
|-----------|--------|
| Hai aggiunto nuovi file | Re-indicizza |
| Hai spostato/rinominato file | Re-indicizza |
| Hai modificato molte funzioni (5+) | Re-indicizza |
| L'impact analysis dà risultati strani | Re-indicizza |
| Hai fatto un refactor strutturale | Re-indicizza |
| Stai modificando solo 1-2 funzioni | Non serve |

---

## Comandi rapidi di riferimento

```bash
# Lista repo indicizzati
gitnexus list

# Indicizza (git repo)
gitnexus analyze /percorso

# Indicizza (non-git)
gitnexus analyze /percorso --skip-git

# Verifica stato indice
gitnexus status

# Avvia server per web UI (se non attivo)
gitnexus serve
```

---

## Red Flags — STOP se pensi questi pensieri

| Pensiero | Realtà |
|---------|--------|
| "È una modifica piccola, non serve il grafo" | Le modifiche piccole rompono sistemi grandi. Controlla sempre. |
| "Conosco già questo codice" | Il codice cambia. L'indice riflette la realtà attuale. |
| "Il grafo rallenta tutto" | L'indicizzazione dura 3-10 secondi. Un bug da impact analysis evitato vale ore. |
| "Lo faccio dopo" | Farlo dopo significa che ho già scritto codice alla cieca. |

---

## Integrazione con altre skills

- **Prima di** `systematic-debugging` → carica il grafo per tracciare il root cause
- **Prima di** `writing-plans` → carica il grafo per un piano accurato
- **Durante** `subagent-driven-development` → ogni subagent deve avere il nome del repo
- **Prima di** qualsiasi refactoring → usa `gitnexus_impact` per il blast radius
