#!/bin/bash
# Skills 2.0 Context Injection — injects live project state before skill loads

PROJECT_ROOT="$(pwd)"

echo "## Project Context (auto-injected by load_project_context.sh)"
echo ""

# Package.json info
if [[ -f "$PROJECT_ROOT/package.json" ]]; then
    NEXT_VERSION=$(node -p "require('./package.json').dependencies?.next || require('./package.json').devDependencies?.next || 'N/A'" 2>/dev/null)
    PAYLOAD_VERSION=$(node -p "require('./package.json').dependencies?.payload || 'N/A'" 2>/dev/null)
    TS_VERSION=$(node -p "require('./package.json').devDependencies?.typescript || 'N/A'" 2>/dev/null)
    
    echo "### Stack versions"
    echo "- Next.js: $NEXT_VERSION"
    echo "- Payload CMS: $PAYLOAD_VERSION"
    echo "- TypeScript: $TS_VERSION"
    echo ""
fi

# TypeScript strictness
if [[ -f "$PROJECT_ROOT/tsconfig.json" ]]; then
    STRICT=$(python3 -c "import json; d=json.load(open('tsconfig.json')); print(d.get('compilerOptions',{}).get('strict','false'))" 2>/dev/null)
    echo "### TypeScript"
    echo "- Strict mode: $STRICT"
    echo ""
fi

# Tailwind version
if [[ -f "$PROJECT_ROOT/package.json" ]]; then
    TW_VERSION=$(node -p "require('./package.json').dependencies?.tailwindcss || require('./package.json').devDependencies?.tailwindcss || 'N/A'" 2>/dev/null)
    echo "### UI"
    echo "- Tailwind CSS: $TW_VERSION"
    echo ""
fi

# Git state
if git -C "$PROJECT_ROOT" rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null)
    MODIFIED=$(git -C "$PROJECT_ROOT" diff --name-only 2>/dev/null | head -5 | tr '\n' ', ')
    echo "### Git state"
    echo "- Branch: $BRANCH"
    if [[ -n "$MODIFIED" ]]; then
        echo "- Modified: $MODIFIED"
    fi
    echo ""
fi

# Src structure hint
if [[ -d "$PROJECT_ROOT/src/app" ]]; then
    echo "### Project structure"
    echo "- App Router: YES (src/app/)"
    echo ""
fi

echo "---"
