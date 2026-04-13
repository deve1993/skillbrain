---
name: load-learnings
description: >
  Loads the most relevant learnings at session start using semantic search
  via CodeGraph. Hard cap of 15 learnings to protect context window.
  Called automatically by codegraph-context after loading the knowledge graph.
  Do not invoke manually — codegraph-context handles this.
version: 1.0.0
user-invocable: false
---

# Load Learnings

**Hard cap: 15 learnings per session. No exceptions.**

## Protocol

### Step 1 — Semantic query (dual-source)

Skills live in **two locations**:
- `.agents/skills/` — lifecycle, process, quality skills (indexed as `skills` in CodeGraph)
- `.opencode/skill/` — SEO, payments, auth, marketing, CMS, etc. (OpenCode plugin skills)

**Source A — CodeGraph semantic search** (`.agents/skills/`):

```
codegraph_query(
  query: "{current task description in natural language}",
  repo: "skills",
  limit: 20
)
```

**Source B — Direct grep on high-confidence learnings** (`.opencode/skill/`):

```bash
grep -r "confidence: [4-9]\|confidence: 10" \
  ".opencode/skill/*/learnings.md" \
  -A 5 -B 10 2>/dev/null | grep -E "problem:|solution:|context:" | head -30
```

Or for task-specific: search by relevant tags:

```bash
grep -rl "tags:.*{tag}" .opencode/skill/*/learnings.md 2>/dev/null | \
  xargs grep -h "problem:\|solution:\|confidence:" 2>/dev/null | head -20
```

Merge results from both sources before scoring.

### Step 2 — Score and filter

For each result, calculate:

```
score = (confidence × 2)
      + (3 if scope=global OR project matches current project)
      + (2 if last_validated within 5 sessions)
      + (2 if learning belongs to an active skill for this session)
```

Then apply filters in order:
1. EXCLUDE `status: deprecated`
2. EXCLUDE `status: pending-review` unless no better options exist
3. EXCLUDE project-specific learnings from other projects
4. SORT by score descending
5. TAKE top 15

### Step 3 — Load into context

For each selected learning, load ONLY these fields:
- `context`
- `problem`
- `solution`
- `confidence` (as trust signal: 1-3 = tentative, 4-7 = reliable, 8-10 = established)

Do NOT load: id, dates, validated_by, relationships, decay fields.
This minimizes context window usage.

### Step 4 — Present summary

```
📚 Loaded {N} learnings for this session:
   🌐 Global ({N}): {brief tag summary}
   📁 Project-specific ({N}): {project name}
   🎯 Skill-specific ({N}): {skill names}

   Highest confidence: L-{id} (confidence: {N})
   Most recent: L-{id} (captured {date})
   
   ⚠️ Tentative (confidence ≤ 2): {N} — treat as suggestions, not rules
```

## When to reload mid-session

- Session shifts significantly from debugging to UI work → reload with new focus
- Project switches → full reload
- Do NOT reload for every small task change — only major context shifts
