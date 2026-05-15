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

## Learning L-debug-003
id: "L-debug-003"
date: "2026-04-12"
type: "pattern"
status: "active"
project: "global"
scope: "global"
tags: [next.js, hydration, server-components, client-components, debugging]
confidence: 3
context: "In Next.js 15 App Router, when a component renders differently on server vs client"
problem: "Hydration mismatch error: 'Warning: Prop X did not match. Server: Y Client: Z' — often happens with dates, Math.random(), localStorage reads, or window checks"
solution: "1) For dates: normalize to UTC before rendering. 2) For random values: use a stable seed or move to useEffect. 3) For browser APIs (localStorage, window): wrap in useEffect(() => {...}, []) or use a 'mounted' state guard. 4) Add suppressHydrationWarning only as absolute last resort."
reason: "React hydration requires server HTML to exactly match the first client render. Any non-deterministic or browser-only value breaks this contract and causes full re-render or warnings"
validated_by: ["cold-start-2026-04-12"]
created_in: "cold-start-2026-04-12"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

## Learning L-debug-004
id: "L-debug-004"
date: "2026-04-12"
type: "bug-fix"
status: "active"
project: "global"
scope: "global"
tags: [payload-cms, collections, access-control, tenancy]
confidence: 3
context: "In Payload CMS 3.0 multi-tenant setup, when a collection is created without explicit access control"
problem: "New collection items created by any tenant are visible to all tenants. No data isolation."
solution: "Every collection in multi-tenant Payload MUST have access control functions: read: ({req}) => ({ where: { tenant: { equals: req.user?.tenant?.id } } }), create: ({req}) => !!req.user, update/delete with same tenant check. Never skip access control for 'simple' collections."
reason: "Payload's default access is fully permissive (everyone can read/write). In multi-tenant setups this leaks data across tenants silently — no error, just wrong data"
validated_by: ["cold-start-2026-04-12"]
created_in: "cold-start-2026-04-12"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

<!-- LEARNINGS END -->
