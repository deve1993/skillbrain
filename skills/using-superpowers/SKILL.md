---
name: using-superpowers
description: >
  Use when starting any conversation — establishes how to find and use skills,
  requiring Skill tool invocation before ANY response including clarifying questions.
  Use when asking "which skills apply here?", before any task, or when unsure
  whether a skill exists for the current situation.
version: 1.0.0
---

> **Mandatory:** If there is even a 1% chance a skill might apply to what you are doing, invoke the skill.
>
> When a skill applies to your task, using it is not optional — follow it directly.
> This applies before every response, action, or clarifying question.

## How to Access Skills

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you—follow it directly. Never use the Read tool on skill files.

**In other environments:** Check your platform's documentation for how skills are loaded.

# Using Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "About to EnterPlanMode?" [shape=doublecircle];
    "Already brainstormed?" [shape=diamond];
    "Invoke brainstorming skill" [shape=box];
    "Might any skill apply?" [shape=diamond];
    "Invoke Skill tool" [shape=box];
    "Announce: 'Using [skill] to [purpose]'" [shape=box];
    "Has checklist?" [shape=diamond];
    "Create TodoWrite todo per item" [shape=box];
    "Follow skill exactly" [shape=box];
    "Respond (including clarifications)" [shape=doublecircle];

    "About to EnterPlanMode?" -> "Already brainstormed?";
    "Already brainstormed?" -> "Invoke brainstorming skill" [label="no"];
    "Already brainstormed?" -> "Might any skill apply?" [label="yes"];
    "Invoke brainstorming skill" -> "Might any skill apply?";

    "User message received" -> "Might any skill apply?";
    "Might any skill apply?" -> "Invoke Skill tool" [label="yes, even 1%"];
    "Might any skill apply?" -> "Respond (including clarifications)" [label="definitely not"];
    "Invoke Skill tool" -> "Announce: 'Using [skill] to [purpose]'";
    "Announce: 'Using [skill] to [purpose]'" -> "Has checklist?";
    "Has checklist?" -> "Create TodoWrite todo per item" [label="yes"];
    "Has checklist?" -> "Follow skill exactly" [label="no"];
    "Create TodoWrite todo per item" -> "Follow skill exactly";
}
```

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

## Session Start Protocol

**When any message implies working on a specific project or codebase**, invoke `gitnexus-context` BEFORE anything else — before reading files, before exploring, before planning.

Triggers (invoke immediately, no exceptions):
- "lavora su X" / "work on X"
- "modifica X" / "aggiungi feature a X" / "fix in X"
- Any message that names a project folder or repo
- Any coding request where the target project is clear

```
User names a project → gitnexus-context FIRST → then other skills → then work
```

**Why this is non-negotiable:** without the knowledge graph, every code change is a guess. The graph loads in seconds. Skipping it costs hours.

## Skill Priority

When multiple skills could apply, use this order:

1. **Context first** (gitnexus-context) - load the knowledge graph before touching code
2. **Process skills second** (brainstorming, debugging) - these determine HOW to approach the task
3. **Implementation skills third** (frontend-design, mcp-builder) - these guide execution

"Let's build X" → gitnexus-context, then brainstorming, then implementation skills.
"Fix this bug" → gitnexus-context, then debugging, then domain-specific skills.

## Session End Protocol

**At the end of every coding session**, invoke `post-session-review`. Non-negotiable.
Without it, learnings are lost and confidence decay is not tracked.

Triggers (invoke before closing):
- "ho finito" / "basta per oggi" / "fine sessione"
- "ultimo commit" / "commit finale"
- Any signal the coding session is ending

```
User ending session → post-session-review ALWAYS → then close
```

## Skill Types

**Rigid** (TDD, debugging): Follow exactly. Don't adapt away discipline.

**Flexible** (patterns): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.
