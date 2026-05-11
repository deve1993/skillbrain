# Think Modes — Design Spec
**Date:** 2026-04-30
**Status:** Approved

---

## Overview

Two reasoning modes toggled by a single keybinding (`Ctrl+Q`) that cycles through states, similar to how `Shift+Tab` cycles permission modes.

```
off → think_light → think_PRD → off → ...
```

---

## Modes

### think_light
Free-form deep reasoning with Opus. No structured process.

- **Model:** Claude Opus (switches dynamically)
- **Behavior:** Claude only reasons, analyzes, plans — no code execution, no file writes
- **Injected via:** `UserPromptSubmit` hook — system message that restricts to reasoning only
- **Output:** Free-form reasoning, no mandatory document

### think_PRD
Structured discovery interview following the `domain-discovery` process, producing a project spec file.

- **Model:** Claude Opus (switches dynamically)
- **Behavior:** Claude follows the full domain-discovery flow:
  - STEP -1: Semantic grounding (if ambiguous input)
  - STEP 0: User level + depth
  - STEP 1: Silent research + confirmation
  - STEP 2: Domain detection + confirmation
  - STEP 3: Sequential pillar questions (grouped, max 3 per call)
  - STEP 4: Tech questions (if digital project)
  - STEP 5: Summary + write `{slug}-YYYY-MM-DD.md`
- **Source:** `/Users/dan/Desktop/domain-discovery/` (SKILL.md + core/ + pillars/ + templates/)
- **Output:** One `{slug}.md` spec file written to current project directory
- **Minimum:** 10 questions before writing the file (gate enforced)

---

## Keybinding

| Key | Action |
|-----|--------|
| `Ctrl+Q` | Cycle: `off → think_light → think_PRD → off` |

Implemented via `~/.claude/keybindings.json`.

---

## State Management

State stored in `~/.claude/state/think-mode.json`:

```json
{
  "mode": "off" | "think_light" | "think_PRD",
  "previous_model": "claude-sonnet-4-6"
}
```

Toggle script: `~/.config/skillbrain/think-toggle.sh`
- Reads current state
- Advances to next mode
- When activating: saves current model, switches `model` in `~/.claude/settings.json` to `claude-opus-4-6`
- When deactivating (back to `off`): restores previous model

---

## Status Line

Segment added to `~/.config/skillbrain/statusline.sh`:

```
# When off:
MASTER_Fullstack session (main) | Sonnet 4.6 | ctx:12%

# When think_light:
MASTER_Fullstack session (main) | Opus 4.6 | ctx:12% | think_light: on

# When think_PRD:
MASTER_Fullstack session (main) | Opus 4.6 | ctx:12% | think_PRD: on
```

The segment is hidden when mode is `off`.

---

## Hook — UserPromptSubmit

A `UserPromptSubmit` hook reads the state file and injects a system message:

**think_light injection:**
```
[THINK LIGHT MODE] You are in pure reasoning mode. Do not execute code, write files, or run commands. Only analyze, reason, and plan. Be thorough and think deeply before responding.
```

**think_PRD injection:**
```
[THINK PRD MODE] You are a conversational discovery agent following the domain-discovery process. Load and follow the full flow from /Users/dan/Desktop/domain-discovery/core/flow.md. Do not build anything. Interview the user and write ONE project spec .md file at the end.
```

---

## File Changes

| File | Change |
|------|--------|
| `~/.claude/keybindings.json` | Add `Ctrl+Q` → run toggle script |
| `~/.config/skillbrain/think-toggle.sh` | New — cycles mode, updates settings.json model |
| `~/.claude/state/think-mode.json` | New — persists current mode + previous model |
| `~/.config/skillbrain/statusline.sh` | Add think mode segment |
| `~/.claude/settings.json` | Add `UserPromptSubmit` hook |

---

## Constraints

- Model switch takes effect on the **next** request in the current session (no restart needed — Claude Code re-reads settings.json per request)
- `domain-discovery` pillar files are read from disk at `/Users/dan/Desktop/domain-discovery/` — path is hardcoded in the injected system message
- State file is global (not per-project) — one active mode at a time across all sessions
