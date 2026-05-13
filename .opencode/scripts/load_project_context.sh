#!/bin/bash
# SkillBrain Cortex — 5-Layer Context Assembly
# Generates a contextual briefing at session start
# Inspired by Spacebot's working memory system

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Walk up from PROJECT_ROOT to find a .codegraph/graph.db; fallback to project root.
find_codegraph_db() {
    local dir="$1"
    while [[ "$dir" != "/" && -n "$dir" ]]; do
        if [[ -f "$dir/.codegraph/graph.db" ]]; then
            echo "$dir/.codegraph/graph.db"
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    return 1
}

CODEGRAPH_DB="$(find_codegraph_db "$PROJECT_ROOT" 2>/dev/null || true)"

echo "## SkillBrain Cortex — Session Briefing"
echo ""

# ═══════════════════════════════════════════
# LAYER 1: Identity (stack versions)
# ═══════════════════════════════════════════

if [[ -f "$PROJECT_ROOT/package.json" ]]; then
    NEXT_VERSION=$(node -p "require('./package.json').dependencies?.next || require('./package.json').devDependencies?.next || 'N/A'" 2>/dev/null)
    PAYLOAD_VERSION=$(node -p "require('./package.json').dependencies?.payload || 'N/A'" 2>/dev/null)
    TS_VERSION=$(node -p "require('./package.json').devDependencies?.typescript || 'N/A'" 2>/dev/null)

    echo "### Layer 1: Stack"
    echo "- Next.js: $NEXT_VERSION"
    [[ "$PAYLOAD_VERSION" != "N/A" ]] && echo "- Payload CMS: $PAYLOAD_VERSION"
    echo "- TypeScript: $TS_VERSION"
    echo ""
fi

if [[ -f "$PROJECT_ROOT/tsconfig.json" ]]; then
    STRICT=$(python3 -c "import json; d=json.load(open('tsconfig.json')); print(d.get('compilerOptions',{}).get('strict','false'))" 2>/dev/null)
    echo "- TS strict: $STRICT"
fi

if [[ -d "$PROJECT_ROOT/src/app" ]]; then
    echo "- Router: App Router (src/app/)"
fi
echo ""

# ═══════════════════════════════════════════
# LAYER 2: Event Log (recent activity)
# ═══════════════════════════════════════════

echo "### Layer 2: Recent Activity"

if git -C "$PROJECT_ROOT" rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null)
    echo "- Branch: **$BRANCH**"
    echo ""

    echo "Last 5 commits:"
    git -C "$PROJECT_ROOT" log --oneline -5 --format="  - %h %s (%ar)" 2>/dev/null
    echo ""

    MODIFIED=$(git -C "$PROJECT_ROOT" diff --name-only 2>/dev/null | head -10)
    if [[ -n "$MODIFIED" ]]; then
        echo "Uncommitted changes:"
        echo "$MODIFIED" | while read -r f; do echo "  - $f"; done
        echo ""
    fi

    # Files changed today
    TODAY_FILES=$(git -C "$PROJECT_ROOT" diff --name-only HEAD~5 2>/dev/null | sort -u | head -10)
    if [[ -n "$TODAY_FILES" ]]; then
        echo "Recently touched files:"
        echo "$TODAY_FILES" | while read -r f; do echo "  - $f"; done
        echo ""
    fi
fi

# ═══════════════════════════════════════════
# LAYER 3: Cross-Session Activity
# ═══════════════════════════════════════════

echo "### Layer 3: Cross-Session History"

if [[ -f "$CODEGRAPH_DB" ]]; then
    SESSIONS=$(sqlite3 "$CODEGRAPH_DB" "
        SELECT session_name, started_at, summary, memories_created, memories_validated
        FROM session_log
        ORDER BY started_at DESC
        LIMIT 5
    " 2>/dev/null)

    if [[ -n "$SESSIONS" ]]; then
        echo "$SESSIONS" | while IFS='|' read -r name started summary created validated; do
            DATE=$(echo "$started" | cut -d'T' -f1)
            echo "  - **$name** ($DATE): ${summary:-no summary} [+${created} memories, ${validated} validated]"
        done
    else
        echo "  - No session history yet"
    fi
else
    echo "  - Memory Graph DB not found"
fi
echo ""

# ═══════════════════════════════════════════
# LAYER 4: Project Awareness
# ═══════════════════════════════════════════

echo "### Layer 4: Project Status"

if [[ -f "$PROJECT_ROOT/package.json" ]]; then
    # Build status
    if [[ -d "$PROJECT_ROOT/.next" ]]; then
        BUILD_TIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$PROJECT_ROOT/.next/BUILD_ID" 2>/dev/null || echo "unknown")
        echo "- Last build: $BUILD_TIME"
    fi

    # Node modules freshness
    if [[ -f "$PROJECT_ROOT/node_modules/.package-lock.json" ]]; then
        DEPS_TIME=$(stat -f "%Sm" -t "%Y-%m-%d" "$PROJECT_ROOT/node_modules/.package-lock.json" 2>/dev/null || echo "unknown")
        echo "- Dependencies installed: $DEPS_TIME"
    fi
fi

# CodeGraph index status
if [[ -f "$CODEGRAPH_DB" ]]; then
    INDEX_INFO=$(sqlite3 "$CODEGRAPH_DB" "
        SELECT
            (SELECT COUNT(*) FROM memories WHERE status='active') as active_memories,
            (SELECT COUNT(*) FROM memories WHERE status='pending-review') as pending,
            (SELECT COUNT(*) FROM memory_edges) as edges,
            (SELECT COUNT(*) FROM memories WHERE confidence >= 7) as established
    " 2>/dev/null)

    if [[ -n "$INDEX_INFO" ]]; then
        IFS='|' read -r active pending edges established <<< "$INDEX_INFO"
        echo "- Memory Graph: ${active} active, ${pending} pending review, ${edges} edges"
        [[ "$established" -gt 0 ]] && echo "- Established memories (conf>=7): $established"
    fi

    # Contradictions
    CONTRADICTIONS=$(sqlite3 "$CODEGRAPH_DB" "SELECT COUNT(*) FROM memory_edges WHERE type='Contradicts'" 2>/dev/null)
    [[ "$CONTRADICTIONS" -gt 0 ]] && echo "- ⚠️ Active contradictions: $CONTRADICTIONS"
fi
echo ""

# ═══════════════════════════════════════════
# LAYER 5: Knowledge Synthesis
# ═══════════════════════════════════════════

echo "### Layer 5: Top Memories for This Session"

if [[ -f "$CODEGRAPH_DB" ]]; then
    TOP_MEMORIES=$(sqlite3 "$CODEGRAPH_DB" "
        SELECT type, confidence, substr(context, 1, 120), skill
        FROM memories
        WHERE status = 'active'
        ORDER BY confidence DESC, updated_at DESC
        LIMIT 5
    " 2>/dev/null)

    if [[ -n "$TOP_MEMORIES" ]]; then
        echo "$TOP_MEMORIES" | while IFS='|' read -r type conf context skill; do
            echo "  - [$type conf:$conf] $context ($skill)"
        done
    else
        echo "  - No memories loaded yet. Use memory_load MCP tool for scored retrieval."
    fi
fi
echo ""

echo "---"
echo "_Use \`memory_load\` MCP tool for full scored retrieval based on current task._"
