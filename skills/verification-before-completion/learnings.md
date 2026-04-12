# Learnings

> Auto-maintained by `capture-learning` and `post-session-review`.
> Do NOT edit manually. Schema: `_schema/learning-template.yml`

<!-- LEARNINGS START -->

## Learning L-verify-001
id: "L-verify-001"
date: "2026-04-12"
type: "anti-pattern"
status: "active"
project: "global"
scope: "global"
tags: [verification, build, typescript, deployment, coolify]
confidence: 4
context: "Before claiming any implementation is complete, especially for deployments to Coolify"
problem: "Saying 'done' without running build leads to TypeScript errors or import issues discovered only at deploy time, causing failed deployments"
solution: "ALWAYS run 'npm run build' (or 'bun run build') locally before claiming done on Next.js changes. Check for: TS errors, missing imports, env vars not defined in build env. For Coolify deploys, also verify the Docker build config matches the project's build command."
reason: "Next.js build catches errors that TypeScript LSP misses (e.g., App Router data fetching constraints, dynamic imports, edge runtime incompatibilities)"
validated_by: ["cold-start-2026-04-12"]
created_in: "cold-start-2026-04-12"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

<!-- LEARNINGS END -->
