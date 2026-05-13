---
name: post-session-review
description: >
  MANDATORY at the end of every coding session where code was written or modified.
  Auto-captures learnings from session, applies Memory Graph decay, merges
  subagent pending files, and re-indexes.
  Triggers: "ho finito", "basta per oggi", "fine sessione", "ultimo commit",
  any signal the session is ending.
version: 2.0.0
user-invocable: true
argument-hint: "avvia la review di fine sessione"
---

# Post-Session Review — MANDATORY (v2 — Memory Graph)

This skill MUST run at the end of every coding session. No exceptions.

## Protocol

### Phase 1 — Auto-Capture (NEW — inspired by Spacebot)

Reflect on the session and auto-propose learnings. For each YES, use `memory_add`:

1. Did I make a mistake that took 2+ attempts to fix?
2. Did the user correct my approach?
3. Did I find a non-obvious solution?
4. Did I discover a framework or library quirk?

For each, draft the memory and **propose before saving** ("agent proposes, you decide"):

```
💡 PROPOSED MEMORY:
   Type: BugFix
   Context: "In Next.js 15 App Router, when using server actions with cookies..."
   Problem: "Cookies not forwarded to Payload CMS Local API"
   Solution: "Use headers() from next/headers and pass to Payload's local API call..."
   Reason: "Server Actions run in a different request context than RSC..."
   Tags: [next-js, server-actions, payload-cms, cookies]

   Save? [Y/n]
```

If user approves (or doesn't object), save via:

```
memory_add({
  type: "BugFix",
  context: "...",
  problem: "...",
  solution: "...",
  reason: "...",
  tags: ["next-js", "server-actions", "payload-cms", "cookies"],
  confidence: 1,
  skill: "next-best-practices",
  repo: "skillbrain"
})
```

### Phase 2 — Merge pending subagent learnings

```bash
ls ".agents/skills/_pending/" 2>/dev/null
```

For each `.yml` file found:
1. Read and validate
2. Use `memory_add` to save to Memory Graph
3. Delete the temp file

### Phase 3 — Memory Graph decay

Collect IDs of memories that were used/confirmed this session, then:

```
memory_decay({
  validatedIds: ["M-pattern-xxx", "M-bugfix-yyy", ...],
  sessionDate: "{today YYYY-MM-DD}",
  repo: "skillbrain"
})
```

This automatically:
- Reinforces validated memories (confidence +1, cap 10)
- Increments `sessions_since_validation` for unused memories
- Applies decay: confidence -1 after 5 unused sessions
- Marks as `pending-review` after 15 unused sessions
- Marks as `deprecated` after 30 unused sessions

### Phase 4 — Contradiction review

```
memory_stats({ repo: "skillbrain" })
```

If `activeContradictions > 0`, surface them to the user:

```
⚠️ Active contradictions in Memory Graph:
   M-xxx vs M-yyy: "{reason}"
   → Resolve: which is correct?
```

### Phase 5 — Version check

If current project has a `package.json`, query memories with `valid_until_version` set:

```
memory_query({
  status: "active",
  repo: "skillbrain"
})
```

For each memory with `validUntilVersion`: compare against current `package.json`.
If major version differs → update to `pending-review` status.

### Phase 6 — Promotion candidates

Find project-specific memories with high confidence:

```
memory_query({
  scope: "project-specific",
  minConfidence: 4,
  repo: "skillbrain"
})
```

For each: check if the same pattern was validated in other projects.
If yes → propose promotion to `global` scope.

### Phase 7 — Re-index skills

```bash
node packages/codegraph/dist/cli.js analyze ".agents/skills" --skip-git 2>&1 | tail -3
```

### Phase 8 — Notifica n8n

```bash
bash ~/.config/skillbrain/notify.sh
```

### Phase 9 — Summary

```
📋 Post-session review complete
   💡 Auto-captured: N memories (proposed to user)
   ✅ Saved: N new memories
   🔄 Reinforced: N memories
   ⏰ Decayed: N memories
   ⚠️ Contradictions: N active
   📤 Promotion candidates: N
   🔍 Skills index: re-indexed
   📬 Notifica: Telegram + email
```
