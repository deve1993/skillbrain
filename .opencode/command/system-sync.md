# /system-sync

Audit e sincronizzazione del sistema di lavoro. Rileva drift, aggiorna indici, controlla salute complessiva.

## Quando usarlo

- Inizio settimana lavorativa
- Dopo aggiunta di nuovi agenti o skill
- Quando il comportamento del sistema sembra inconsistente
- Prima di onboarding su un nuovo progetto

## Esecuzione (step obbligatori in ordine)

### Step 1 — Drift AGENTS.md ↔ opencode.json

Leggi entrambi i file ed elenca:
- Agenti in `opencode.json` NON documentati in `AGENTS.md`
- Agenti in `AGENTS.md` NON presenti in `opencode.json`
- Agenti con modello diverso tra i due file

Formato output:
```
DRIFT RILEVATO:
  + In opencode.json ma non in AGENTS.md: [lista]
  - In AGENTS.md ma non in opencode.json: [lista]
  ~ Modello diverso: [lista con dettagli]
```

Se ci sono differenze: chiedi all'utente quale versione è quella "vera" e aggiorna l'altra di conseguenza.

### Step 2 — GitNexus: stato indici

Esegui da terminale:
```bash
export PATH="/Users/dan/.bun/bin:$PATH" && gitnexus list
```

Per ogni repo mostra: nome, data ultima indicizzazione, commit indicizzato vs HEAD attuale.

Se un repo è stale (commit indicizzato ≠ HEAD), esegui:
```bash
gitnexus analyze "[path-repo]"
```

### Step 3 — Skill esterne: aggiornamenti disponibili

Leggi `skills-lock.json`. Per ogni skill con `sourceType: "github"`, controlla se ci sono aggiornamenti disponibili confrontando l'hash corrente con il source.

Presenta lista skill potenzialmente outdated.

### Step 4 — Skill custom: inventario

Leggi la directory `.Claude/skill/` e confronta con l'elenco in AGENTS.md sezione Skills.

Elenca:
- Skill presenti in `.Claude/skill/` ma NON menzionate in AGENTS.md
- Skill menzionate in AGENTS.md ma con file mancante

### Step 5 — Memory: stato knowledge base

Esegui:
```
memory_read_graph()
```

Riporta:
- Numero di entità salvate
- Numero di relazioni
- Pattern più recenti (ultimi 5)
- Eventuali entità orfane o duplicate

### Step 6 — Report finale

Presenta un summary strutturato:

```
SYSTEM SYNC REPORT — [data]
══════════════════════════════

📋 AGENTS.MD ↔ OPENCODE.JSON
   [OK/DRIFT RILEVATO + dettagli]

🗂️ GITNEXUS INDICI
   Quickfy-website: [OK/STALE — N commit di ritardo]
   pixarts-landing: [OK/STALE]
   WEB_DVEsolutions: [OK/STALE]
   Web-site:        [OK/STALE]

📦 SKILL ESTERNE (skills-lock.json)
   [N skill tracciate — possibili update: lista]

🔧 SKILL CUSTOM
   [N skill in .Claude/skill/ — N documentate in AGENTS.md]
   [Skill senza doc: lista]

🧠 MEMORY MCP
   [N entità — N relazioni — ultima entry: data]

✅ AZIONI COMPLETATE AUTOMATICAMENTE
   [lista azioni eseguite]

⚠️  AZIONI CHE RICHIEDONO INPUT UTENTE
   [lista con domande specifiche]

AGENTS.MD versione aggiornata a: X.X.X
```

### Step 7 — Aggiorna versione AGENTS.md

Incrementa il numero di versione in fondo ad AGENTS.md (es. 2.2.0 → 2.3.0) e aggiorna la data.

## Note

- Questo comando NON modifica mai opencode.json o AGENTS.md senza conferma esplicita dell'utente
- Gli aggiornamenti di skill esterne vanno eseguiti manualmente dopo review
- Il re-indice GitNexus avviene sempre in background (non blocca)
