#!/bin/bash
# Skills 2.0 Eval Runner - Checks eval files exist and are valid JSON

SKILLS_DIR="$(dirname "$0")/../skill"
ERRORS=0
CHECKED=0

echo "================================================"
echo "  SKILLS 2.0 EVAL RUNNER"
echo "================================================"
echo ""

for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")
    [[ "$skill_name" == ".DS_Store" ]] && continue
    
    evals_dir="$skill_dir/evals"
    
    if [[ -d "$evals_dir" ]]; then
        CHECKED=$((CHECKED + 1))
        
        # Check trigger_evals.json
        if [[ -f "$evals_dir/trigger_evals.json" ]]; then
            if python3 -m json.tool "$evals_dir/trigger_evals.json" > /dev/null 2>&1; then
                trigger_count=$(python3 -c "import json; d=json.load(open('$evals_dir/trigger_evals.json')); print(len(d.get('should_trigger',[])+d.get('should_not_trigger',[])))" 2>/dev/null)
                echo "  ✅ $skill_name/evals/trigger_evals.json ($trigger_count test cases)"
            else
                echo "  ❌ $skill_name/evals/trigger_evals.json - INVALID JSON"
                ERRORS=$((ERRORS + 1))
            fi
        else
            echo "  ⚠️  $skill_name/evals/trigger_evals.json - MISSING"
        fi
        
        # Check evals.json
        if [[ -f "$evals_dir/evals.json" ]]; then
            if python3 -m json.tool "$evals_dir/evals.json" > /dev/null 2>&1; then
                test_count=$(python3 -c "import json; d=json.load(open('$evals_dir/evals.json')); print(len(d.get('test_cases',[])))" 2>/dev/null)
                echo "  ✅ $skill_name/evals/evals.json ($test_count test cases)"
            else
                echo "  ❌ $skill_name/evals/evals.json - INVALID JSON"
                ERRORS=$((ERRORS + 1))
            fi
        else
            echo "  ⚠️  $skill_name/evals/evals.json - MISSING"
        fi
    fi
done

echo ""
echo "================================================"
echo "  Skills con evals: $CHECKED"
if [[ $ERRORS -gt 0 ]]; then
    echo "  ❌ Errori JSON: $ERRORS"
    exit 1
else
    echo "  ✅ Tutti i file JSON validi"
fi
echo "================================================"
