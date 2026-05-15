#!/bin/bash
# SkillBrain — Project Auto-Detect
# Runs at SessionStart. If cwd is a git repo NOT yet registered in the projects table,
# emits a hint to register it via /project sync.
#
# Read-only. Never mutates the DB. Output is appended to the briefing as advisory text.

set -u

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Walk up from a dir until we find a marker file. Echo the dir or return 1.
find_up() {
    local marker="$1"
    local dir="$2"
    while [[ "$dir" != "/" && -n "$dir" ]]; do
        if [[ -e "$dir/$marker" ]]; then
            echo "$dir"
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    return 1
}

CODEGRAPH_ROOT="$(find_up ".codegraph/graph.db" "$PROJECT_ROOT" 2>/dev/null || true)"
GIT_ROOT="$(find_up ".git" "$PROJECT_ROOT" 2>/dev/null || true)"

# No registry → nothing to do
[[ -z "$CODEGRAPH_ROOT" ]] && exit 0
# Not a git repo → nothing to register
[[ -z "$GIT_ROOT" ]] && exit 0
# cwd IS the registry root itself → it's the monorepo workspace, not a "project"
[[ "$GIT_ROOT" == "$CODEGRAPH_ROOT" ]] && exit 0

DB="$CODEGRAPH_ROOT/.codegraph/graph.db"
command -v sqlite3 >/dev/null 2>&1 || exit 0

# Escape single quotes for SQL literal
ESCAPED_PATH="${GIT_ROOT//\'/\'\'}"
COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM projects WHERE workspace_path = '$ESCAPED_PATH';" 2>/dev/null || echo "0")

if [[ "$COUNT" == "0" ]]; then
    REPO_NAME="$(basename "$GIT_ROOT")"
    echo ""
    echo "### 🆕 Unregistered Workspace"
    echo ""
    echo "Current directory \`$GIT_ROOT\` is a git repo but is **not** in the Synapse projects registry."
    echo ""
    echo "To register: run \`/project sync $GIT_ROOT\` (auto-detects stack, repo, env vars) or \`/project add $REPO_NAME\` for manual entry."
fi
