# Learnings

> Auto-maintained by `capture-learning` and `post-session-review`.
> Do NOT edit manually. Schema: `_schema/learning-template.yml`

<!-- LEARNINGS START -->

## Learning L-sdd-001
id: "L-sdd-001"
date: "2026-04-12"
type: "pattern"
status: "active"
project: "global"
scope: "global"
tags: [subagent, context, gitnexus, parallel, task-delegation]
confidence: 3
context: "When dispatching subagents to implement independent tasks on a codebase"
problem: "Subagents work in isolation without codebase context, make assumptions, use wrong patterns, and create inconsistencies that require fixes after merge"
solution: "Every subagent prompt MUST include: 1) repo name for GitNexus ('indexed as {repo}'), 2) exact file paths to modify, 3) interfaces/types they must conform to, 4) which existing patterns to follow (e.g., 'follow how X is done in Y file'). Never dispatch open-ended subagents on shared codebases."
reason: "Subagents receive only what's in their prompt — they have no session history, no context accumulation. Under-specified prompts produce generic solutions that clash with project patterns"
validated_by: ["cold-start-2026-04-12"]
created_in: "cold-start-2026-04-12"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

<!-- LEARNINGS END -->
