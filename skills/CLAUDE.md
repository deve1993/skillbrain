<!-- codegraph:start -->
# CodeGraph — Code Intelligence

This project is indexed by CodeGraph as **skills** (1692 symbols, 1826 relationships, 17 execution flows). Use the CodeGraph MCP tools to understand code, assess impact, and navigate safely.

> If any CodeGraph tool warns the index is stale, run `node packages/codegraph/dist/cli.js analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `codegraph_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `codegraph_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `codegraph_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `codegraph_context({name: "symbolName"})`.

## When Debugging

1. `codegraph_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `codegraph_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ codegraph://repo/skills/process/{processName}` — trace the full execution flow step by step
4. For regressions: `codegraph_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `codegraph_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `codegraph_context({name: "target"})` to see all incoming/outgoing refs, then `codegraph_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `codegraph_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `codegraph_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `codegraph_rename` which understands the call graph.
- NEVER commit changes without running `codegraph_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `codegraph_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `codegraph_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `codegraph_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `codegraph_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `codegraph_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `codegraph_cypher({query: "SELECT ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `codegraph://repo/skills/context` | Codebase overview, check index freshness |
| `codegraph://repo/skills/clusters` | All functional areas |
| `codegraph://repo/skills/processes` | All execution flows |
| `codegraph://repo/skills/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `codegraph_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `codegraph_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the CodeGraph index becomes stale. Re-run analyze to update it:

```bash
node packages/codegraph/dist/cli.js analyze
```

For a full re-index (ignoring incremental cache):

```bash
node packages/codegraph/dist/cli.js analyze --force
```

To check index freshness vs git HEAD:

```bash
node packages/codegraph/dist/cli.js status
```

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

```bash
node packages/codegraph/dist/cli.js analyze [path]   # Index a repo
node packages/codegraph/dist/cli.js analyze --force   # Full re-index
node packages/codegraph/dist/cli.js status [path]     # Check freshness
node packages/codegraph/dist/cli.js list              # Show all indexed repos
node packages/codegraph/dist/cli.js clean [path]      # Remove index
node packages/codegraph/dist/cli.js mcp               # Start MCP server
```

<!-- codegraph:end -->
