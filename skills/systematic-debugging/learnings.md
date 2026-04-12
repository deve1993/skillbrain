# Learnings

> Auto-maintained by `capture-learning` and `post-session-review`.
> Do NOT edit manually. Schema: `_schema/learning-template.yml`

<!-- LEARNINGS START -->

## Learning L-debug-001
id: "L-debug-001"
date: "2026-04-10"
type: "pattern"
status: "active"
project: "global"
scope: "global"
tags: [payload-cms, typescript, types, collections]
confidence: 3
context: "In Next.js projects with Payload CMS 3.0, when using Payload-generated TypeScript types"
problem: "TypeScript errors after adding or modifying a Payload collection field, even though the runtime data is correct. Generated types are stale."
solution: "Run 'npx payload generate:types' to regenerate the TypeScript types from the current Payload config. Import generated types from '@/types/payload' not from the payload package directly."
reason: "Payload 3.0 generates types from your collection config at build/generate time. Modifying a collection does not auto-regenerate types — they must be explicitly regenerated"
validated_by: ["cold-start-2026-04-10"]
created_in: "cold-start-2026-04-10"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

## Learning L-debug-002
id: "L-debug-002"
date: "2026-04-10"
type: "anti-pattern"
status: "active"
project: "global"
scope: "global"
tags: [next.js, app-router, subagent, context]
confidence: 3
context: "When dispatching subagents to work on a Next.js project, when passing project context"
problem: "Subagents dispatched without the GitNexus repo name make generic assumptions about the codebase structure and miss project-specific patterns"
solution: "Always include the exact repo name in the subagent prompt: 'This project is indexed in GitNexus as {repo-name}. Use gitnexus_query and gitnexus_context to understand the codebase before making changes.'"
reason: "Without the repo name, subagents cannot use the knowledge graph and fall back to file exploration which is slower, less accurate, and misses call graph relationships"
validated_by: ["cold-start-2026-04-10"]
created_in: "cold-start-2026-04-10"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

<!-- LEARNINGS END -->
