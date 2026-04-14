#!/bin/sh
# SkillBrain entrypoint — import skills on first boot, then start MCP HTTP server

DATA_DIR="${SKILLBRAIN_ROOT:-/data}"

# Check if skills are already imported
SKILL_COUNT=$(sqlite3 "$DATA_DIR/.codegraph/graph.db" "SELECT COUNT(*) FROM skills;" 2>/dev/null || echo "0")

if [ "$SKILL_COUNT" = "0" ] || [ "$SKILL_COUNT" = "" ]; then
  echo "First boot: importing skills from bundled data..."

  # Create workspace structure that import-skills expects
  mkdir -p "$DATA_DIR/.opencode" "$DATA_DIR/.agents/skills"

  # Symlink bundled data
  ln -sf /app/data/skill "$DATA_DIR/.opencode/skill"
  ln -sf /app/data/agents "$DATA_DIR/.opencode/agents"
  ln -sf /app/data/command "$DATA_DIR/.opencode/command"

  # Symlink lifecycle skills
  if [ -d /app/data/lifecycle-skills ]; then
    for d in /app/data/lifecycle-skills/*/; do
      name=$(basename "$d")
      mkdir -p "$DATA_DIR/.agents/skills/$name"
      ln -sf "$d/SKILL.md" "$DATA_DIR/.agents/skills/$name/SKILL.md" 2>/dev/null
    done
  fi

  # Run import
  node dist/cli.js import-skills "$DATA_DIR" 2>&1

  # Cleanup symlinks (data stays in SQLite)
  rm -rf "$DATA_DIR/.opencode" "$DATA_DIR/.agents"

  echo "Skills import complete."
else
  echo "Skills already loaded: $SKILL_COUNT items"
fi

# Start MCP HTTP server
exec node dist/cli.js mcp --http
