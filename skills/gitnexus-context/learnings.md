# Learnings

> Auto-maintained by `capture-learning` and `post-session-review`.
> Do NOT edit manually. Schema: `_schema/learning-template.yml`

<!-- LEARNINGS START -->

## Learning L-gitnexus-001
id: "L-gitnexus-001"
date: "2026-04-10"
type: "bug-fix"
status: "active"
project: "global"
scope: "global"
tags: [gitnexus, embeddings, macos, indexing]
confidence: 4
context: "In GitNexus CLI on macOS, when running gitnexus analyze with the --embeddings flag"
problem: "The process crashes after completing structural indexing with: 'libc++abi: terminating due to uncaught exception of type std::__1::system_error: mutex lock failed: Invalid argument'"
solution: "Run gitnexus analyze WITHOUT --embeddings flag. The structural index is created correctly. Embeddings load automatically at query-time via the model ('Embedding model loaded (cpu)' appears on first query)."
reason: "The --embeddings flag triggers embedding generation during the analyze phase which has a threading bug on macOS. The query-time embedding model loading works fine and provides the same semantic search capability"
validated_by: ["cold-start-2026-04-10"]
created_in: "cold-start-2026-04-10"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

## Learning L-gitnexus-002
id: "L-gitnexus-002"
date: "2026-04-10"
type: "pattern"
status: "active"
project: "global"
scope: "global"
tags: [gitnexus, indexing, non-git, skip-git]
confidence: 4
context: "In GitNexus CLI, when trying to index a project folder that has no .git directory"
problem: "Running gitnexus analyze on a folder without .git fails with 'Not a git repository'"
solution: "Add the --skip-git flag: gitnexus analyze /path/to/project --skip-git. This disables commit-tracking but creates the full knowledge graph."
reason: "GitNexus requires git by default for commit-tracking and incremental updates. --skip-git bypasses this requirement while still building the complete structural and semantic graph"
validated_by: ["cold-start-2026-04-10"]
created_in: "cold-start-2026-04-10"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

<!-- LEARNINGS END -->
