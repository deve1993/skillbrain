# /review

Code review approfondita su file, cartelle o changeset.

## Uso
```
/review src/components/Button.tsx
/review src/lib/
/review gli ultimi commit
/review PR #123
```

## Workflow
1. @code-reviewer → TypeScript, logica, performance, security, naming, struttura
2. @accessibility-specialist (se UI) → WCAG compliance
3. @test-engineer (se --with-tests) → coverage e suggerimenti

## Opzioni
- `--focus=security|performance|types|a11y`
- `--with-tests` — includi suggerimenti test

## Output
Report con: summary, issues per severità (critical/warning/suggestion), best practices checklist, action items prioritizzati.

## Note
- Non modifica codice, fornisce fix suggeriti
- Supporta git diff, staged changes, PR via GitHub
