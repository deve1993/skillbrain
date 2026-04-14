---
name: load-learnings
description: >
  Loads the most relevant memories at session start from the Memory Graph.
  Uses FTS search + scoring algorithm. Hard cap of 15 memories.
  Called automatically by codegraph-context after loading the knowledge graph.
version: 2.0.0
user-invocable: false
---

# Load Learnings (v2 — Memory Graph)

**Hard cap: 15 memories per session. No exceptions.**

## Protocol

### Step 1 — Load scored memories

Use the `memory_load` MCP tool:

```
memory_load({
  project: "{current project name}",
  activeSkills: ["next-best-practices", "systematic-debugging", ...],
  limit: 15,
  repo: "skillbrain"
})
```

The scoring algorithm calculates:

```
score = (confidence × 2)
      + (3 if scope=global OR project matches)
      + (2 if validated within 5 sessions)
      + (2 if memory belongs to active skill)
      + (importance × 0.5)
```

### Step 2 — Supplement with semantic search (optional)

If the current task has a clear focus, search for additional relevant memories:

```
memory_search({
  query: "{task description in natural language}",
  limit: 5,
  repo: "skillbrain"
})
```

Merge with scored results, dedup by ID, cap at 15.

### Step 3 — Load into context

For each selected memory, use these fields:
- `context` — when/where this applies
- `problem` — what went wrong
- `solution` — actionable fix
- `confidence` (trust signal: 1-3 = tentative, 4-7 = reliable, 8-10 = established)
- `type` — memory type (Pattern, BugFix, etc.)

### Step 4 — Present summary

The `memory_load` tool returns a formatted summary:

```
📚 Loaded {N} memories
   Pattern: {N}
   BugFix: {N}
   AntiPattern: {N}
   ...
```

Add trust indicators:

```
   ⚠️ Tentative (confidence ≤ 2): {N} — treat as suggestions, not rules
   ✅ Established (confidence ≥ 7): {N} — highly trusted
```

## When to reload mid-session

- Session shifts significantly (debugging → UI work) → reload with new focus
- Project switches → full reload with new project context
- Do NOT reload for every small task change — only major context shifts

## Fallback

If Memory Graph is unavailable (database error, etc.), fall back to grep-based search:

```bash
grep -r "confidence: [4-9]\|confidence: 10" \
  ".agents/skills/*/learnings.md" ".opencode/skill/*/learnings.md" \
  -A 5 -B 10 2>/dev/null | head -30
```
