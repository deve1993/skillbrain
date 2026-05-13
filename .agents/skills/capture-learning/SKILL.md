---
name: capture-learning
description: >
  Captures a validated learning into the Memory Graph (SQLite).
  Invoke when: a bug is resolved non-obviously, a pattern is discovered,
  the user corrects a mistake, or a solution took 2+ attempts.
  Do NOT invoke for typos, obvious errors, or one-time config changes.
version: 2.0.0
user-invocable: true
argument-hint: "descrivi cosa hai imparato e in quale contesto"
---

# Capture Learning (v2 — Memory Graph)

## When to invoke

- Bug resolved with non-obvious root cause
- Pattern discovered that applies beyond this one case
- User corrected your approach
- Solution took 2+ attempts to get right
- Framework or library quirk discovered

Do NOT invoke for: typos, missing imports, obvious variable errors, one-off config.

## Protocol

### Step 1 — Choose memory type

| Situation | Type |
|-----------|------|
| Verified technical fact | `Fact` |
| User preference or style choice | `Preference` |
| Architectural/design decision | `Decision` |
| Reusable pattern discovered | `Pattern` |
| What NOT to do | `AntiPattern` |
| Bug with non-obvious fix | `BugFix` |
| Project/team objective | `Goal` |
| Task to complete in a future session | `Todo` |

### Step 2 — Choose associated skill

| Domain | Skill |
|--------|-------|
| Debugging, error fixing | `systematic-debugging` |
| Next.js, React, App Router | `next-best-practices` |
| CodeGraph usage | `codegraph-context` |
| UI, components, styling | `frontend-design` |
| Session/workflow patterns | `verification-before-completion` |
| Vercel, React performance | `vercel-react-best-practices` |
| Subagent patterns | `subagent-driven-development` |

### Step 3 — Validate before saving

Before writing, verify ALL of these:

1. `context` is filled: "In [technology/version], when [specific situation]..."
2. `problem` describes what went wrong or was unclear
3. `solution` is at least 10 words and actionable (no absolute file paths)
4. `reason` explains WHY (not just restates the solution)
5. `tags` has between 2 and 5 lowercase kebab-case items
6. If `type: AntiPattern` then `confidence` should start at 1

### Step 4 — Save to Memory Graph

Use the `memory_add` MCP tool:

```
memory_add({
  type: "Pattern",
  context: "In Next.js 15 App Router with next-intl, when configuring i18n...",
  problem: "Middleware ordering caused locale not to be detected",
  solution: "Place next-intl middleware before auth middleware in the chain...",
  reason: "next-intl needs to extract locale from URL before auth redirects happen",
  tags: ["next-intl", "middleware", "i18n", "next-js"],
  confidence: 1,
  importance: 5,
  scope: "global",
  skill: "next-best-practices",
  repo: "skillbrain"
})
```

The tool automatically:
- Generates a unique ID (e.g., `M-pattern-a1b2c3d4e5f6`)
- Populates full-text search index
- Detects potential contradictions with existing memories

### Step 5 — Handle contradictions

If `memory_add` reports contradictions:

```
⚠️ Potential contradiction with M-bugfix-xxx: "In Next.js..."
```

Surface to the user:

```
CONFLICT DETECTED
New:      "{summary}" [tags: ...]
Existing: M-xxx "{summary}" — confidence: N

A) New supersedes old → create Updates edge
B) Both valid with different scope → keep both
C) Cancel new memory
```

If the user chooses A:
```
memory_add_edge({
  sourceId: "M-new-xxx",
  targetId: "M-old-xxx",
  type: "Updates",
  reason: "New approach replaces previous solution"
})
```

### Step 6 — Confirm

```
✅ Memory captured: M-{type}-{id}
   Type: {type} | Confidence: 1 | Scope: {scope}
   Tags: {tags}
   Stored in: Memory Graph (SQLite)
```

### Step 7 — Create edges (optional but valuable)

If the new memory relates to existing ones:

```
memory_add_edge({sourceId: "M-new", targetId: "M-related", type: "RelatedTo"})
memory_add_edge({sourceId: "M-new", targetId: "M-cause", type: "CausedBy"})
memory_add_edge({sourceId: "M-new", targetId: "M-parent", type: "PartOf"})
```

## Edge Types

| Type | Meaning | When to use |
|------|---------|-------------|
| `RelatedTo` | Generic relation | Same domain, complementary knowledge |
| `Updates` | Supersedes/replaces | New info invalidates old |
| `Contradicts` | Conflicting info | Must be reviewed/resolved |
| `CausedBy` | Causal chain | Bug X caused by pattern Y |
| `PartOf` | Hierarchy | Detail belongs to broader decision |

## Multi-agent safety

If running as a subagent, write to temp file instead:

```
/path/.agents/skills/_pending/learning-{date}-{random}.yml
```

The parent agent or `post-session-review` will merge these via `memory_add` at session end.

## Legacy compatibility

Old learnings.md files have been migrated to the Memory Graph via:
```bash
node packages/codegraph/dist/cli.js migrate-learnings .
```

The markdown files remain as read-only backups. All new learnings go to SQLite.
