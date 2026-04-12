
## Task 12: Per-Skill Email Notification (2026-04-05)

### Pattern: Fallback Chain for Optional Configuration
When a feature can be configured at multiple levels (skill-level, global env var), use a fallback chain:
```typescript
const value = skillConfig?.emailTo ?? process.env['NOTIFY_EMAIL'];
if (!value) {
  console.warn('No configuration found — skipping feature');
  return;
}
```

This pattern:
- Prioritizes skill-specific config
- Falls back to global config
- Gracefully skips if both are missing (no crash)
- Logs a warning for debugging

### Pattern: Partial<T> for Optional Data
When passing data that may have missing fields, use `Partial<T>` instead of `T`:
```typescript
// ❌ Wrong: requires all fields
function process(lead: Lead) { }

// ✅ Right: allows missing fields
function process(lead: Partial<Lead>) { }
```

This is especially useful when:
- Data is being collected incrementally
- Some fields are optional
- The function handles missing values gracefully

### Pattern: Optional Parameters with Defaults
When a function parameter is optional, provide sensible defaults:
```typescript
const skillName = skillConfig?.name ?? 'Lead Qualifier';
const leadName = lead.name ?? 'Unknown';
```

This ensures:
- No undefined values in output
- Graceful degradation
- Clear fallback behavior

### TypeScript Strict Mode
All changes passed `npx tsc --noEmit` with zero errors:
- Type signatures are correct
- Optional parameters properly typed
- No `any` or `@ts-ignore` needed
- Fallback logic is type-safe

### Email Subject Pattern
Include contextual information in email subjects:
```
// ❌ Generic
"New Lead: John Doe"

// ✅ Contextual
"New Lead via [skillName]: John Doe"
```

This helps with:
- Email filtering/organization
- Quick identification of source
- Multi-skill deployments
