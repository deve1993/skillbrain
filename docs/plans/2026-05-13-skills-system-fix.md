# Skills System — Piano di Rimedio

**Contesto:** Audit critico del 12/05/2026 ha rilevato 3 bug strutturali e 1 conflitto architetturale nel reparto skills. Riferimento conversazione precedente: analisi `skill_route`/`skill_read`/`SkillsStore` su DB `MASTER_Fullstack session/.codegraph/graph.db` (258 skill, 0 righe `skill_usage`).

**Obiettivo:** ripristinare la telemetria, installare gate hardware via hook, raccogliere 2 settimane di dati reali, poi decidere policy MCP-primary vs estensione.

**Branch:** `fix/skills-system-rehab` (creare a inizio fase 0).

---

## Findings di partenza (sintesi)

| # | Bug | File | Severità |
|---|-----|------|----------|
| 1 | Importer legge `.opencode/` invece di `.claude/` | `packages/storage/src/import-skills.ts:101,138,156,181` | Critica |
| 2 | `catch {}` muto nasconde failure di telemetria | `packages/storage/src/skills-store.ts:441` | Critica |
| 3 | `EmbeddingService` non cablato in `route()` | `packages/storage/src/skills-store.ts:351` | Alta |
| 4 | Parser YAML custom perde array/multilinea | `packages/storage/src/import-skills.ts:55` | Media |
| 5 | Dedup `recordUsage` in-memory non persistente | `packages/storage/src/skills-store.ts:422` | Media |
| 6 | `cortex_briefing` doppia-conta `routed` | `packages/codegraph/src/mcp/tools/skills.ts:408` | Bassa |
| 7 | 20 symlink misti a 109 dir in `.claude/skill/` | filesystem | Bassa |
| 8 | Nessun hook SessionStart che invochi `cortex_briefing` | `.claude/settings.json` | Critica (gate) |
| 9 | Nessun hook PostToolUse che invochi `skill_apply` per Skill nativi | `.claude/settings.json` | Alta (gate) |
| 10 | Duplicazione nomi: `brainstorming`/`frontend-design` esistono come built-in Claude Code E come MCP | architetturale | Da decidere |

---

## Routing del lavoro: chi fa cosa

| Tipo task | Esecutore | Motivo |
|-----------|-----------|--------|
| Modifica file singolo, scope chiuso, refactor mechanico | **Codex** (via `codex:rescue`) | Veloce, deterministic, isolabile |
| Decisioni cross-cutting, design, hook config, scrittura prompt | **Claude (main)** | Serve contesto multi-file |
| Verifica output Codex (smell check, diff review) | **Claude** | Trust-but-verify |
| Test/coverage nuovi | **Codex** | Pattern noti |
| Cleanup filesystem (rm legacy, symlink → DB alias) | **Claude** | Reversibile solo con attenzione |

Convention: ogni task Codex parte con un prompt self-contained che include (a) file path con riga, (b) cosa cambiare, (c) acceptance test. Output va su branch corrente, no PR auto.

---

## Fase 0 — Pre-flight (Claude, ~15 min)

- [ ] **0.1** `git checkout -b fix/skills-system-rehab` da `main`
- [ ] **0.2** Snapshot baseline metrica:
  ```bash
  PROJ_DB="/Users/dan/Desktop/progetti-web/MASTER_Fullstack session/.codegraph/graph.db"
  sqlite3 "$PROJ_DB" "SELECT COUNT(*) FROM skills; SELECT COUNT(*) FROM skill_usage;" > /tmp/skills-baseline.txt
  ```
- [ ] **0.3** Verifica che `.opencode/` esista come legacy mirror; se no, fase 1.1 va testata con cura
- [ ] **0.4** Avvio `session_resume({ project: "Synapse" })` + `cortex_briefing({ task: "skills system rehab" })` per warm-up memoria

**Gate per passare a Fase 1:** branch creato, baseline salvata, briefing letto.

---

## Fase 1 — Sblocca telemetria (Codex, ~1h)

### Task 1.1 — Fix path importer → Codex

**Prompt per `codex:rescue`:**
```
Repo: /Users/dan/Desktop/progetti-web/MASTER_Fullstack session
File: packages/storage/src/import-skills.ts
Problem: walks .opencode/ but project uses .claude/

Fix:
1. Lines 102, 138, 156, 181 use path.join(workspacePath, '.opencode', ...).
   Change to read from .claude/ FIRST, fall back to .opencode/ for BC:

   function pickDir(workspacePath: string, ...segments: string[]): string {
     const newPath = path.join(workspacePath, '.claude', ...segments)
     if (fs.existsSync(newPath)) return newPath
     return path.join(workspacePath, '.opencode', ...segments)
   }

2. Replace each call:
   - line 102: pickDir(workspacePath, 'skill')
   - line 138: pickDir(workspacePath, 'agents')
   - line 156: pickDir(workspacePath, 'agent')
   - line 181: pickDir(workspacePath, 'command')

3. Update header comment line 14 accordingly.

Acceptance:
- After running import, SELECT COUNT(*) FROM skills should still be >= 258
- New skill added at .claude/skill/test-foo/SKILL.md with valid frontmatter must appear in DB after re-import
- Run `pnpm test --filter=@skillbrain/storage` — all existing tests pass
```

### Task 1.2 — Logging del catch silenzioso → Codex

**Prompt per `codex:rescue`:**
```
Repo: /Users/dan/Desktop/progetti-web/MASTER_Fullstack session
File: packages/storage/src/skills-store.ts
Line: ~441 in recordUsage()

Current code:
  try { this.stmts.insertUsage.run(...) }
  catch { /* skill_usage table may not exist on legacy DB until migrations run */ }

Replace with:
  try { this.stmts.insertUsage.run(name, ctx.sessionId ?? null, ctx.project ?? null, ctx.task ?? null, action, ctx.userId ?? null) }
  catch (err) {
    if (!SkillsStore._telemetryWarned) {
      console.warn('[skill_usage] insert failed, telemetry disabled:', (err as Error).message)
      SkillsStore._telemetryWarned = true
    }
    SkillsStore._telemetryFailures++
  }

Also:
- Add private static fields: _telemetryWarned = false, _telemetryFailures = 0
- Add public static getter telemetryFailures()

Then update packages/codegraph/src/mcp/tools/skills.ts skill_health tool to include
telemetry_failures: SkillsStore.telemetryFailures in the report.

Acceptance:
- Test that intentionally dropping skill_usage table causes 1 warn line + counter increments
- Test that successful inserts leave counter at 0
- skill_health output now contains "telemetry_failures: N" line
```

### Task 1.3 — Re-import e verify → Claude

- [ ] Esegui il comando di import (cercare CLI in `packages/codegraph/src/cli/`)
- [ ] Verifica `SELECT COUNT(*) FROM skills GROUP BY type` ≥ baseline
- [ ] Chiamata manuale `mcp__codegraph__skill_route({ task: "test stripe payments", project: "Synapse" })` → verifica `skill_usage` ha 5 nuove righe `routed`
- [ ] Se 0 righe ancora → debug, NON proseguire

**Gate Fase 2:** `skill_usage` cresce ad ogni `skill_route`. Conta righe / minuto > 0 in normale uso.

---

## Fase 2 — Hook hardware (Claude, ~2h)

### Task 2.1 — SessionStart hook auto-briefing

- [ ] Crea `.claude/scripts/auto-briefing.mjs`:
  - Detect cwd + git branch
  - Chiama l'MCP `cortex_briefing` via stdio (il proxy `codegraph` già loaded)
  - Stampa output come system context (Claude lo riceve nel reminder)
- [ ] Aggiungi a `.claude/settings.json`:
  ```json
  "hooks": {
    "SessionStart": [{
      "command": "node .claude/scripts/auto-briefing.mjs"
    }]
  }
  ```
- [ ] Test: aprire nuova sessione Claude Code → primo system reminder deve contenere "Cortex Briefing"

### Task 2.2 — PostToolUse hook per Skill nativi

- [ ] Crea `.claude/scripts/skill-apply-hook.mjs`:
  - Riceve evento `PostToolUse` con `tool_name=Skill` e `args.skill=<nome>`
  - Chiama `mcp__codegraph__skill_apply({ name, project, sessionId })`
- [ ] Aggiungi hook in `.claude/settings.json`:
  ```json
  "PostToolUse": [{
    "matcher": { "tool_name": "Skill" },
    "command": "node .claude/scripts/skill-apply-hook.mjs"
  }]
  ```
- [ ] Test: invoca un built-in Skill (`brainstorming`) → `SELECT * FROM skill_usage WHERE action='applied' AND skill_name='brainstorming'` deve avere 1 riga

### Task 2.3 — Aggiornare CLAUDE.md → Claude

- [ ] Aggiungere sezione "Auto-hook installed":
  ```
  Note: cortex_briefing è auto-invocato a SessionStart via hook.
  Non chiamarlo manualmente a meno che il task cambi a metà sessione.
  skill_apply è auto-invocato a PostToolUse del Skill tool.
  Tu (Claude) chiamalo solo per skill MCP caricati via skill_read.
  ```

**Gate Fase 3:** apri 3 nuove sessioni di prova → tutte e 3 ricevono briefing automatico, `skill_usage` registra eventi senza intervento Claude.

---

## Fase 3 — Raccolta dati (passiva, ~2 settimane)

Non fare nulla. Lavora normalmente. A fine periodo:

- [ ] **3.1** Estrai report con `mcp__codegraph__skill_health`
- [ ] **3.2** Salva su `docs/plans/2026-05-27-skills-health-report.md`:
  - Dead skills (routed mai loaded)
  - At-risk (confidence ≤ 4)
  - Top routed (ranking effettivo)
  - Top applied (truth signal)
  - Cooccurrences (quali skill si combinano)
- [ ] **3.3** Identifica nomi duplicati MCP vs built-in:
  ```bash
  # Built-in dal system reminder (parsing manuale o via SDK)
  # MCP da: sqlite3 .codegraph/graph.db "SELECT name FROM skills WHERE type='domain';"
  # diff dei nomi
  ```

**Gate Fase 4:** report con almeno 100 righe `routed` e 30 righe `applied`. Se sotto soglia, prorogare a 4 settimane.

---

## Fase 4 — Cleanup data-driven (Claude + Codex, ~3h)

### Task 4.1 — Decisione policy duplicati → Claude

Sulla base del report 3.2, scegliere per ogni nome duplicato:
- **Cancella MCP**: se built-in vince in apply rate
- **Cancella built-in**: disabilita in `.claude/settings.json` lista plugin (richiede ricerca path)
- **Tieni alias**: crea entry in `skill_aliases` table

Output: tabella decisioni in `docs/plans/2026-05-27-duplicates-decision.md`.

### Task 4.2 — js-yaml parser → Codex

**Prompt per `codex:rescue`:**
```
File: packages/storage/src/import-skills.ts:55-75
Replace custom parseFrontmatter() with js-yaml.

1. Add dep: pnpm add js-yaml @types/js-yaml --filter=@skillbrain/storage
2. import yaml from 'js-yaml'
3. Replace parseFrontmatter:
   function parseFrontmatter(content: string): Record<string, any> {
     const match = content.match(/^---\n([\s\S]*?)\n---/)
     if (!match) return {}
     try { return (yaml.load(match[1]) as Record<string, any>) ?? {} }
     catch { return {} }
   }

Acceptance:
- Skill with frontmatter `tags: [a, b, c]` now imports tags as array (current custom parser loses it)
- All 258 existing skills still import successfully after re-import
- Add test in tests/import-skills.test.ts with skill having multi-line description + array tags + version
```

### Task 4.3 — Embeddings in route() → Codex

**Prompt per `codex:rescue`:**
```
File: packages/storage/src/skills-store.ts
Goal: blend semantic similarity with BM25 in route().

1. Import EmbeddingService from './embedding-service.js'
2. Add column to skills table: embedding BLOB (migration in packages/storage/src/migrations/)
3. On upsert, compute embedding from `${name} ${description}` and store as blob
4. In route():
   - Compute task embedding
   - For each candidate (search result + top 50 by category), compute cosine
   - Replace `0.38 * bm25Norm` with `0.25 * bm25Norm + 0.20 * cosineSim`
   - Keep other weights as-is
5. Add EmbeddingService.get() singleton check at SkillsStore construction; if fails, fallback to current BM25-only ranking with console.warn

Acceptance:
- Query "auth bug" returns skill named "authentication" or "auth" in top 3 even though terms don't match exactly
- All existing skill_route tests still pass
- New test: route("payment integration") returns "payments" or "stripe" in top 3
```

### Task 4.4 — Cleanup .opencode/ → Claude

- [ ] Verifica fase 1.1 ha completato import da `.claude/` con conteggi corretti
- [ ] `rm -rf .opencode/` (REVERSIBILE solo via git — fai un commit prima)
- [ ] Rimuovi fallback `pickDir` da import-skills.ts → solo `.claude/`
- [ ] Commit separato per facile revert

### Task 4.5 — Cortex briefing dedup → Codex

**Prompt per `codex:rescue`:**
```
File: packages/codegraph/src/mcp/tools/skills.ts:408-411
Problem: cortex_briefing records 'routed' for skills it discovers, but skill_route
already does the same. If both called same session+task → double count.

Fix:
- In cortex_briefing, change recordUsage action from 'routed' to 'briefed' (new action enum value)
- Update SkillUsageAction in skills-store.ts to include 'briefed'
- Update topRouted SQL to optionally include 'briefed' if explicit param set, default off
- Update skill_health 'briefed' counts as separate section

Acceptance:
- cortex_briefing 10 times with same task → 10 'briefed' rows, 0 extra 'routed' rows
- skill_route still records 'routed' as before
```

### Task 4.6 — Symlinks → alias table → Codex (deferred to Fase 5)

Lasciare per dopo. Non bloccante.

---

## Fase 5 — Skill 2.0 compliance batch (opzionale, ~4h)

Da fare solo se Fase 3 mostra che vale la pena. Per le 30 skill più routed:

- [ ] Aggiungere `version`, `user-invocable`, `argument-hint` al frontmatter
- [ ] Aggiungere `evals/trigger_evals.json` minimale (5 esempi)
- [ ] Per le top 10: aggiungere `evals/evals.json` con golden outputs

Delegabile a Codex con un prompt per skill (loop esterno).

---

## Acceptance globale

Alla fine del piano:

| Metrica | Target |
|---------|--------|
| Skill in DB importate da `.claude/` | ≥ 258 |
| `skill_usage` righe dopo 2 settimane normale uso | ≥ 200 |
| `telemetry_failures` counter | 0 |
| Nuove sessioni con briefing auto | 100% |
| Built-in Skill loaded → registrato in SkillsStore come `applied` | sì |
| `route("auth bug")` top-3 include skill "auth" | sì |
| `.opencode/` rimosso | sì |
| CLAUDE.md aggiornato con realtà hook-driven | sì |

---

## Rollback plan

Tutto in branch dedicato. Se qualcosa va storto:
- `git checkout main`
- `.opencode/` recuperato via `git show main:.opencode/...` (è committato)
- Hook in settings.json sono additivi → rimuovere blocco `hooks`
- DB telemetria: nuove righe `routed/applied` non rompono nulla esistente (additive)

---

## Note operative per la prossima sessione

1. Aprire questo file PER PRIMO (`Read docs/plans/2026-05-13-skills-system-fix.md`)
2. Eseguire fase 0
3. Per ogni task marcato "Codex": invocare `codex:rescue` con il prompt esatto sopra
4. Per ogni task marcato "Claude": esegui inline
5. **Verifica sempre l'output Codex** con `git diff` prima di passare al task successivo (trust-but-verify)
6. Commit per task (atomicità: ogni commit revertabile)
7. A fine fase: `mcp__codegraph__memory_add({ type: "Decision", context: "...fase X completata, risultati Y", project: "Synapse" })`

**Tempo totale stimato:** 
- Fase 0: 15 min
- Fase 1: 1h (di cui 30 min Codex)
- Fase 2: 2h (Claude solo)
- Fase 3: 2 settimane wall-clock, 30 min lavoro effettivo
- Fase 4: 3h (di cui 1.5h Codex)
- **Totale lavoro attivo: ~7h, spalmato su 2-3 settimane**
