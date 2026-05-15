#!/usr/bin/env bash
# PostToolUse hook for the Skill tool.
# Reads {session_id, tool_name, tool_input, ...} JSON from stdin and records
# the skill invocation as `applied` in the nearest .codegraph/graph.db so
# skill_health / skill_route ranking can see real apply signal.
#
# Silent on all paths (stdout becomes a system message in the transcript).
# Stderr is suppressed in production; uncomment the trap line below to debug.

set -u

# Read JSON event from stdin
EVENT=$(cat)

# Extract fields with python (preinstalled on macOS) — handles JSON safely.
read -r TOOL SKILL SESSION CWD < <(
    printf '%s' "$EVENT" | python3 -c "
import sys, json
try:
    e = json.load(sys.stdin)
except Exception:
    print('', '', '', '')
    sys.exit(0)
tool = e.get('tool_name') or ''
skill = (e.get('tool_input') or {}).get('skill') or ''
session = e.get('session_id') or ''
cwd = e.get('cwd') or ''
print(tool, skill, session, cwd)
" 2>/dev/null
)

[ "$TOOL" = "Skill" ] || exit 0
[ -n "$SKILL" ] || exit 0

# Walk up from CWD (or pwd) to find .codegraph/graph.db
START_DIR="${CWD:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
DB=""
DIR="$START_DIR"
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16; do
    if [ -f "$DIR/.codegraph/graph.db" ]; then
        DB="$DIR/.codegraph/graph.db"
        break
    fi
    PARENT=$(dirname "$DIR")
    [ "$PARENT" = "$DIR" ] && break
    DIR="$PARENT"
done

[ -n "$DB" ] || exit 0

# Escape single quotes for SQL literal
SKILL_ESC=${SKILL//\'/\'\'}
SESSION_ESC=${SESSION//\'/\'\'}
PROJECT_ESC=$(basename "$START_DIR" | sed "s/'/''/g")

sqlite3 "$DB" <<SQL 2>/dev/null || true
INSERT INTO skill_usage (skill_name, session_id, project, action, ts)
VALUES ('$SKILL_ESC', '$SESSION_ESC', '$PROJECT_ESC', 'applied', datetime('now'));
SQL

exit 0
