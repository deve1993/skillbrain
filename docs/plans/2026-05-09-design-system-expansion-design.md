# Design System Studio — Expansion Design Doc

**Date:** 2026-05-09  
**Status:** Approved — ready for implementation  
**Scope:** `packages/storage` + `packages/codegraph/src/mcp` + `packages/codegraph/public/ds-studio`

---

## 1. Goal

Extend the DS Studio (the `/ds-studio/` iframe) with 7 new token categories beyond the current 4 (colors, fonts, spacing, radius). These are persisted as JSON columns on the `design_systems` table (ComponentsStore), exported/imported via the existing 7 endpoints, and surfaced in the right-panel of the iframe UI.

---

## 2. Architecture: Extended Flat JSON (Architecture A)

7 new TEXT columns with `DEFAULT '{}'` added to the existing `design_systems` table via migration `031_design_system_expand.sql`.

```sql
ALTER TABLE design_systems ADD COLUMN palette         TEXT DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN semantic_colors TEXT DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN shadows         TEXT DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN typography      TEXT DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN effects         TEXT DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN components      TEXT DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN assets          TEXT DEFAULT '{}';
```

**Rationale:** Mirrors the existing pattern (colors, fonts, spacing, radius are all JSON TEXT columns). No JOIN overhead, backwards compatible via DEFAULT '{}', SQLite ALTER TABLE is safe.

---

## 3. Data Schemas

### 3.1 `palette`
```json
{
  "brand":   { "50":"#faf5ff", "100":"#f3e8ff", ..., "900":"#4c1d95" },
  "neutral": { "50":"#f8fafc", ..., "900":"#0f172a" },
  "success": { ... },
  "warning": { ... },
  "error":   { ... },
  "info":    { ... }
}
```

### 3.2 `semantic_colors`
```json
{
  "text":     { "primary":"...", "secondary":"...", "muted":"..." },
  "bg":       { "base":"...", "surface":"...", "overlay":"..." },
  "border":   { "default":"...", "focus":"..." },
  "feedback": { "success":"...", "warning":"...", "error":"...", "info":"..." }
}
```

### 3.3 `shadows`
```json
{
  "sm":   "0 1px 2px rgba(0,0,0,0.05)",
  "md":   "0 4px 6px -1px rgba(0,0,0,0.1)",
  "lg":   "0 10px 15px -3px rgba(0,0,0,0.1)",
  "xl":   "0 20px 25px -5px rgba(0,0,0,0.1)",
  "glow": "0 0 20px rgba(167,139,250,0.4)"
}
```

### 3.4 `typography`
```json
{
  "families": { "sans":"Inter", "mono":"JetBrains Mono", "serif":"Lora" },
  "scale": {
    "xs":  { "size":"0.75rem", "leading":"1rem" },
    "sm":  { "size":"0.875rem", "leading":"1.25rem" },
    "base":{ "size":"1rem",     "leading":"1.5rem" },
    "lg":  { "size":"1.125rem", "leading":"1.75rem" },
    "xl":  { "size":"1.25rem",  "leading":"1.75rem" },
    "2xl": { "size":"1.5rem",   "leading":"2rem" },
    "3xl": { "size":"1.875rem", "leading":"2.25rem" },
    "4xl": { "size":"2.25rem",  "leading":"2.5rem" },
    "5xl": { "size":"3rem",     "leading":"1" },
    "6xl": { "size":"3.75rem",  "leading":"1" },
    "9xl": { "size":"8rem",     "leading":"1" }
  },
  "weights": { "normal":"400", "medium":"500", "semibold":"600", "bold":"700" },
  "tracking": { "tight":"-0.05em", "normal":"0", "wide":"0.05em" }
}
```

### 3.5 `effects`
```json
{
  "aurora": {
    "preset": "soft",
    "customCss": ""
  },
  "gradientBorder": {
    "preset": "purple-blue",
    "customCss": ""
  },
  "glow": {
    "preset": "purple",
    "customCss": ""
  }
}
```

### 3.6 `components`
```json
{
  "button": {
    "radius":    "0.375rem",
    "paddingX":  "1rem",
    "paddingY":  "0.5rem",
    "fontWeight":"600",
    "fontSize":  "0.875rem"
  },
  "card": {
    "radius":    "0.75rem",
    "padding":   "1.5rem",
    "shadow":    "md"
  },
  "input": {
    "radius":    "0.375rem",
    "paddingX":  "0.75rem",
    "paddingY":  "0.5rem",
    "fontSize":  "0.875rem"
  },
  "badge": {
    "radius":    "9999px",
    "paddingX":  "0.625rem",
    "paddingY":  "0.125rem",
    "fontSize":  "0.75rem",
    "fontWeight":"500"
  }
}
```

### 3.7 `assets`
```json
{
  "logoUrl":          "https://...",
  "logoWordmark":     "https://...",
  "brandImageryUrls": ["https://...", "https://..."],
  "iconLibrary":      "lucide",
  "techLogos":        ["nextjs", "typescript", "tailwind"]
}
```

---

## 4. File-by-File Changes

### 4.1 DB Migration — NEW FILE

**`packages/storage/src/migrations/031_design_system_expand.sql`**

7 `ALTER TABLE design_systems ADD COLUMN` statements (safe, backwards compatible).

### 4.2 TypeScript Types — MODIFY

**`packages/storage/src/components-store.ts`** — `DesignSystem` and `DesignSystemInput` interfaces.

> ⚠️ **Correction vs. brainstorm notes:** The brainstorm listed `studio-store.ts` but the correct file is `components-store.ts`. The `DesignSystem` type used by `ds-export.ts`, `ds-import.ts`, and the export routes is `ComponentsDesignSystem` which is the `DesignSystem` from `components-store.ts`. The `studio_design_systems` table is a separate read-only catalog and is NOT affected.

Add 7 optional fields to both interfaces:
```typescript
// DesignSystem
palette?:        Record<string, Record<string, string>>
semanticColors?: Record<string, Record<string, string>>
shadows?:        Record<string, string>
typography?:     Record<string, unknown>
effects?:        Record<string, unknown>
components?:     Record<string, Record<string, string>>
assets?:         Record<string, unknown>

// DesignSystemInput — same 7 optional fields
```

### 4.3 ComponentsStore — MODIFY

**`packages/storage/src/components-store.ts`** — `upsertDesignSystem`, INSERT, UPDATE, and `rowToDesignSystem`.

> ⚠️ **Correction vs. brainstorm notes:** The brainstorm said "non va modificato — già salva JSON arbitrario" but the actual implementation uses explicit field-by-field SQL. The 7 new columns must be added to the UPDATE SET, INSERT columns/values, and `rowToDesignSystem` mapper. The upsert merge logic follows the existing pattern: `input.field ?? existing.field`.

### 4.4 dist Rebuild

**`packages/storage/dist/`** — rebuild after every change to `packages/storage/src/`.

```bash
cd packages/storage && pnpm build
```

`dist/` is tracked in git — must be committed alongside source changes.

### 4.5 Export Functions — MODIFY

**`packages/codegraph/src/mcp/ds-export.ts`**

Extend all 3 functions with the new fields:

**`exportToCss`** — add:
```css
/* palette */
--color-brand-50: #...;  --color-brand-100: #...; ... (all shades)
--color-neutral-50: #...; ...

/* semantic colors */
--color-text-primary: ...; --color-bg-base: ...; etc.

/* shadows */
--shadow-sm: 0 1px ...; --shadow-glow: 0 0 ...;

/* typography families */
--font-sans: Inter; --font-mono: JetBrains Mono;

/* typography scale (size only) */
--font-size-xs: 0.75rem; --font-size-base: 1rem; ...

/* effects */
--effect-aurora-css: <customCss or preset-resolved css>;
```

**`exportToW3CJson`** — add:
```json
"typography.families.sans": { "$value": "Inter", "$type": "fontFamily" },
"shadow.md": { "$value": "0 4px ...", "$type": "shadow" },
"effect.aurora.preset": { "$value": "soft", "$type": "string" }
```

**`exportToTailwind`** — add:
```js
colors: { brand: { 50: '#...', ... } },
fontFamily: { sans: ['Inter', 'sans-serif'] },
fontSize: { xs: ['0.75rem', { lineHeight: '1rem' }] },
boxShadow: { sm: '0 1px ...', glow: '0 0 ...' }
```

### 4.6 Import Functions — MODIFY

**`packages/codegraph/src/mcp/ds-import.ts`**

Extend all 4 parsers:

**`parseCssVars`** — add detection for:
- `--shadow-*` → `shadows`
- `--font-size-*`, `--font-weight-*`, `--leading-*` → `typography.scale`/`weights`
- `--color-brand-*` → `palette.brand`
- `--color-text-*`, `--color-bg-*` → `semanticColors`
- `--effect-*` → `effects`

**`parseJsonTokens`** — add detection for:
- Keys starting with `typography.`, `shadow.`, `effect.` → respective new fields
- Keys starting with `color.brand.` → `palette.brand`
- Keys starting with `color.text.` → `semanticColors.text`

**`parseTailwindConfig`** — add:
- `theme.boxShadow` block → `shadows`
- `theme.fontFamily` already handled → also populate `typography.families`
- `theme.fontSize` block → `typography.scale`
- `theme.colors.brand` block → `palette.brand`

**`parseFigmaVariables`** — add:
- Variables in collection `palette` or named `palette/*` → `palette`
- Variables named `shadow/*` → `shadows`
- Variables named `effect/*` → `effects`
- Variables with `resolvedType === 'STRING'` and name `font/*` → `typography.families`

### 4.7 DS Runner System Prompt — MODIFY

**`packages/codegraph/src/mcp/ds-runner.ts`**

Update the AI system prompt / structured output schema to include all 7 new fields so AI-generated design systems are fully populated.

### 4.8 HTML UI — MODIFY

**`packages/codegraph/public/ds-studio/index.html`**

Add 7 new collapsible sections to the right panel, after the existing Border Radius section and before the Preview section. Each section uses `<details open>` for default-open collapsible behavior.

Sections (in order):
1. **COLOR PALETTE** — tab bar (brand/neutral/success/warning/error/info), shade grid 50-900, "Autogenerate from brand color" button
2. **SEMANTIC COLORS** — grouped rows: text.*/bg.*/border.*/feedback.*
3. **SHADOWS & GLOW** — sm/md/lg/xl/glow rows, each with preview box
4. **VISUAL EFFECTS** — aurora/gradientBorder/glow sub-sections, each with preset `<select>` + "Edit CSS ▾" collapsible `<textarea>`
5. **COMPONENTS** — tab bar (button/card/input/badge), token grid per component
6. **ASSETS** — logoUrl text input, wordmark text input, brand images list, icon library radio buttons (Lucide/Phosphor/Heroicons), tech logos tag input
7. **TYPOGRAPHY** — replaces the current minimal "Typography" section; shows families sub-section + full scale table (xs→9xl with size/leading/weight/tracking)

CSS additions:
- `.section-collapse` pattern for `<details>/<summary>` sections
- `.tab-bar` / `.tab-btn` / `.tab-pane` for tabbed content
- `.shade-grid` for the 50-900 color swatch grid
- `.shadow-preview` box
- `.tag-input` for tech logos

### 4.9 JS Logic — MODIFY

**`packages/codegraph/public/ds-studio/ds-studio.js`**

Add functions for each new section. Follow the existing pattern: state in a top-level `ds` object, `renderX()` functions that write to DOM, `collectX()` that read from DOM back to state.

New functions:
- `renderPalette()` / `collectPalette()` — shade grid per color group
- `autogeneratePalette(baseHex)` — generate 9 shades from a single color using luminance steps
- `renderSemanticColors()` / `collectSemanticColors()`
- `renderShadows()` / `collectShadows()` — with live preview boxes
- `renderEffects()` / `collectEffects()` — preset picker + CSS textarea toggle
- `renderComponents()` / `collectComponents()` — token grid per tab
- `renderAssets()` / `collectAssets()` — URL inputs + tag input for tech logos
- `renderTypography()` / `collectTypography()` — replaces current `renderFonts()` for families + adds full scale table

Update `renderAll()` to call all new `renderX()` functions.
Update `collectAll()` to call all new `collectX()` functions (feeds into `saveDs()`).
Update `applyImport(data)` to merge new fields from import results.

---

## 5. Export/Import Field Mapping Summary

| DS field | CSS prefix | Tailwind key | W3C JSON prefix | Figma |
|---|---|---|---|---|
| `palette` | `--color-{group}-{shade}` | `colors.{group}.{shade}` | `color.{group}.{shade}` | collection `palette` |
| `semanticColors` | `--color-{cat}-{role}` | `colors.{cat}.{role}` | `color.{cat}.{role}` | vars named `semantic/*` |
| `shadows` | `--shadow-{name}` | `boxShadow.{name}` | `shadow.{name}` | vars named `shadow/*` |
| `typography.families` | `--font-{key}` | `fontFamily.{key}` | `typography.families.{key}` | vars `font/family/*` |
| `typography.scale` | `--font-size-{step}` | `fontSize.{step}` | `typography.scale.{step}.size` | vars `font/size/*` |
| `effects` | `--effect-{name}-css` | _(no standard)_ | `effect.{name}.preset` | vars `effect/*` |
| `components` | _(no standard)_ | _(no standard)_ | `component.{name}.{token}` | _(no standard)_ |
| `assets` | _(no standard)_ | _(no standard)_ | `asset.{key}` | _(no standard)_ |

---

## 6. Constraints

- `dist/` is git-tracked — rebuild + commit after every `packages/storage/src/` change
- DS Studio is a static iframe at `/ds-studio/` — no bundler, vanilla JS only
- `upsertDesignSystem` route (`POST /api/design-systems`) **does** need modification — see §4.3
- `design_system_get` MCP tool reads from the separate `design_systems` table via `ComponentsStore` — check if it needs updating to expose new fields to AI agents
- New fields are all optional with `DEFAULT '{}'` → zero migration risk on existing data
- `studio_design_systems` (StudioStore / AI catalog) is NOT affected by this change

---

## 7. Test Plan

1. Run `pnpm build` in `packages/storage` — must succeed with no type errors
2. `pnpm test` in `packages/storage` — all existing tests pass
3. Manual: open DS Studio, fill palette section, save DS, reload → data persists
4. Manual: export CSS → `--color-brand-50` appears in output
5. Manual: export Tailwind → `colors.brand.50` appears in output
6. Manual: import CSS with `--shadow-glow` → shadows section populated
7. Manual: AI generate → result includes palette + typography sections
