---
name: capture-learning
description: >
  Captures a validated learning and writes it to the correct learnings.md.
  Invoke when: a bug is resolved non-obviously, a pattern is discovered,
  the user corrects a mistake, or a solution took 2+ attempts.
  Do NOT invoke for typos, obvious errors, or one-time config changes.
version: 1.0.0
user-invocable: true
argument-hint: "descrivi cosa hai imparato e in quale contesto"
---

# Capture Learning

## When to invoke

- Bug resolved with non-obvious root cause
- Pattern discovered that applies beyond this one case
- User corrected your approach
- Solution took 2+ attempts to get right
- Framework or library quirk discovered

Do NOT invoke for: typos, missing imports, obvious variable errors, one-off config.

## Protocol

### Step 1 — Choose target skill

| Domain | Target |
|--------|--------|
| Debugging, error fixing | `systematic-debugging/learnings.md` |
| Next.js, React, App Router | `next-best-practices/learnings.md` |
| GitNexus usage | `gitnexus-context/learnings.md` |
| UI, components, styling | `frontend-design/learnings.md` |
| Session/workflow patterns | `verification-before-completion/learnings.md` |
| Vercel, React performance | `vercel-react-best-practices/learnings.md` |

If uncertain: use the skill most closely related to the DOMAIN, not the activity.

### Step 2 — Draft the learning

Fill ALL required fields:

```yaml
## Learning L-{skill}-{NNN}
id: "L-{skill}-{NNN}"
date: "{today YYYY-MM-DD}"
type: "{bug-fix|pattern|anti-pattern|preference|negative}"
status: "active"
project: "{project-name or global}"
scope: "{project-specific|global}"
tags: [{tag1}, {tag2}]
confidence: 1
context: "In [technology/version], when [specific situation]..."
problem: "{what went wrong or was unclear}"
solution: "{what worked — actionable, specific}"
reason: "{WHY this works — not just what}"
validated_by: ["{session-date}"]
created_in: "{session-date}"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []
```

### Step 3 — Validate (no exceptions)

Before writing, verify ALL of these:

1. `context`, `problem`, `solution`, `reason` are filled and non-empty
2. `tags` has between 2 and 5 items
3. `problem` and `solution` contain NO absolute file paths
4. `solution` is at least 10 words and actionable
5. `reason` explains WHY (not just restates the solution)
6. If `type: negative` then `confidence` must be 1

Fix any failure before writing. Do not skip any check.

### Step 4 — Contradiction check

Search existing learnings for entries sharing 2+ tags with the new one:

```bash
grep -r "tags:" ".agents/skills/*/learnings.md" \
  | grep "{tag1}\|{tag2}"
```

If a conflict is found, surface it to the user:

```
CONFLICT DETECTED
New:      "{summary}" [tags: ...]
Existing: L-{id} "{summary}" — confidence: N

A) New supersedes old → set supersedes/superseded_by fields
B) Both valid with different scope → adjust scope
C) Cancel new learning
```

Wait for the user's decision. Never auto-resolve.

### Step 5 — Write

Calculate the next ID: count existing `## Learning` lines in the target file + 1, zero-padded to 3 digits.

Append the learning between `<!-- LEARNINGS START -->` and `<!-- LEARNINGS END -->`.

### Step 6 — Re-index skills with embeddings

```bash
gitnexus analyze .agents/skills --skip-git 2>&1 | tail -3
```

This updates the structural index. Semantic search works at query-time via the embedding model (loaded automatically on first query).

### Step 7 — Confirm

```
✅ Learning captured: L-{skill}-{NNN}
   Type: {type} | Confidence: 1 | Scope: {scope}
   Tags: {tags}
   File: {skill}/learnings.md
```

## Multi-agent safety

If running as a subagent, do NOT write directly to `learnings.md`.
Write to a temp file instead:

```
.agents/skills/_pending/learning-{date}-{random}.yml
```

The parent agent or `post-session-review` will merge these at session end.
