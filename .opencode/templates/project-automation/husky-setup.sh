#!/bin/bash
# Pixarts — Husky + lint-staged setup
# Run this in the project root to configure pre-commit hooks

npm install -D husky lint-staged
npx husky init

# Create pre-commit hook
cat > .husky/pre-commit << 'EOF'
npx lint-staged
EOF

echo "✅ Husky + lint-staged configurato"
echo "📝 Aggiungi la config lint-staged al package.json"
