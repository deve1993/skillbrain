---
name: post-session-review
description: >
  MANDATORY at the end of every coding session where code was written or modified.
  Audits for missed learnings, applies confidence decay, merges subagent pending files,
  updates pending-review.md, and re-indexes the skills knowledge graph with embeddings.
  Triggers: "ho finito", "basta per oggi", "fine sessione", "ultimo commit",
  any signal the session is ending.
version: 1.0.0
user-invocable: true
argument-hint: "avvia la review di fine sessione"
---

# Post-Session Review — MANDATORY

This skill MUST run at the end of every coding session. No exceptions.

## Protocol

### Phase 1 — Session audit (2 min)

Look back at this session and answer each question. For every YES, invoke `capture-learning`:

1. Did I make a mistake that took 2+ attempts to fix? → `type: bug-fix`
2. Did the user correct my approach? → `type: preference` or `anti-pattern`
3. Did I find a non-obvious solution? → `type: pattern`
4. Did I discover a framework or library quirk? → `type: bug-fix`

### Phase 2 — Merge pending subagent learnings (1 min)

```bash
ls ".agents/skills/_pending/" 2>/dev/null
```

For each `.yml` file found:
1. Read the file
2. Validate against schema (`_schema/learning-template.yml`)
3. Run contradiction check (Step 4 of capture-learning)
4. If valid → append to the correct `learnings.md`
5. Delete the temp file

```bash
rm -f ".agents/skills/_pending/*.yml"
```

### Phase 3 — Confidence decay

> **Both skill locations**: apply decay to BOTH `.agents/skills/*/learnings.md` AND `.opencode/skill/*/learnings.md` (129 learnings.md total).

For each `learnings.md` with active learnings, apply these rules:

**Learnings used or confirmed this session:**
- `confidence += 1` (cap at 10)
- `last_validated: {today}`
- `sessions_since_validation: 0`
- Add current date to `validated_by`

**Learnings NOT encountered this session:**
- `sessions_since_validation += 1`

**Decay thresholds:**
- `sessions_since_validation >= 5` AND `confidence > 1` → `confidence -= 1`
- `sessions_since_validation >= 15` → `status: pending-review`
- `sessions_since_validation >= 30` → `status: deprecated`

### Phase 4 — Version check (30 sec)

If current project has a `package.json`:

```bash
grep -r "valid_until_version:" ".agents/skills/*/learnings.md" ".opencode/skill/*/learnings.md" 2>/dev/null
```

For each result: compare the versions in the learning against current `package.json`.
If any major version differs → set `status: pending-review`.

### Phase 5 — Promotion candidates (30 sec)

Find project-specific learnings with high confidence:

```bash
grep -B 20 "confidence: [4-9]\|confidence: 10" \
  ".agents/skills/*/learnings.md" \
  ".opencode/skill/*/learnings.md" \
  2>/dev/null | grep "scope: project-specific"
```

For each: check if the same pattern appears validated in another project.
If yes → add to `pending-review.md` as a promotion candidate.

### Phase 6 — Update pending-review.md

Append new items to `.agents/skills/pending-review.md` using this format:

```markdown
## {today YYYY-MM-DD}

### New Learnings (confidence 1 — needs validation)
- L-{id}: "{one-line summary}" — awaiting validation in future sessions

### Promotion Candidates
- L-{id}: project-specific → global candidate (validated in {N} projects)

### Decay Alerts
- L-{id}: {N} sessions without validation — keep or deprecate?

### Version Conflicts
- L-{id}: version mismatch on {package} — update or deprecate?
```

### Phase 7 — Re-index skills with embeddings

```bash
gitnexus analyze .agents/skills --skip-git 2>&1 | tail -3
```

This updates the structural index. Embeddings load automatically at query-time.

### Phase 8 — Notifica n8n

Invia i dati della sessione al webhook n8n (runs in background, non bloccante):

```bash
bash ~/.config/skillbrain/notify.sh
```

Questo invia a n8n il conteggio dei pending review e le stats della sessione.
n8n provvede a notificare via **Telegram** e **email** automaticamente.

### Phase 9 — Summary

Report to user:

```
📋 Post-session review complete
   ✅ New learnings captured: N
   🔄 Confidence updated: N learnings
   ⏰ Decay applied: N learnings
   📤 Promotion candidates: N
   🔍 Skills index: re-indexed
   📬 Notifica inviata via Telegram + email
   📝 Pending review: N items
```
