# API Reference

Full reference for the Learning Schema, Skill interfaces, and retrieval system.

---

## Learning Schema

Every learning in the system must conform to this schema.  
Source of truth: `.agents/skills/_schema/learning-template.yml`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier. Format: `L-{skill}-{NNN}` (e.g. `L-next-002`) |
| `date` | `string` | Capture date in `YYYY-MM-DD` format |
| `type` | `enum` | See [Learning Types](#learning-types) |
| `status` | `enum` | `active` \| `pending-review` \| `deprecated` |
| `project` | `string` | Project name or `"global"` |
| `scope` | `enum` | `project-specific` \| `global` |
| `tags` | `string[]` | 2–5 tags, lowercase, kebab-case |
| `confidence` | `integer` | 1–10. Starts at 1. See [Confidence System](#confidence-system) |
| `context` | `string` | Must begin with: `"In [technology/version], when [situation]..."` |
| `problem` | `string` | What went wrong or was unclear |
| `solution` | `string` | What worked — actionable and specific |
| `reason` | `string` | WHY the solution works — understanding, not recipe |
| `validated_by` | `string[]` | List of session IDs or dates where this was confirmed |
| `created_in` | `string` | Session ID or date when this was created |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `supersedes` | `string \| null` | ID of the learning this replaces |
| `superseded_by` | `string \| null` | ID of the learning that replaced this |
| `reinforces` | `string[]` | IDs of learnings this confirms |
| `contradicts` | `string[]` | IDs of learnings this conflicts with |
| `valid_until_version` | `object` | e.g. `{next: "15.x", react: "18.x"}` |
| `last_validated` | `string` | Last date this learning was used successfully |
| `sessions_since_validation` | `integer` | Counter — reset to 0 on validation |

### Learning Types

| Type | When to use | Risk if wrong |
|------|-------------|---------------|
| `bug-fix` | Specific bug with non-obvious root cause | Low — usually version/context specific |
| `pattern` | Recurring solution that applies broadly | Medium — wrong patterns spread |
| `anti-pattern` | Approach that fails in this context | High — blocks valid solutions if stale |
| `preference` | User coding style or workflow preference | Low — stable over time |
| `negative` | What NOT to do and why | High — must always start at confidence: 1 |

---

## Validation Rules

The `capture-learning` skill enforces these rules before writing. Every rule must pass.

| Rule | Condition | Action on failure |
|------|-----------|------------------|
| 1 | `context`, `problem`, `solution`, `reason` all non-empty | REJECT |
| 2 | `tags` has between 2 and 5 items | REJECT |
| 3 | `problem` and `solution` contain no absolute file paths | REJECT |
| 4 | `solution` is at least 10 words | REJECT |
| 5 | `reason` is present and explains WHY | REJECT |
| 6 | If `type: negative`, then `confidence` must be 1 | REJECT |
| 7 | Tags overlap ≥ 2 with existing learnings | WARN — trigger contradiction check |

### Granularity Standard

```
Too specific (REJECTED):
  problem: "In src/app/auth/session.ts line 47, getServerSession returns null"
  Reason: contains file path → not reusable

Too generic (REJECTED):
  solution: "Handle errors properly"
  Reason: fewer than 10 words, not actionable

Correct level (ACCEPTED):
  context: "In Next.js 15 App Router with next-intl..."
  problem: "useTranslations() in a Server Component throws a runtime error"
  solution: "Use await getTranslations() in Server Components..."
  reason: "getTranslations() is the async Server-safe API..."
```

---

## Confidence System

### Scale

| Confidence | Meaning | How treated |
|------------|---------|-------------|
| 1–2 | Tentative — captured once | Loaded as suggestion, not rule |
| 3–5 | Validated — confirmed in real use | Reliable pattern |
| 6–8 | Established — consistent track record | High trust |
| 9–10 | Canonical — foundational pattern | Maximum trust |

### Confidence Changes

| Event | Change |
|-------|--------|
| Learning captured | Set to `1` (always) |
| Human seed with pre-validation | Can be set to `3` |
| Successfully used in a session | `+1` (max 10) |
| Pattern failed / user corrected | `-2` |
| 5+ sessions without use (if confidence > 1) | `-1` |

### Status Transitions

```
active (confidence 1+)
  → pending-review  (sessions_since_validation >= 15)
  → deprecated      (sessions_since_validation >= 30)

pending-review
  → active          (human approves)
  → deprecated      (human rejects)

deprecated
  → active          (human re-validates — rare)
```

---

## Skill Interfaces

### `capture-learning`

Writes a new validated learning to the appropriate `learnings.md` file.

**Invocation:** user-invocable or called by `post-session-review`

**Inputs (conversational):**
- Description of what was learned
- Context: which project, which technology, what situation

**Process:**
1. Determine target skill based on learning domain
2. Draft learning with all required fields
3. Run validation (all 7 rules)
4. Check for contradictions (tags overlap ≥ 2)
5. Write between `<!-- LEARNINGS START -->` and `<!-- LEARNINGS END -->`
6. Re-index skills graph

**Output:**
```
✅ Learning captured: L-{skill}-{NNN}
   Type: {type} | Confidence: 1 | Scope: {scope}
   Tags: {tags}
   File: {skill}/learnings.md
```

**Multi-agent safety:**  
When running as a subagent, writes to `.agents/skills/_pending/learning-{date}-{random}.yml` instead of directly to `learnings.md`. Parent agent merges via `post-session-review`.

---

### `load-learnings`

Loads the most relevant learnings for the current session.

**Invocation:** called automatically by `gitnexus-context` — not user-invocable

**Hard cap:** 15 learnings maximum per session

**Scoring formula:**
```
score = (confidence × 2)
      + (3 if scope=global OR project matches current project)
      + (2 if last_validated within 5 sessions)
      + (2 if skill matches an active skill for this session)
```

**Filters applied (in order):**
1. EXCLUDE `status: deprecated`
2. EXCLUDE `status: pending-review` (unless no better options)
3. EXCLUDE project-specific learnings from other projects
4. SORT by score descending
5. TAKE top 15

**Fields loaded per learning:**
- `context`, `problem`, `solution` — the actionable content
- `confidence` — as trust signal for the AI

**Fields NOT loaded:**
- `id`, `dates`, `validated_by`, tracking fields — metadata only

**Output:**
```
📚 Loaded 12 learnings for this session:
   🌐 Global (5): next-intl routing, payload auth...
   📁 Project-specific (4): Quickfy API patterns...
   🎯 Skill-specific (3): debugging patterns...

   Highest confidence: L-debug-007 (confidence: 8)
   ⚠️ Tentative (confidence ≤ 2): 2 — treated as suggestions
```

---

### `post-session-review`

Mandatory end-of-session audit. Triggered by session-ending phrases.

**Trigger phrases:** `"ho finito"`, `"basta per oggi"`, `"fine sessione"`, `"ultimo commit"`, etc.

**Phases:**

| Phase | What happens | Duration |
|-------|-------------|---------|
| 1. Session audit | Checks for uncaptured learnings | ~2 min |
| 2. Merge pending | Merges subagent temp files | ~1 min |
| 3. Confidence decay | Updates scores for all active learnings | ~1 min |
| 4. Version check | Flags version-sensitive learnings | ~30 sec |
| 5. Promotion scan | Identifies global promotion candidates | ~30 sec |
| 6. Update review queue | Appends to `pending-review.md` | ~30 sec |
| 7. Re-index | Runs `gitnexus analyze .agents/skills --skip-git` | ~3 sec |

**Output:**
```
📋 Post-session review complete
   ✅ New learnings captured: 2
   🔄 Confidence updated: 8 learnings
   ⏰ Decay applied: 1 learning (sessions_since_validation >= 5)
   📤 Promotion candidates: 1 (see pending-review.md)
   🔍 Skills index: re-indexed (1,674 nodes)
   📝 Pending review: 3 items
```

---

### `gitnexus-context`

Loads the code knowledge graph for a project and then calls `load-learnings`.

**Trigger phrases:** `"lavora su X"`, `"work on X"`, `"modifica X"`, `"fix in X"`, any project reference

**Steps:**
1. Identify project path
2. Check if indexed (`gitnexus list`)
3. If not indexed → `gitnexus analyze /path --skip-git`
4. Verify freshness (compare `lastCommit` vs `git rev-parse HEAD`)
5. If stale → re-analyze
6. Run initial graph query for orientation
7. **Call `load-learnings`** with project + task context
8. Confirm readiness

**Output:**
```
✅ Contesto GitNexus caricato per Quickfy-website
   📊 711 nodi | 1275 relazioni | 41 flussi
   🕐 Indice aggiornato al: 2025-01-20
   📚 12 learnings caricati

Pronto a lavorare con piena consapevolezza del codice.
```

---

## Promotion Rules

### Promotion Trigger

A learning becomes a promotion candidate when:
- `scope: project-specific`
- Same pattern validated in 2+ different projects
- `confidence >= 4`

### Promotion Process

1. `post-session-review` detects the candidate
2. Adds to `pending-review.md` with summary
3. User reviews and says **approve** or **reject**
4. On approval: `scope` changes to `global`, `project` changes to `global`
5. On rejection: learning stays project-specific

**Promotion is never automatic.** Always requires explicit human approval.

---

## Contradiction Resolution

### Detection

When `capture-learning` receives a new learning, it searches for existing learnings with ≥ 2 matching tags. If found, it surfaces the conflict:

```
⚠️ CONFLICT DETECTED
New:      "Use fetch directly for API calls" [tags: fetch, api, client]
Existing: L-next-018 "Use useFetch custom hook" — confidence: 5

A) New supersedes old → set supersedes/superseded_by
B) Both valid, different scope → restrict one to project-specific
C) Cancel new learning
```

### Resolution options

**A — Supersede:** The new learning replaces the old one.
- Old learning: `superseded_by: "L-next-022"`, `status: deprecated`
- New learning: `supersedes: "L-next-018"`

**B — Different scope:** Both are valid in different contexts.
- Example: one is `scope: global`, the other is `scope: project-specific`
- No status change, both remain `active`

**C — Cancel:** The new learning was wrong or redundant.

The system never auto-resolves. A human decision is always required.

---

## File Format: learnings.md

Each skill's `learnings.md` follows this structure:

```markdown
# Learnings — {skill-name}

> Auto-maintained by `capture-learning` and `post-session-review`.
> Do NOT edit manually. Schema: `_schema/learning-template.yml`

<!-- LEARNINGS START -->

## Learning L-{skill}-001
id: "L-{skill}-001"
date: "YYYY-MM-DD"
type: "bug-fix"
status: "active"
project: "global"
scope: "global"
tags: [tag1, tag2]
confidence: 3
context: "In [technology], when [situation]..."
problem: "..."
solution: "..."
reason: "..."
validated_by: ["YYYY-MM-DD"]
created_in: "YYYY-MM-DD"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

## Learning L-{skill}-002
...

<!-- LEARNINGS END -->
```

**Rules:**
- Do not edit manually
- Never remove the `<!-- LEARNINGS START -->` and `<!-- LEARNINGS END -->` markers
- Each learning starts with `## Learning L-{id}`
- Deprecated learnings remain in the file (historical record) but are never loaded

---

## GitNexus Integration

The skills folder is indexed as a GitNexus repo named `skills`:

```bash
gitnexus analyze .agents/skills --skip-git
```

This creates a structural knowledge graph of all skills and learnings (1,674+ nodes).

### Query the skills graph

```
gitnexus_query(
  query: "next-intl middleware routing pattern",
  repo: "skills",
  limit: 10
)
```

Returns learnings and skill files semantically related to the query.

### Note on `--embeddings` flag

The `--embeddings` flag crashes during `analyze` on macOS (known GitNexus bug — threading issue in native binary). **Do not use it.** Embeddings load automatically at query time:

```
GitNexus: Loading embedding model (first search may take a moment)...
GitNexus: Embedding model loaded (cpu)
```

Semantic search works correctly without `--embeddings` during indexing.

---

## Environment

| Component | Requirement |
|-----------|------------|
| GitNexus CLI | `npm install -g gitnexus` |
| Claude Code | Latest version |
| Node.js | ≥ 18 |
| Git | For project indexing (not required for skills folder) |

---

*See `README.md` for setup, quickstart, and architecture overview.*
