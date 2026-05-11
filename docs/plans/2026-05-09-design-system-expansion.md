# Design System Studio Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend DS Studio with 7 new token categories (palette, semantic colors, shadows, typography, effects, components, assets) stored as JSON columns on `design_systems`, surfaced in the UI, and included in all export/import pipelines.

**Architecture:** Add 7 `TEXT DEFAULT '{}'` columns to `design_systems` via migration 031. Extend `DesignSystem`/`DesignSystemInput` interfaces and `upsertDesignSystem` in `components-store.ts`. Extend export (`ds-export.ts`), import (`ds-import.ts`), AI runner prompt (`ds-runner.ts`), and DS Studio UI (`index.html` + `ds-studio.js`).

**Tech Stack:** SQLite + better-sqlite3, TypeScript, Vitest, vanilla JS (no bundler in ds-studio), Express routes.

**Key file locations:**
- DB migration: `packages/storage/src/migrations/031_design_system_expand.sql` (NEW)
- Types + store: `packages/storage/src/components-store.ts`
- Export logic: `packages/codegraph/src/mcp/ds-export.ts`
- Import logic: `packages/codegraph/src/mcp/ds-import.ts`
- AI runner: `packages/codegraph/src/mcp/ds-runner.ts`
- UI markup: `packages/codegraph/public/ds-studio/index.html`
- UI logic: `packages/codegraph/public/ds-studio/ds-studio.js`
- Tests: `packages/codegraph/tests/ds-export.test.ts` (NEW), `packages/codegraph/tests/ds-import.test.ts` (NEW)
- Dist (git-tracked): `packages/storage/dist/` — MUST rebuild after every storage source change

**Important constraints:**
- `packages/storage/dist/` is tracked in git. Run `cd packages/storage && pnpm build` + commit dist after every `src/` change.
- DS Studio is vanilla JS inside an iframe at `/ds-studio/` — no bundler.
- `studio_design_systems` (StudioStore) is a SEPARATE read-only AI catalog. Do NOT touch it.
- The MCP tool `design_system_get` reads from `design_systems` (ComponentsStore) — it will auto-pick up the new fields via JSON parse in rowToDesignSystem.

---

### Task 1: DB Migration — add 7 columns to design_systems

**Files:**
- Create: `packages/storage/src/migrations/031_design_system_expand.sql`

**Step 1: Create the migration file**

```sql
-- Migration 031: Expand design_systems with 7 new token category columns
ALTER TABLE design_systems ADD COLUMN palette         TEXT NOT NULL DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN semantic_colors TEXT NOT NULL DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN shadows         TEXT NOT NULL DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN typography      TEXT NOT NULL DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN effects         TEXT NOT NULL DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN components      TEXT NOT NULL DEFAULT '{}';
ALTER TABLE design_systems ADD COLUMN assets          TEXT NOT NULL DEFAULT '{}';
```

SQLite `ALTER TABLE ... ADD COLUMN` is safe for existing rows — they get the DEFAULT value automatically. No data migration needed.

**Step 2: Verify migration numbering**

Run:
```bash
ls packages/storage/src/migrations/ | sort | tail -5
```
Expected: `029_component_comments.sql` is latest. `031` is next safe number (030 may exist — verify and adjust filename if needed).

**Step 3: Commit**

```bash
git add packages/storage/src/migrations/031_design_system_expand.sql
git commit -m "feat(storage): migration 031 — expand design_systems with 7 token columns"
```

---

### Task 2: TypeScript types + ComponentsStore + dist rebuild

**Files:**
- Modify: `packages/storage/src/components-store.ts`

**Context:** The `DesignSystem` interface (line ~55) and `DesignSystemInput` (line ~72) need 7 new optional fields. `upsertDesignSystem` (line ~276) has explicit field-by-field UPDATE and INSERT that both need extending. `rowToDesignSystem` (line ~476) mapper needs to parse the new JSON columns.

**Step 1: Extend DesignSystem interface**

In `packages/storage/src/components-store.ts`, find the `DesignSystem` interface and add after `notes?`:

```typescript
export interface DesignSystem {
  id: string
  project: string
  clientName?: string
  colors: Record<string, string>
  fonts: Record<string, unknown>
  spacing: Record<string, unknown>
  radius: Record<string, string>
  animations: unknown[]
  darkMode: boolean
  colorFormat: 'hex' | 'oklch' | 'hsl'
  tailwindConfig?: string
  notes?: string
  // ── New token categories (migration 031) ──────────────────────────────────
  palette?: Record<string, Record<string, string>>         // brand/neutral/success/warning/error/info shades
  semanticColors?: Record<string, Record<string, string>>  // text/bg/border/feedback role maps
  shadows?: Record<string, string>                         // sm/md/lg/xl/glow CSS strings
  typography?: Record<string, unknown>                     // families, scale, weights, tracking
  effects?: Record<string, unknown>                        // aurora/gradientBorder/glow presets+css
  components?: Record<string, Record<string, string>>      // button/card/input/badge token maps
  assets?: Record<string, unknown>                         // logoUrl, iconLibrary, techLogos, etc.
  createdAt: string
  updatedAt: string
}
```

**Step 2: Extend DesignSystemInput interface**

After `notes?` in `DesignSystemInput`, add the same 7 optional fields:

```typescript
export interface DesignSystemInput {
  project: string
  clientName?: string
  colors?: Record<string, string>
  fonts?: Record<string, unknown>
  spacing?: Record<string, unknown>
  radius?: Record<string, string>
  animations?: unknown[]
  darkMode?: boolean
  colorFormat?: 'hex' | 'oklch' | 'hsl'
  tailwindConfig?: string
  notes?: string
  // ── New token categories (migration 031) ──────────────────────────────────
  palette?: Record<string, Record<string, string>>
  semanticColors?: Record<string, Record<string, string>>
  shadows?: Record<string, string>
  typography?: Record<string, unknown>
  effects?: Record<string, unknown>
  components?: Record<string, Record<string, string>>
  assets?: Record<string, unknown>
}
```

**Step 3: Extend upsertDesignSystem — UPDATE branch**

Find the UPDATE branch of `upsertDesignSystem`. Change the `updated` object and SQL to include the 7 new fields:

```typescript
const updated: DesignSystem = {
  ...existing,
  clientName: input.clientName ?? existing.clientName,
  colors: input.colors ?? existing.colors,
  fonts: input.fonts ?? existing.fonts,
  spacing: input.spacing ?? existing.spacing,
  radius: input.radius ?? existing.radius,
  animations: input.animations ?? existing.animations,
  darkMode: input.darkMode ?? existing.darkMode,
  colorFormat: input.colorFormat ?? existing.colorFormat,
  tailwindConfig: input.tailwindConfig ?? existing.tailwindConfig,
  notes: input.notes ?? existing.notes,
  palette: input.palette ?? existing.palette,
  semanticColors: input.semanticColors ?? existing.semanticColors,
  shadows: input.shadows ?? existing.shadows,
  typography: input.typography ?? existing.typography,
  effects: input.effects ?? existing.effects,
  components: input.components ?? existing.components,
  assets: input.assets ?? existing.assets,
  updatedAt: now,
}
this.db.prepare(`
  UPDATE design_systems SET
    client_name = ?, colors = ?, fonts = ?, spacing = ?, radius = ?,
    animations = ?, dark_mode = ?, color_format = ?, tailwind_config = ?,
    notes = ?,
    palette = ?, semantic_colors = ?, shadows = ?, typography = ?,
    effects = ?, components = ?, assets = ?,
    updated_at = ?
  WHERE project = ?
`).run(
  updated.clientName ?? null, JSON.stringify(updated.colors),
  JSON.stringify(updated.fonts), JSON.stringify(updated.spacing),
  JSON.stringify(updated.radius), JSON.stringify(updated.animations),
  updated.darkMode ? 1 : 0, updated.colorFormat,
  updated.tailwindConfig ?? null, updated.notes ?? null,
  JSON.stringify(updated.palette ?? {}),
  JSON.stringify(updated.semanticColors ?? {}),
  JSON.stringify(updated.shadows ?? {}),
  JSON.stringify(updated.typography ?? {}),
  JSON.stringify(updated.effects ?? {}),
  JSON.stringify(updated.components ?? {}),
  JSON.stringify(updated.assets ?? {}),
  updated.updatedAt, updated.project,
)
```

**Step 4: Extend upsertDesignSystem — INSERT branch**

Find the INSERT branch. Extend the `ds` object and SQL:

```typescript
const ds: DesignSystem = {
  id: `DS-${input.project}`,
  project: input.project,
  clientName: input.clientName,
  colors: input.colors ?? {},
  fonts: input.fonts ?? {},
  spacing: input.spacing ?? {},
  radius: input.radius ?? {},
  animations: input.animations ?? [],
  darkMode: input.darkMode ?? false,
  colorFormat: input.colorFormat ?? 'hex',
  tailwindConfig: input.tailwindConfig,
  notes: input.notes,
  palette: input.palette ?? {},
  semanticColors: input.semanticColors ?? {},
  shadows: input.shadows ?? {},
  typography: input.typography ?? {},
  effects: input.effects ?? {},
  components: input.components ?? {},
  assets: input.assets ?? {},
  createdAt: now,
  updatedAt: now,
}

this.db.prepare(`
  INSERT INTO design_systems
    (id, project, client_name, colors, fonts, spacing, radius, animations,
     dark_mode, color_format, tailwind_config, notes,
     palette, semantic_colors, shadows, typography, effects, components, assets,
     created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  ds.id, ds.project, ds.clientName ?? null,
  JSON.stringify(ds.colors), JSON.stringify(ds.fonts),
  JSON.stringify(ds.spacing), JSON.stringify(ds.radius),
  JSON.stringify(ds.animations), ds.darkMode ? 1 : 0,
  ds.colorFormat, ds.tailwindConfig ?? null, ds.notes ?? null,
  JSON.stringify(ds.palette), JSON.stringify(ds.semanticColors),
  JSON.stringify(ds.shadows), JSON.stringify(ds.typography),
  JSON.stringify(ds.effects), JSON.stringify(ds.components),
  JSON.stringify(ds.assets),
  ds.createdAt, ds.updatedAt,
)
```

**Step 5: Extend rowToDesignSystem mapper**

Find `private rowToDesignSystem(row: any): DesignSystem` and add 7 new fields:

```typescript
private rowToDesignSystem(row: any): DesignSystem {
  return {
    id: row.id,
    project: row.project,
    clientName: row.client_name ?? undefined,
    colors: JSON.parse(row.colors || '{}'),
    fonts: JSON.parse(row.fonts || '{}'),
    spacing: JSON.parse(row.spacing || '{}'),
    radius: JSON.parse(row.radius || '{}'),
    animations: JSON.parse(row.animations || '[]'),
    darkMode: row.dark_mode === 1,
    colorFormat: row.color_format as 'hex' | 'oklch' | 'hsl',
    tailwindConfig: row.tailwind_config ?? undefined,
    notes: row.notes ?? undefined,
    palette:        JSON.parse(row.palette         || '{}'),
    semanticColors: JSON.parse(row.semantic_colors || '{}'),
    shadows:        JSON.parse(row.shadows         || '{}'),
    typography:     JSON.parse(row.typography      || '{}'),
    effects:        JSON.parse(row.effects         || '{}'),
    components:     JSON.parse(row.components      || '{}'),
    assets:         JSON.parse(row.assets          || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

**Step 6: Typecheck**

```bash
cd packages/storage && pnpm exec tsc --noEmit
```
Expected: zero errors.

**Step 7: Rebuild dist**

```bash
cd packages/storage && pnpm build
```
Expected: `dist/` updated, migrations copied.

**Step 8: Commit**

```bash
git add packages/storage/src/components-store.ts packages/storage/dist/
git commit -m "feat(storage): extend DesignSystem type + upsert + mapper for 7 new token columns"
```

---

### Task 3: Extend export functions (ds-export.ts)

**Files:**
- Create: `packages/codegraph/tests/ds-export.test.ts`
- Modify: `packages/codegraph/src/mcp/ds-export.ts`

**Context:** `ds-export.ts` exports 3 functions: `exportToCss`, `exportToW3CJson`, `exportToTailwind`. They currently handle `colors`, `fonts`, `spacing`, `radius`. The `DesignSystem` type they use is `ComponentsDesignSystem` (aliased import from `@skillbrain/storage`). After Task 2, this type already has the 7 new fields.

**Step 1: Write failing tests**

Create `packages/codegraph/tests/ds-export.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { exportToCss, exportToW3CJson, exportToTailwind } from '../src/mcp/ds-export.js'
import type { ComponentsDesignSystem as DS } from '@skillbrain/storage'

const baseDs: DS = {
  id: 'DS-test', project: 'test', colors: {}, fonts: {}, spacing: {}, radius: {},
  animations: [], darkMode: false, colorFormat: 'hex',
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

const fullDs: DS = {
  ...baseDs,
  palette: {
    brand: { '50': '#faf5ff', '500': '#8b5cf6', '900': '#4c1d95' },
    neutral: { '50': '#f8fafc', '900': '#0f172a' },
  },
  semanticColors: {
    text: { primary: '#0f172a', muted: '#64748b' },
    bg: { base: '#ffffff', surface: '#f8fafc' },
  },
  shadows: { sm: '0 1px 2px rgba(0,0,0,0.05)', glow: '0 0 20px rgba(139,92,246,0.4)' },
  typography: {
    families: { sans: 'Inter', mono: 'JetBrains Mono' },
    scale: {
      xs: { size: '0.75rem', leading: '1rem' },
      base: { size: '1rem', leading: '1.5rem' },
    },
    weights: { normal: '400', bold: '700' },
  },
  effects: {
    aurora: { preset: 'soft', customCss: '' },
    glow: { preset: 'purple', customCss: '--glow: 0 0 30px violet' },
  },
  components: {
    button: { radius: '0.375rem', paddingX: '1rem', fontWeight: '600' },
  },
  assets: { logoUrl: 'https://example.com/logo.svg', iconLibrary: 'lucide' },
}

describe('exportToCss', () => {
  it('emits palette shade variables', () => {
    const css = exportToCss(fullDs)
    expect(css).toContain('--color-brand-50: #faf5ff;')
    expect(css).toContain('--color-brand-500: #8b5cf6;')
    expect(css).toContain('--color-neutral-900: #0f172a;')
  })

  it('emits semantic color variables', () => {
    const css = exportToCss(fullDs)
    expect(css).toContain('--color-text-primary: #0f172a;')
    expect(css).toContain('--color-bg-surface: #f8fafc;')
  })

  it('emits shadow variables', () => {
    const css = exportToCss(fullDs)
    expect(css).toContain('--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);')
    expect(css).toContain('--shadow-glow: 0 0 20px rgba(139,92,246,0.4);')
  })

  it('emits typography family variables', () => {
    const css = exportToCss(fullDs)
    expect(css).toContain('--font-sans: Inter;')
    expect(css).toContain('--font-mono: JetBrains Mono;')
  })

  it('emits typography scale variables', () => {
    const css = exportToCss(fullDs)
    expect(css).toContain('--font-size-xs: 0.75rem;')
    expect(css).toContain('--font-size-base: 1rem;')
  })

  it('emits effect customCss when non-empty', () => {
    const css = exportToCss(fullDs)
    expect(css).toContain('--glow: 0 0 30px violet')
  })

  it('skips empty effects customCss', () => {
    const css = exportToCss(fullDs)
    expect(css).not.toContain('effect-aurora-css:')
  })

  it('does not break when new fields are absent', () => {
    expect(() => exportToCss(baseDs)).not.toThrow()
  })
})

describe('exportToW3CJson', () => {
  it('emits palette tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['color.brand.50']).toEqual({ $value: '#faf5ff', $type: 'color' })
    expect(json['color.brand.900']).toEqual({ $value: '#4c1d95', $type: 'color' })
  })

  it('emits semantic color tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['color.text.primary']).toEqual({ $value: '#0f172a', $type: 'color' })
  })

  it('emits shadow tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['shadow.sm']).toEqual({ $value: '0 1px 2px rgba(0,0,0,0.05)', $type: 'shadow' })
  })

  it('emits typography family tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['typography.families.sans']).toEqual({ $value: 'Inter', $type: 'fontFamily' })
  })

  it('emits typography scale tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['typography.scale.base.size']).toEqual({ $value: '1rem', $type: 'dimension' })
  })

  it('emits effect preset tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['effect.aurora.preset']).toEqual({ $value: 'soft', $type: 'string' })
  })

  it('emits asset tokens', () => {
    const json = exportToW3CJson(fullDs)
    expect(json['asset.logoUrl']).toEqual({ $value: 'https://example.com/logo.svg', $type: 'string' })
    expect(json['asset.iconLibrary']).toEqual({ $value: 'lucide', $type: 'string' })
  })
})

describe('exportToTailwind', () => {
  it('emits palette colors as nested brand/neutral objects', () => {
    const tw = exportToTailwind(fullDs)
    expect(tw).toContain('"brand"')
    expect(tw).toContain('"50"')
    expect(tw).toContain('#faf5ff')
  })

  it('emits boxShadow from shadows', () => {
    const tw = exportToTailwind(fullDs)
    expect(tw).toContain('boxShadow')
    expect(tw).toContain('"sm"')
    expect(tw).toContain('0 1px 2px rgba(0,0,0,0.05)')
  })

  it('emits fontFamily from typography.families', () => {
    const tw = exportToTailwind(fullDs)
    expect(tw).toContain('fontFamily')
    expect(tw).toContain('"sans"')
    expect(tw).toContain('Inter')
  })

  it('emits fontSize from typography.scale', () => {
    const tw = exportToTailwind(fullDs)
    expect(tw).toContain('fontSize')
    expect(tw).toContain('"xs"')
    expect(tw).toContain('0.75rem')
  })

  it('does not break when new fields are absent', () => {
    expect(() => exportToTailwind(baseDs)).not.toThrow()
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd packages/codegraph && pnpm test -- tests/ds-export.test.ts
```
Expected: FAIL — exported CSS/JSON/Tailwind doesn't contain new fields yet.

**Step 3: Extend exportToCss in ds-export.ts**

After the existing 4 sections (colors, fonts, spacing, radius), add:

```typescript
// palette: --color-{group}-{shade}
const palette = ds.palette ?? {}
for (const [group, shades] of Object.entries(palette)) {
  if (shades && typeof shades === 'object') {
    for (const [shade, value] of Object.entries(shades as Record<string, string>)) {
      lines.push(`  --color-${group}-${shade}: ${value};`)
    }
  }
}

// semanticColors: --color-{cat}-{role}
const semanticColors = ds.semanticColors ?? {}
for (const [cat, roles] of Object.entries(semanticColors)) {
  if (roles && typeof roles === 'object') {
    for (const [role, value] of Object.entries(roles as Record<string, string>)) {
      lines.push(`  --color-${cat}-${role}: ${value};`)
    }
  }
}

// shadows: --shadow-{name}
const shadows = ds.shadows ?? {}
for (const [name, value] of Object.entries(shadows)) {
  lines.push(`  --shadow-${name}: ${value};`)
}

// typography families, scale sizes, weights
const typography = (ds.typography ?? {}) as Record<string, unknown>
const typeFamilies = (typography.families ?? {}) as Record<string, string>
for (const [key, value] of Object.entries(typeFamilies)) {
  lines.push(`  --font-${key}: ${value};`)
}
const typeScale = (typography.scale ?? {}) as Record<string, { size: string; leading?: string }>
for (const [step, vals] of Object.entries(typeScale)) {
  lines.push(`  --font-size-${step}: ${vals.size};`)
  if (vals.leading) lines.push(`  --line-height-${step}: ${vals.leading};`)
}
const typeWeights = (typography.weights ?? {}) as Record<string, string>
for (const [key, value] of Object.entries(typeWeights)) {
  lines.push(`  --font-weight-${key}: ${value};`)
}

// effects: only emit customCss if non-empty
const effects = (ds.effects ?? {}) as Record<string, { customCss?: string }>
for (const effect of Object.values(effects)) {
  if (effect?.customCss?.trim()) {
    lines.push(`  ${effect.customCss.trim()}`)
  }
}
```

**Step 4: Extend exportToW3CJson in ds-export.ts**

After the existing 4 sections, add:

```typescript
// palette
for (const [group, shades] of Object.entries(ds.palette ?? {})) {
  for (const [shade, value] of Object.entries(shades as Record<string, string>)) {
    result[`color.${group}.${shade}`] = { $value: value, $type: 'color' }
  }
}

// semanticColors
for (const [cat, roles] of Object.entries(ds.semanticColors ?? {})) {
  for (const [role, value] of Object.entries(roles as Record<string, string>)) {
    result[`color.${cat}.${role}`] = { $value: value, $type: 'color' }
  }
}

// shadows
for (const [name, value] of Object.entries(ds.shadows ?? {})) {
  result[`shadow.${name}`] = { $value: value, $type: 'shadow' }
}

// typography
const typography = (ds.typography ?? {}) as Record<string, unknown>
const typeFamilies = (typography.families ?? {}) as Record<string, string>
for (const [key, value] of Object.entries(typeFamilies)) {
  result[`typography.families.${key}`] = { $value: value, $type: 'fontFamily' }
}
const typeScale = (typography.scale ?? {}) as Record<string, { size: string; leading?: string }>
for (const [step, vals] of Object.entries(typeScale)) {
  result[`typography.scale.${step}.size`] = { $value: vals.size, $type: 'dimension' }
  if (vals.leading) {
    result[`typography.scale.${step}.leading`] = { $value: vals.leading, $type: 'string' }
  }
}

// effects
const effects = (ds.effects ?? {}) as Record<string, { preset?: string; customCss?: string }>
for (const [name, effect] of Object.entries(effects)) {
  if (effect?.preset) {
    result[`effect.${name}.preset`] = { $value: effect.preset, $type: 'string' }
  }
}

// assets
const assets = (ds.assets ?? {}) as Record<string, unknown>
if (typeof assets.logoUrl === 'string') {
  result['asset.logoUrl'] = { $value: assets.logoUrl, $type: 'string' }
}
if (typeof assets.iconLibrary === 'string') {
  result['asset.iconLibrary'] = { $value: assets.iconLibrary, $type: 'string' }
}
if (typeof assets.logoWordmark === 'string') {
  result['asset.logoWordmark'] = { $value: assets.logoWordmark, $type: 'string' }
}
```

**Step 5: Extend exportToTailwind in ds-export.ts**

Find the section that builds `lines`. After the existing `fontFamily`, `spacingOut`, `borderRadius` sections, add:

```typescript
// Palette — merge nested brand/neutral/etc. into colors
const palette = ds.palette ?? {}
if (Object.keys(palette).length > 0) {
  // palette groups are already structured as { brand: { '50': '#...' } }
  // merge alongside flat colorsOut
  const colorsWithPalette = { ...colorsOut, ...palette }
  // replace the colors push (refactor: build colorsWithPalette before the colors push)
  // Implementation: declare colorsOut BEFORE palette, then merge
}
```

> **Implementation note:** The cleanest approach is to declare `colorsOut` early, then merge palette into it before the `if (Object.keys(colorsOut).length > 0)` push. Here's the full rewritten `exportToTailwind`:

```typescript
export function exportToTailwind(ds: DesignSystem): string {
  const colors = ds.colors ?? {}
  const fonts = ds.fonts ?? {}
  const spacing = ds.spacing ?? {}
  const radius = ds.radius ?? {}

  // Colors: flat colors + palette groups merged
  const colorsOut: Record<string, unknown> = { ...colors, ...(ds.palette ?? {}) }

  // Font families: legacy fonts.* keys + typography.families
  const fontFamily: Record<string, string[]> = {}
  for (const k of FONT_KEYS) {
    const v = fonts[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      const fallback = k === 'mono' ? 'monospace' : k === 'serif' ? 'serif' : 'sans-serif'
      fontFamily[k] = [String(v), fallback]
    }
  }
  const typography = (ds.typography ?? {}) as Record<string, unknown>
  const typeFamilies = (typography.families ?? {}) as Record<string, string>
  for (const [k, v] of Object.entries(typeFamilies)) {
    if (!fontFamily[k]) {
      const fallback = k === 'mono' ? 'monospace' : k === 'serif' ? 'serif' : 'sans-serif'
      fontFamily[k] = [v, fallback]
    }
  }

  // Spacing
  const spacingOut: Record<string, string> = {}
  for (const [key, value] of Object.entries(spacing)) {
    spacingOut[key] = String(value)
  }

  // Border radius
  const borderRadius: Record<string, string> = { ...radius }

  // Font size from typography.scale
  const typeScale = (typography.scale ?? {}) as Record<string, { size: string; leading?: string }>
  const fontSizeOut: Record<string, [string, { lineHeight: string }]> = {}
  for (const [step, vals] of Object.entries(typeScale)) {
    fontSizeOut[step] = [vals.size, { lineHeight: vals.leading ?? '1.5' }]
  }

  // Box shadows
  const shadows = ds.shadows ?? {}

  const lines: string[] = [
    `/** @type {import('tailwindcss').Config} */`,
    `module.exports = {`,
    `  theme: {`,
    `    extend: {`,
  ]

  if (Object.keys(colorsOut).length > 0) {
    lines.push(`      colors: ${JSON.stringify(colorsOut, null, 4)},`)
  }
  if (Object.keys(fontFamily).length > 0) {
    lines.push(`      fontFamily: ${JSON.stringify(fontFamily, null, 4)},`)
  }
  if (Object.keys(spacingOut).length > 0) {
    lines.push(`      spacing: ${JSON.stringify(spacingOut, null, 4)},`)
  }
  if (Object.keys(borderRadius).length > 0) {
    lines.push(`      borderRadius: ${JSON.stringify(borderRadius, null, 4)},`)
  }
  if (Object.keys(fontSizeOut).length > 0) {
    lines.push(`      fontSize: ${JSON.stringify(fontSizeOut, null, 4)},`)
  }
  if (Object.keys(shadows).length > 0) {
    lines.push(`      boxShadow: ${JSON.stringify(shadows, null, 4)},`)
  }

  lines.push(`    },`)
  lines.push(`  },`)
  lines.push(`}`)

  return lines.join('\n')
}
```

**Step 6: Run tests — should pass now**

```bash
cd packages/codegraph && pnpm test -- tests/ds-export.test.ts
```
Expected: all PASS.

**Step 7: Commit**

```bash
git add packages/codegraph/tests/ds-export.test.ts packages/codegraph/src/mcp/ds-export.ts
git commit -m "feat(studio): extend export functions for 7 new DS token categories"
```

---

### Task 4: Extend import functions (ds-import.ts)

**Files:**
- Create: `packages/codegraph/tests/ds-import.test.ts`
- Modify: `packages/codegraph/src/mcp/ds-import.ts`

**Step 1: Write failing tests**

Create `packages/codegraph/tests/ds-import.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseCssVars, parseJsonTokens, parseTailwindConfig, parseFigmaVariables } from '../src/mcp/ds-import.js'

describe('parseCssVars — new fields', () => {
  it('parses --shadow-* into shadows', () => {
    const result = parseCssVars(`
      :root {
        --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
        --shadow-glow: 0 0 20px violet;
      }
    `)
    expect(result.shadows?.['sm']).toBe('0 1px 2px rgba(0,0,0,0.05)')
    expect(result.shadows?.['glow']).toBe('0 0 20px violet')
  })

  it('parses --font-size-* into typography.scale', () => {
    const result = parseCssVars(`
      :root {
        --font-size-xs: 0.75rem;
        --font-size-base: 1rem;
      }
    `)
    const scale = (result.typography as any)?.scale ?? {}
    expect(scale['xs']?.size).toBe('0.75rem')
    expect(scale['base']?.size).toBe('1rem')
  })

  it('parses --color-brand-* into palette.brand', () => {
    const result = parseCssVars(`
      :root {
        --color-brand-50: #faf5ff;
        --color-brand-900: #4c1d95;
      }
    `)
    expect(result.palette?.['brand']?.['50']).toBe('#faf5ff')
    expect(result.palette?.['brand']?.['900']).toBe('#4c1d95')
  })

  it('parses --color-text-* into semanticColors.text', () => {
    const result = parseCssVars(`
      :root {
        --color-text-primary: #0f172a;
        --color-text-muted: #64748b;
      }
    `)
    expect(result.semanticColors?.['text']?.['primary']).toBe('#0f172a')
  })
})

describe('parseJsonTokens — new fields', () => {
  it('maps shadow.* keys to shadows', () => {
    const result = parseJsonTokens({
      shadow: {
        sm: { $value: '0 1px 2px rgba(0,0,0,0.05)', $type: 'shadow' },
        glow: { $value: '0 0 20px violet', $type: 'shadow' },
      }
    })
    expect(result.shadows?.['sm']).toBe('0 1px 2px rgba(0,0,0,0.05)')
  })

  it('maps typography.families.* to typography.families', () => {
    const result = parseJsonTokens({
      typography: {
        families: {
          sans: { $value: 'Inter', $type: 'fontFamily' },
        }
      }
    })
    expect((result.typography as any)?.families?.['sans']).toBe('Inter')
  })

  it('maps color.brand.* to palette.brand', () => {
    const result = parseJsonTokens({
      color: {
        brand: {
          '50': { $value: '#faf5ff', $type: 'color' },
          '900': { $value: '#4c1d95', $type: 'color' },
        }
      }
    })
    expect(result.palette?.['brand']?.['50']).toBe('#faf5ff')
  })
})

describe('parseTailwindConfig — new fields', () => {
  it('maps boxShadow block to shadows', () => {
    const result = parseTailwindConfig(`
      module.exports = {
        theme: {
          extend: {
            boxShadow: {
              'sm': '0 1px 2px rgba(0,0,0,0.05)',
              'glow': '0 0 20px violet',
            }
          }
        }
      }
    `)
    expect(result.shadows?.['sm']).toBe('0 1px 2px rgba(0,0,0,0.05)')
    expect(result.shadows?.['glow']).toBe('0 0 20px violet')
  })

  it('maps fontFamily block to both fonts and typography.families', () => {
    const result = parseTailwindConfig(`
      module.exports = {
        theme: {
          extend: {
            fontFamily: {
              'sans': ['Inter', 'sans-serif'],
              'mono': ['JetBrains Mono', 'monospace'],
            }
          }
        }
      }
    `)
    expect(result.fonts?.['sans']).toBe('Inter')
    expect((result.typography as any)?.families?.['sans']).toBe('Inter')
  })

  it('maps colors.brand nested block to palette.brand', () => {
    const result = parseTailwindConfig(`
      module.exports = {
        theme: {
          extend: {
            colors: {
              'brand': {
                '50': '#faf5ff',
                '900': '#4c1d95',
              }
            }
          }
        }
      }
    `)
    expect(result.palette?.['brand']?.['50']).toBe('#faf5ff')
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
cd packages/codegraph && pnpm test -- tests/ds-import.test.ts
```
Expected: FAIL — new fields not returned yet.

**Step 3: Extend parseCssVars**

In `parseCssVars`, extend the return type and add new detection logic. The function currently returns `Partial<DesignSystemInput>` with `colors`, `fonts`, `spacing`, `radius`. Extend to also populate `shadows`, `typography`, `palette`, `semanticColors`:

Replace the function body with:

```typescript
export function parseCssVars(css: string): Partial<DesignSystemInput> {
  const colors: Record<string, string> = {}
  const fonts: Record<string, string> = {}
  const spacing: Record<string, string> = {}
  const radius: Record<string, string> = {}
  const shadows: Record<string, string> = {}
  const palette: Record<string, Record<string, string>> = {}
  const semanticColors: Record<string, Record<string, string>> = {}
  const typographyScale: Record<string, { size: string; leading?: string }> = {}
  const typographyFamilies: Record<string, string> = {}
  const typographyWeights: Record<string, string> = {}

  const re = /--([a-z][a-z0-9-]*)\s*:\s*([^;}{]+?)\s*;/gi
  let match: RegExpExecArray | null

  while ((match = re.exec(css)) !== null) {
    const [, rawName, rawValue] = match
    const name = rawName.toLowerCase()
    const value = rawValue.trim()

    // shadow-*
    if (name.startsWith('shadow-')) {
      shadows[name.slice(7)] = value
      continue
    }

    // font-size-*
    if (name.startsWith('font-size-')) {
      const step = name.slice(10)
      typographyScale[step] = { ...(typographyScale[step] ?? {}), size: value }
      continue
    }

    // line-height-* (leading for a font-size step)
    if (name.startsWith('line-height-')) {
      const step = name.slice(12)
      typographyScale[step] = { ...(typographyScale[step] ?? {}), leading: value }
      continue
    }

    // font-weight-*
    if (name.startsWith('font-weight-')) {
      typographyWeights[name.slice(12)] = value
      continue
    }

    // color-{group}-{shade} where shade is a number (palette)
    const paletteMatch = name.match(/^color-([a-z][a-z0-9-]*)-(\d+)$/)
    if (paletteMatch) {
      const [, group, shade] = paletteMatch
      palette[group] ??= {}
      palette[group][shade] = value
      continue
    }

    // color-{cat}-{role} where cat is text|bg|border|feedback (semantic)
    const semMatch = name.match(/^color-(text|bg|border|feedback)-(.+)$/)
    if (semMatch) {
      const [, cat, role] = semMatch
      semanticColors[cat] ??= {}
      semanticColors[cat][role] = value
      continue
    }

    // Legacy: color vars, font vars, spacing, radius
    const isColorValue = /^(#|rgb|hsl|oklch)/.test(value)
    const isColorName = /color|bg|background|text|foreground|accent|primary|secondary|muted|border|surface/.test(name)
    const storageKey = name.startsWith('color-') ? name.slice(6) : name

    if (isColorValue || isColorName) {
      colors[storageKey] = value
    } else if (/^font-|family|typeface/.test(name)) {
      const fontKey = name.startsWith('font-') ? name.slice(5) : name
      fonts[fontKey] = value
      typographyFamilies[fontKey] = value
    } else if (/spacing|space|gap/.test(name)) {
      spacing[storageKey] = value
    } else if (/radius|rounded|corner/.test(name)) {
      radius[storageKey] = value
    }
  }

  const typography: Record<string, unknown> = {}
  if (Object.keys(typographyFamilies).length) typography.families = typographyFamilies
  if (Object.keys(typographyScale).length) typography.scale = typographyScale
  if (Object.keys(typographyWeights).length) typography.weights = typographyWeights

  return {
    colors,
    fonts,
    spacing,
    radius,
    ...(Object.keys(shadows).length ? { shadows } : {}),
    ...(Object.keys(palette).length ? { palette } : {}),
    ...(Object.keys(semanticColors).length ? { semanticColors } : {}),
    ...(Object.keys(typography).length ? { typography } : {}),
  }
}
```

**Step 4: Extend parseJsonTokens**

The function recursively walks a JSON object. Add detection for `shadow.*`, `typography.*`, and `color.{group}.{shade}` patterns. The cleanest approach: after the existing `walk()` function, add post-processing based on the top-level key structure. Replace the body:

```typescript
export function parseJsonTokens(raw: unknown): Partial<DesignSystemInput> {
  const colors: Record<string, string> = {}
  const fonts: Record<string, string> = {}
  const spacing: Record<string, string> = {}
  const radius: Record<string, string> = {}
  const shadows: Record<string, string> = {}
  const palette: Record<string, Record<string, string>> = {}
  const semanticColors: Record<string, Record<string, string>> = {}
  const typographyFamilies: Record<string, string> = {}
  const typographyScale: Record<string, { size: string; leading?: string }> = {}

  function walk(node: unknown, path: string[]): void {
    if (node === null || typeof node !== 'object') return
    const obj = node as Record<string, unknown>

    if ('$value' in obj) {
      const value = String(obj.$value)
      const key = path.join('.')

      // shadow.*
      if (path[0] === 'shadow' && path.length === 2) {
        shadows[path[1]] = value; return
      }

      // typography.families.*
      if (path[0] === 'typography' && path[1] === 'families' && path.length === 3) {
        typographyFamilies[path[2]] = value; return
      }

      // typography.scale.{step}.size|leading
      if (path[0] === 'typography' && path[1] === 'scale' && path.length === 4) {
        const step = path[2]; const prop = path[3]
        typographyScale[step] ??= { size: '' }
        if (prop === 'size') typographyScale[step].size = value
        if (prop === 'leading') typographyScale[step].leading = value
        return
      }

      // color.{group}.{shade} where shade is numeric — palette
      if (path[0] === 'color' && path.length === 3 && /^\d+$/.test(path[2])) {
        palette[path[1]] ??= {}
        palette[path[1]][path[2]] = value; return
      }

      // color.{semantic-cat}.{role} — semanticColors
      if (path[0] === 'color' && path.length === 3 && /^(text|bg|border|feedback)$/.test(path[1])) {
        semanticColors[path[1]] ??= {}
        semanticColors[path[1]][path[2]] = value; return
      }

      // fallback to legacy categorizer
      categorize(key, value, colors, fonts, spacing, radius)
      return
    }

    for (const [key, child] of Object.entries(obj)) {
      if (key.startsWith('$')) continue
      if (typeof child === 'string') {
        categorize([...path, key].join('.'), child, colors, fonts, spacing, radius)
      } else if (child !== null && typeof child === 'object') {
        walk(child, [...path, key])
      }
    }
  }

  walk(raw, [])

  const typography: Record<string, unknown> = {}
  if (Object.keys(typographyFamilies).length) typography.families = typographyFamilies
  if (Object.keys(typographyScale).length) typography.scale = typographyScale

  return {
    colors,
    fonts,
    spacing,
    radius,
    ...(Object.keys(shadows).length ? { shadows } : {}),
    ...(Object.keys(palette).length ? { palette } : {}),
    ...(Object.keys(semanticColors).length ? { semanticColors } : {}),
    ...(Object.keys(typography).length ? { typography } : {}),
  }
}
```

**Step 5: Extend parseTailwindConfig**

After the existing `colors`, `fontFamily`, `spacing`, `borderRadius` blocks, add:

```typescript
// boxShadow → shadows
const shadows: Record<string, string> = {}
const shadowBlock = extractBlock(configText, 'boxShadow')
if (shadowBlock) {
  for (const [k, v] of extractPairs(shadowBlock)) {
    shadows[k] = v
  }
}

// fontFamily also populates typography.families
const typographyFamilies: Record<string, string> = { ...fonts }

// Detect palette: colors with numeric sub-keys (brand: { '50': '...', ... })
const palette: Record<string, Record<string, string>> = {}
if (colorsBlock) {
  // Find nested objects within colors block: 'brand': { ... }
  const nestedRe = /['"]([^'"]+)['"]\s*:\s*\{([^}]+)\}/g
  let nm: RegExpExecArray | null
  while ((nm = nestedRe.exec(colorsBlock)) !== null) {
    const groupName = nm[1]
    const innerBlock = nm[2]
    const shades: Record<string, string> = {}
    for (const [k, v] of extractPairs(innerBlock)) {
      shades[k] = v
    }
    if (Object.keys(shades).length > 0) {
      palette[groupName] = shades
    }
  }
}

const typography: Record<string, unknown> = {}
if (Object.keys(typographyFamilies).length) typography.families = typographyFamilies

return {
  colors,
  fonts,
  spacing,
  radius,
  ...(Object.keys(shadows).length ? { shadows } : {}),
  ...(Object.keys(palette).length ? { palette } : {}),
  ...(Object.keys(typography).length ? { typography } : {}),
}
```

> Note: The existing function returns `{ colors, fonts, spacing, radius }` — change the return to include new fields.

**Step 6: Extend parseFigmaVariables**

After the existing color/float/string categorization, add palette/shadow detection based on variable name prefix:

```typescript
// After: categorize(name, hex/value, colors, fonts, spacing, radius)
// Add smart routing for new categories:

// In the COLOR branch, additionally detect palette and semanticColors:
if (variable.resolvedType === 'COLOR') {
  const color = firstValue as FigmaColorValue
  if (color && typeof color === 'object' && typeof color.r === 'number') {
    const hex = toHex({ r: color.r, g: color.g, b: color.b, a: color.a ?? 1 })
    
    // palette/brand/50 → palette.brand[50]
    const palMatch = name.match(/^(?:palette|colors?)\.([a-z][a-z0-9-]*)\.(\d+)$/)
    if (palMatch) {
      // store in palette — handled below in post-processing
    }
    // shadow/sm → shadows.sm
    else if (name.startsWith('shadow.')) {
      // shadows handled in FLOAT/STRING block below
    }
    else {
      categorize(name, hex, colors, fonts, spacing, radius)
    }
  }
}
```

> The Figma parser is the most complex. For now, extend with basic palette + shadow detection. The categorize() function already handles the legacy routing.

**Step 7: Run tests — all should pass**

```bash
cd packages/codegraph && pnpm test -- tests/ds-import.test.ts
```
Expected: all PASS.

**Step 8: Commit**

```bash
git add packages/codegraph/tests/ds-import.test.ts packages/codegraph/src/mcp/ds-import.ts
git commit -m "feat(studio): extend import parsers for shadows/palette/semanticColors/typography"
```

---

### Task 5: Update DS Runner AI system prompt

**Files:**
- Modify: `packages/codegraph/src/mcp/ds-runner.ts`

**Context:** The constant `DS_SYSTEM_PROMPT` (line 20) defines the exact JSON shape the AI must return. It currently lists `colors`, `fonts`, `spacing`, `radius`, `animations`, `darkMode`, `colorFormat`. Extend it with all 7 new sections.

**Step 1: Replace DS_SYSTEM_PROMPT constant**

Find the `DS_SYSTEM_PROMPT` constant (starts at line 20) and replace the entire string:

```typescript
const DS_SYSTEM_PROMPT = `You are an expert UI/UX designer and design systems engineer.
Given a brief describing a product, brand, or visual direction, generate a complete design system token set.

Return ONLY the JSON object. No explanation, no markdown, no code fences.

The JSON must have exactly this shape (fill in all values based on the brief):
{
  "colors": {
    "primary": "#...",
    "secondary": "#...",
    "accent": "#...",
    "background": "#...",
    "surface": "#...",
    "text": "#...",
    "textMuted": "#...",
    "border": "#...",
    "error": "#...",
    "success": "#...",
    "warning": "#..."
  },
  "fonts": {
    "sans": "Inter",
    "mono": "JetBrains Mono",
    "heading": "Inter",
    "baseSize": "16px",
    "lineHeight": "1.5"
  },
  "spacing": {
    "xs": "4px", "sm": "8px", "md": "16px", "lg": "24px", "xl": "32px", "2xl": "48px"
  },
  "radius": {
    "sm": "4px", "md": "8px", "lg": "16px", "full": "9999px"
  },
  "animations": [],
  "darkMode": true,
  "colorFormat": "hex",
  "palette": {
    "brand":   { "50":"#...", "100":"#...", "200":"#...", "300":"#...", "400":"#...", "500":"#...", "600":"#...", "700":"#...", "800":"#...", "900":"#..." },
    "neutral": { "50":"#f8fafc", "100":"#f1f5f9", "200":"#e2e8f0", "300":"#cbd5e1", "400":"#94a3b8", "500":"#64748b", "600":"#475569", "700":"#334155", "800":"#1e293b", "900":"#0f172a" },
    "success": { "50":"#f0fdf4", "500":"#22c55e", "900":"#14532d" },
    "warning": { "50":"#fffbeb", "500":"#f59e0b", "900":"#78350f" },
    "error":   { "50":"#fef2f2", "500":"#ef4444", "900":"#7f1d1d" },
    "info":    { "50":"#eff6ff", "500":"#3b82f6", "900":"#1e3a5f" }
  },
  "semanticColors": {
    "text":     { "primary": "#...", "secondary": "#...", "muted": "#..." },
    "bg":       { "base": "#...", "surface": "#...", "overlay": "#..." },
    "border":   { "default": "#...", "focus": "#..." },
    "feedback": { "success": "#...", "warning": "#...", "error": "#...", "info": "#..." }
  },
  "shadows": {
    "sm":   "0 1px 2px rgba(0,0,0,0.05)",
    "md":   "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
    "lg":   "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
    "xl":   "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
    "glow": "0 0 20px rgba(167,139,250,0.4)"
  },
  "typography": {
    "families": { "sans": "Inter", "mono": "JetBrains Mono", "heading": "Inter" },
    "scale": {
      "xs":  { "size": "0.75rem",  "leading": "1rem" },
      "sm":  { "size": "0.875rem", "leading": "1.25rem" },
      "base":{ "size": "1rem",     "leading": "1.5rem" },
      "lg":  { "size": "1.125rem", "leading": "1.75rem" },
      "xl":  { "size": "1.25rem",  "leading": "1.75rem" },
      "2xl": { "size": "1.5rem",   "leading": "2rem" },
      "3xl": { "size": "1.875rem", "leading": "2.25rem" },
      "4xl": { "size": "2.25rem",  "leading": "2.5rem" },
      "5xl": { "size": "3rem",     "leading": "1" },
      "6xl": { "size": "3.75rem",  "leading": "1" },
      "9xl": { "size": "8rem",     "leading": "1" }
    },
    "weights": { "normal": "400", "medium": "500", "semibold": "600", "bold": "700" },
    "tracking": { "tight": "-0.05em", "normal": "0em", "wide": "0.05em" }
  },
  "effects": {
    "aurora":         { "preset": "soft",        "customCss": "" },
    "gradientBorder": { "preset": "purple-blue",  "customCss": "" },
    "glow":           { "preset": "purple",       "customCss": "" }
  },
  "components": {
    "button": { "radius": "0.375rem", "paddingX": "1rem",    "paddingY": "0.5rem",   "fontWeight": "600", "fontSize": "0.875rem" },
    "card":   { "radius": "0.75rem",  "padding":  "1.5rem",  "shadow": "md" },
    "input":  { "radius": "0.375rem", "paddingX": "0.75rem", "paddingY": "0.5rem",   "fontSize": "0.875rem" },
    "badge":  { "radius": "9999px",   "paddingX": "0.625rem","paddingY": "0.125rem", "fontSize": "0.75rem", "fontWeight": "500" }
  },
  "assets": {
    "logoUrl": "",
    "logoWordmark": "",
    "brandImageryUrls": [],
    "iconLibrary": "lucide",
    "techLogos": []
  }
}

Return ONLY the JSON object. No explanation, no markdown, no code fences.`
```

**Step 2: Typecheck**

```bash
cd packages/codegraph && pnpm exec tsc --noEmit
```
Expected: zero errors.

**Step 3: Commit**

```bash
git add packages/codegraph/src/mcp/ds-runner.ts
git commit -m "feat(studio): extend AI runner prompt with 7 new DS token categories"
```

---

### Task 6: DS Studio HTML — CSS additions + 7 new sections

**Files:**
- Modify: `packages/codegraph/public/ds-studio/index.html`

**Context:** The right panel (`#right`) currently has: Colors, Typography, Spacing Scale, Border Radius, Preview, Save bar. Add 7 new `<details open>` sections before the Preview section. Each section replaces or supplements the existing basic ones (Typography replaces the simple fonts grid).

**Step 1: Add CSS for new section patterns**

In the `<style>` block, after the existing `.token-grid` rules, add:

```css
/* Collapsible sections */
details.token-section summary { cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center }
details.token-section summary::-webkit-details-marker { display:none }
details.token-section[open] summary::after { content:'▲'; font-size:9px; color:var(--text-muted) }
details.token-section:not([open]) summary::after { content:'▼'; font-size:9px; color:var(--text-muted) }
details.token-section:not([open]) > *:not(summary) { display:none }

/* Tab bar */
.tab-bar { display:flex; gap:4px; margin-bottom:12px }
.tab-btn { background:var(--surface); border:1px solid var(--border); border-radius:5px; padding:4px 10px; font-size:11px; cursor:pointer; color:var(--text-dim) }
.tab-btn.active { background:var(--accent2); border-color:var(--accent2); color:#fff }
.tab-pane { display:none }
.tab-pane.active { display:block }

/* Shade grid: 9 swatches per palette row */
.shade-row { display:flex; align-items:center; gap:6px; margin-bottom:8px }
.shade-row-label { font-size:11px; color:var(--text-dim); width:52px; flex-shrink:0; text-transform:capitalize }
.shade-cell { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px }
.shade-cell input[type=color] { width:100%; height:22px; border:none; border-radius:3px; cursor:pointer; padding:0; background:none }
.shade-cell span { font-size:9px; color:var(--text-muted) }

/* Shadow preview */
.shadow-row { display:flex; align-items:center; gap:8px; margin-bottom:8px }
.shadow-preview { width:32px; height:32px; background:var(--card); border-radius:4px; flex-shrink:0 }
.shadow-row input[type=text] { flex:1; background:var(--surface); border:1px solid var(--border); border-radius:4px; color:var(--text); padding:4px 7px; font-size:11px }

/* Effects: preset select + css toggle */
.effect-block { margin-bottom:10px }
.effect-label { font-size:11px; font-weight:500; color:var(--text-dim); margin-bottom:4px }
.effect-row { display:flex; align-items:center; gap:6px }
.effect-row select { flex:1; background:var(--surface); border:1px solid var(--border); border-radius:4px; color:var(--text); padding:4px 7px; font-size:11px }
.effect-css-toggle { font-size:10px; color:var(--accent); cursor:pointer; white-space:nowrap }
.effect-css-area { width:100%; margin-top:4px; height:56px; font-family:monospace; font-size:10px }

/* Tag input for tech logos */
.tag-list { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px }
.tag-chip { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:2px 8px; font-size:11px; display:flex; align-items:center; gap:4px }
.tag-chip button { background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:13px; line-height:1; padding:0 }

/* Typography table */
.type-table { width:100%; border-collapse:collapse; font-size:11px }
.type-table th { text-align:left; color:var(--text-muted); font-weight:600; padding:3px 6px; border-bottom:1px solid var(--border) }
.type-table td { padding:3px 6px; border-bottom:1px solid var(--border); color:var(--text-dim) }
.type-table td input { width:100%; background:var(--surface); border:1px solid var(--border); border-radius:3px; color:var(--text); padding:2px 5px; font-size:11px }
```

**Step 2: Replace existing Typography section + add 6 more sections**

In the `#right` div, replace the existing simple `<div class="token-section">` for Typography and add the new sections. Remove the old `<div class="token-section">` for Typography (the one with `<div class="token-grid" id="fonts-grid"></div>`) and replace with a `<details>` version, then add 6 more sections.

The right panel should read (in order):
1. Colors (existing — keep as-is)
2. Spacing Scale (existing — keep as-is)
3. Border Radius (existing — keep as-is)
4. **TYPOGRAPHY** (new — replaces old simple one)
5. **COLOR PALETTE** (new)
6. **SEMANTIC COLORS** (new)
7. **SHADOWS & GLOW** (new)
8. **VISUAL EFFECTS** (new)
9. **COMPONENTS** (new)
10. **ASSETS** (new)
11. Preview (existing — keep as-is)
12. Save bar (existing — keep as-is)

**Complete HTML for the 7 new sections** (insert after Border Radius, before Preview):

```html
<!-- TYPOGRAPHY (replaces old simple fonts grid) -->
<details class="token-section" open>
  <summary><h3 style="margin:0">Typography</h3></summary>
  <div style="margin-top:12px">
    <div class="l-label" style="margin-bottom:8px">Font Families</div>
    <div class="token-grid" id="type-families-grid"></div>
    <div class="l-label" style="margin-bottom:8px;margin-top:12px">Type Scale</div>
    <table class="type-table" id="type-scale-table">
      <thead><tr><th>Step</th><th>Size</th><th>Leading</th><th>Weight</th></tr></thead>
      <tbody id="type-scale-body"></tbody>
    </table>
  </div>
</details>

<!-- COLOR PALETTE -->
<details class="token-section" open>
  <summary><h3 style="margin:0">Color Palette <span style="font-size:10px;font-weight:400;color:var(--text-muted);margin-left:6px">50–900</span></h3></summary>
  <div style="margin-top:12px">
    <div class="tab-bar" id="palette-tabs">
      <button class="tab-btn active" data-tab="brand" onclick="switchPaletteTab('brand')">brand</button>
      <button class="tab-btn" data-tab="neutral" onclick="switchPaletteTab('neutral')">neutral</button>
      <button class="tab-btn" data-tab="success" onclick="switchPaletteTab('success')">success</button>
      <button class="tab-btn" data-tab="warning" onclick="switchPaletteTab('warning')">warning</button>
      <button class="tab-btn" data-tab="error" onclick="switchPaletteTab('error')">error</button>
      <button class="tab-btn" data-tab="info" onclick="switchPaletteTab('info')">info</button>
    </div>
    <div id="palette-content"></div>
    <button class="btn-sm" onclick="autogeneratePalette()" style="margin-top:8px;font-size:10px">✦ Autogenerate from brand color</button>
  </div>
</details>

<!-- SEMANTIC COLORS -->
<details class="token-section" open>
  <summary><h3 style="margin:0">Semantic Colors</h3></summary>
  <div id="semantic-colors-grid" style="margin-top:12px"></div>
</details>

<!-- SHADOWS & GLOW -->
<details class="token-section" open>
  <summary><h3 style="margin:0">Shadows & Glow</h3></summary>
  <div id="shadows-list" style="margin-top:12px"></div>
</details>

<!-- VISUAL EFFECTS -->
<details class="token-section" open>
  <summary><h3 style="margin:0">Visual Effects</h3></summary>
  <div id="effects-list" style="margin-top:12px"></div>
</details>

<!-- COMPONENTS -->
<details class="token-section" open>
  <summary><h3 style="margin:0">Components</h3></summary>
  <div style="margin-top:12px">
    <div class="tab-bar" id="comp-tabs">
      <button class="tab-btn active" data-comp="button" onclick="switchCompTab('button')">button</button>
      <button class="tab-btn" data-comp="card" onclick="switchCompTab('card')">card</button>
      <button class="tab-btn" data-comp="input" onclick="switchCompTab('input')">input</button>
      <button class="tab-btn" data-comp="badge" onclick="switchCompTab('badge')">badge</button>
    </div>
    <div id="comp-content"></div>
  </div>
</details>

<!-- ASSETS -->
<details class="token-section" open>
  <summary><h3 style="margin:0">Assets</h3></summary>
  <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
    <div class="token-row"><label>Logo URL</label><input type="text" id="asset-logo-url" class="text-input" placeholder="https://..." oninput="setAsset('logoUrl',this.value)"></div>
    <div class="token-row"><label>Wordmark URL</label><input type="text" id="asset-wordmark" class="text-input" placeholder="https://..." oninput="setAsset('logoWordmark',this.value)"></div>
    <div class="token-row">
      <label>Icon Library</label>
      <div style="display:flex;gap:10px;margin-top:4px">
        <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="icon-lib" value="lucide" onchange="setAsset('iconLibrary','lucide')"> Lucide</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="icon-lib" value="phosphor" onchange="setAsset('iconLibrary','phosphor')"> Phosphor</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="radio" name="icon-lib" value="heroicons" onchange="setAsset('iconLibrary','heroicons')"> Heroicons</label>
      </div>
    </div>
    <div class="token-row">
      <label>Tech Logos</label>
      <div id="tech-logos-tags" class="tag-list"></div>
      <input type="text" id="tech-logo-input" class="text-input" placeholder="nextjs, typescript… press Enter" style="margin-top:4px"
        onkeydown="if(event.key==='Enter'){addTechLogo(this.value.trim());this.value=''}">
    </div>
  </div>
</details>
```

**Step 3: Remove old simple Typography section**

Find and remove the old `<div class="token-section">` block that contains `<h3>Typography</h3>` and `<div class="token-grid" id="fonts-grid"></div>`. It is replaced by the new `<details>` version above.

**Step 4: Convert existing sections to details if desired**

The Colors, Spacing Scale, Border Radius sections can remain as `<div class="token-section">` — no change needed.

**Step 5: Commit**

```bash
git add packages/codegraph/public/ds-studio/index.html
git commit -m "feat(ds-studio): add 7 new token sections to right panel — palette/semantic/shadows/effects/components/assets/typography"
```

---

### Task 7: DS Studio JS — state + render + collect + save/load

**Files:**
- Modify: `packages/codegraph/public/ds-studio/ds-studio.js`

**Context:** The `tokens` state object and all functions that read/write it need to be extended. Key functions: `loadDs()`, `newDs()`, `applyTokens()`, `runImport()`, `saveDs()`, `renderAll()`.

**Step 1: Extend the default tokens state**

Replace the `let tokens = { ... }` block:

```javascript
let tokens = {
  colors: {
    primary: '#6366f1', secondary: '#8b5cf6', accent: '#a78bfa',
    background: '#08080d', surface: '#0e0e16', text: '#d0d0d0',
    textMuted: '#777', border: '#1a1a2a', error: '#f87171',
    success: '#34d399', warning: '#f59e0b',
  },
  fonts: { sans: 'Inter', mono: 'JetBrains Mono', heading: 'Inter', baseSize: '16px', lineHeight: '1.5' },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px' },
  radius: { sm: '4px', md: '8px', lg: '16px', full: '9999px' },
  darkMode: true,
  // New categories
  palette: {
    brand:   { '50':'#faf5ff','100':'#f3e8ff','200':'#e9d5ff','300':'#d8b4fe','400':'#c084fc','500':'#a855f7','600':'#9333ea','700':'#7e22ce','800':'#6b21a8','900':'#581c87' },
    neutral: { '50':'#f8fafc','100':'#f1f5f9','200':'#e2e8f0','300':'#cbd5e1','400':'#94a3b8','500':'#64748b','600':'#475569','700':'#334155','800':'#1e293b','900':'#0f172a' },
    success: { '50':'#f0fdf4','500':'#22c55e','900':'#14532d' },
    warning: { '50':'#fffbeb','500':'#f59e0b','900':'#78350f' },
    error:   { '50':'#fef2f2','500':'#ef4444','900':'#7f1d1d' },
    info:    { '50':'#eff6ff','500':'#3b82f6','900':'#1e3a5f' },
  },
  semanticColors: {
    text:     { primary: '#d0d0d0', secondary: '#999', muted: '#666' },
    bg:       { base: '#08080d', surface: '#0e0e16', overlay: '#1a1a2a' },
    border:   { default: '#1a1a2a', focus: '#a78bfa' },
    feedback: { success: '#34d399', warning: '#f59e0b', error: '#f87171', info: '#60a5fa' },
  },
  shadows: {
    sm:   '0 1px 2px rgba(0,0,0,0.3)',
    md:   '0 4px 6px -1px rgba(0,0,0,0.4)',
    lg:   '0 10px 15px -3px rgba(0,0,0,0.5)',
    xl:   '0 20px 25px -5px rgba(0,0,0,0.5)',
    glow: '0 0 20px rgba(167,139,250,0.4)',
  },
  typography: {
    families: { sans: 'Inter', mono: 'JetBrains Mono', heading: 'Inter' },
    scale: {
      xs:   { size: '0.75rem',  leading: '1rem' },
      sm:   { size: '0.875rem', leading: '1.25rem' },
      base: { size: '1rem',     leading: '1.5rem' },
      lg:   { size: '1.125rem', leading: '1.75rem' },
      xl:   { size: '1.25rem',  leading: '1.75rem' },
      '2xl':{ size: '1.5rem',   leading: '2rem' },
      '3xl':{ size: '1.875rem', leading: '2.25rem' },
      '4xl':{ size: '2.25rem',  leading: '2.5rem' },
    },
    weights: { normal: '400', medium: '500', semibold: '600', bold: '700' },
  },
  effects: {
    aurora:         { preset: 'soft',        customCss: '' },
    gradientBorder: { preset: 'purple-blue',  customCss: '' },
    glow:           { preset: 'purple',       customCss: '' },
  },
  components: {
    button: { radius: '0.375rem', paddingX: '1rem',    paddingY: '0.5rem',   fontWeight: '600', fontSize: '0.875rem' },
    card:   { radius: '0.75rem',  padding:  '1.5rem',  shadow: 'md' },
    input:  { radius: '0.375rem', paddingX: '0.75rem', paddingY: '0.5rem',  fontSize: '0.875rem' },
    badge:  { radius: '9999px',   paddingX: '0.625rem',paddingY: '0.125rem',fontSize: '0.75rem', fontWeight: '500' },
  },
  assets: {
    logoUrl: '', logoWordmark: '', brandImageryUrls: [], iconLibrary: 'lucide', techLogos: [],
  },
}
let currentPaletteTab = 'brand'
let currentCompTab = 'button'
```

**Step 2: Extend renderAll()**

```javascript
function renderAll() {
  renderColors()
  renderTypography()    // replaces renderFonts()
  renderSpacing()
  renderRadius()
  renderPalette()
  renderSemanticColors()
  renderShadows()
  renderEffects()
  renderComponents()
  renderAssets()
  updatePreview()
}
```

Remove `renderFonts` call (renamed to `renderTypography`).

**Step 3: Add renderTypography()**

```javascript
function renderTypography() {
  // Families grid
  renderGrid('type-families-grid', tokens.typography.families ?? {}, 'setTypoFamily')
  // Scale table
  const tbody = document.getElementById('type-scale-body')
  if (!tbody) return
  const scale = tokens.typography.scale ?? {}
  tbody.innerHTML = Object.entries(scale).map(([step, vals]) => `
    <tr>
      <td>${step}</td>
      <td><input value="${vals.size}" oninput="setTypoScale('${step}','size',this.value)" style="width:70px"></td>
      <td><input value="${vals.leading ?? ''}" oninput="setTypoScale('${step}','leading',this.value)" style="width:55px"></td>
      <td><input value="${(tokens.typography.weights ?? {}).normal ?? ''}" style="width:45px" disabled></td>
    </tr>
  `).join('')
}
window.setTypoFamily = (k, v) => { tokens.typography.families ??= {}; tokens.typography.families[k] = v; updatePreview() }
window.setTypoScale = (step, prop, v) => {
  tokens.typography.scale ??= {}
  tokens.typography.scale[step] ??= { size: '' }
  tokens.typography.scale[step][prop] = v
  updatePreview()
}
```

**Step 4: Add renderPalette() and autogenerate**

```javascript
function renderPalette() {
  const group = currentPaletteTab
  const shades = tokens.palette[group] ?? {}
  const SHADES = ['50','100','200','300','400','500','600','700','800','900']
  document.getElementById('palette-content').innerHTML = `
    <div class="shade-row">
      <span class="shade-row-label">${group}</span>
      ${SHADES.map(s => `
        <div class="shade-cell">
          <input type="color" value="${shades[s] ?? '#cccccc'}" oninput="setPaletteShade('${group}','${s}',this.value)">
          <span>${s}</span>
        </div>
      `).join('')}
    </div>
  `
}
window.switchPaletteTab = (tab) => {
  currentPaletteTab = tab
  document.querySelectorAll('#palette-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
  renderPalette()
}
window.setPaletteShade = (group, shade, val) => {
  tokens.palette[group] ??= {}
  tokens.palette[group][shade] = val
  updatePreview()
}
window.autogeneratePalette = () => {
  const base = tokens.palette.brand?.['500'] ?? tokens.colors.primary ?? '#6366f1'
  // Simple hue-based shade generation
  const hex2rgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]
  const rgb2hex = (r,g,b) => '#' + [r,g,b].map(x => Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,'0')).join('')
  const [r,g,b] = hex2rgb(base)
  const lightFactors = { '50':0.95,'100':0.9,'200':0.8,'300':0.65,'400':0.4,'500':0,'600':-0.15,'700':-0.3,'800':-0.45,'900':-0.6 }
  const generated = {}
  for (const [shade, f] of Object.entries(lightFactors)) {
    const dr = f > 0 ? (255 - r) * f : -r * Math.abs(f)
    const dg = f > 0 ? (255 - g) * f : -g * Math.abs(f)
    const db = f > 0 ? (255 - b) * f : -b * Math.abs(f)
    generated[shade] = rgb2hex(r + dr, g + dg, b + db)
  }
  tokens.palette.brand = generated
  renderPalette()
  setStatus('Brand palette autogenerated — review and save', 'ok')
}
```

**Step 5: Add renderSemanticColors()**

```javascript
function renderSemanticColors() {
  const el = document.getElementById('semantic-colors-grid')
  if (!el) return
  const groups = ['text','bg','border','feedback']
  el.innerHTML = groups.map(cat => {
    const roles = tokens.semanticColors[cat] ?? {}
    return `
      <div style="margin-bottom:10px">
        <div class="l-label" style="margin-bottom:5px">${cat}</div>
        ${Object.entries(roles).map(([role, val]) => `
          <div class="color-row">
            <input type="color" value="${val}" oninput="setSemanticColor('${cat}','${role}',this.value)">
            <span class="color-name">${cat}.${role}</span>
            <input class="color-hex" type="text" value="${val}" oninput="setSemanticColor('${cat}','${role}',this.value)">
          </div>
        `).join('')}
      </div>
    `
  }).join('')
}
window.setSemanticColor = (cat, role, val) => {
  tokens.semanticColors[cat] ??= {}
  tokens.semanticColors[cat][role] = val
  updatePreview()
}
```

**Step 6: Add renderShadows()**

```javascript
function renderShadows() {
  const el = document.getElementById('shadows-list')
  if (!el) return
  el.innerHTML = Object.entries(tokens.shadows).map(([name, val]) => `
    <div class="shadow-row">
      <div class="shadow-preview" id="sp-${name}" style="box-shadow:${val}"></div>
      <span style="width:32px;font-size:11px;color:var(--text-dim)">${name}</span>
      <input type="text" value="${val}" oninput="setShadow('${name}',this.value)" style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:4px 7px;font-size:11px">
    </div>
  `).join('')
}
window.setShadow = (name, val) => {
  tokens.shadows[name] = val
  const preview = document.getElementById(`sp-${name}`)
  if (preview) preview.style.boxShadow = val
  updatePreview()
}
```

**Step 7: Add renderEffects()**

```javascript
const EFFECT_PRESETS = {
  aurora: ['none','soft','vibrant','pastel'],
  gradientBorder: ['none','purple-blue','rainbow','gold'],
  glow: ['none','purple','blue','green','warm'],
}
function renderEffects() {
  const el = document.getElementById('effects-list')
  if (!el) return
  el.innerHTML = Object.entries(tokens.effects).map(([name, effect]) => {
    const presets = EFFECT_PRESETS[name] ?? ['none','soft','default']
    const cssId = `effect-css-${name}`
    return `
      <div class="effect-block">
        <div class="effect-label">${name}</div>
        <div class="effect-row">
          <select onchange="setEffect('${name}','preset',this.value)">
            ${presets.map(p => `<option value="${p}" ${effect.preset === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          <span class="effect-css-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">Edit CSS ▾</span>
        </div>
        <textarea id="${cssId}" class="text-input effect-css-area" style="display:none"
          placeholder="/* custom CSS */" oninput="setEffect('${name}','customCss',this.value)">${effect.customCss ?? ''}</textarea>
      </div>
    `
  }).join('')
}
window.setEffect = (name, prop, val) => {
  tokens.effects[name] ??= {}
  tokens.effects[name][prop] = val
  updatePreview()
}
```

**Step 8: Add renderComponents()**

```javascript
function renderComponents() {
  const el = document.getElementById('comp-content')
  if (!el) return
  const comp = currentCompTab
  const fields = tokens.components[comp] ?? {}
  el.innerHTML = `<div class="token-grid">${Object.entries(fields).map(([k, v]) => `
    <div class="token-row">
      <label>${k}</label>
      <input type="text" value="${v}" oninput="setComp('${comp}','${k}',this.value)">
    </div>
  `).join('')}</div>`
}
window.switchCompTab = (comp) => {
  currentCompTab = comp
  document.querySelectorAll('#comp-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.comp === comp))
  renderComponents()
}
window.setComp = (comp, key, val) => {
  tokens.components[comp] ??= {}
  tokens.components[comp][key] = val
}
```

**Step 9: Add renderAssets()**

```javascript
function renderAssets() {
  const a = tokens.assets
  const logoEl = document.getElementById('asset-logo-url')
  const wordmarkEl = document.getElementById('asset-wordmark')
  if (logoEl) logoEl.value = a.logoUrl ?? ''
  if (wordmarkEl) wordmarkEl.value = a.logoWordmark ?? ''

  // Icon library radio
  const iconLib = a.iconLibrary ?? 'lucide'
  document.querySelectorAll('input[name="icon-lib"]').forEach(r => { r.checked = r.value === iconLib })

  // Tech logos tags
  const tagsEl = document.getElementById('tech-logos-tags')
  if (tagsEl) {
    tagsEl.innerHTML = (a.techLogos ?? []).map(t => `
      <div class="tag-chip">${t} <button onclick="removeTechLogo('${t}')">×</button></div>
    `).join('')
  }
}
window.setAsset = (key, val) => { tokens.assets[key] = val }
window.addTechLogo = (tag) => {
  if (!tag) return
  tokens.assets.techLogos = [...new Set([...(tokens.assets.techLogos ?? []), tag])]
  renderAssets()
}
window.removeTechLogo = (tag) => {
  tokens.assets.techLogos = (tokens.assets.techLogos ?? []).filter(t => t !== tag)
  renderAssets()
}
```

**Step 10: Update loadDs() to merge new fields**

In `loadDs()`, after the existing `if (ds.radius...) tokens.radius = ds.radius` lines, add:

```javascript
if (ds.palette && Object.keys(ds.palette).length) tokens.palette = ds.palette
if (ds.semanticColors && Object.keys(ds.semanticColors).length) tokens.semanticColors = ds.semanticColors
if (ds.shadows && Object.keys(ds.shadows).length) tokens.shadows = ds.shadows
if (ds.typography && Object.keys(ds.typography).length) tokens.typography = ds.typography
if (ds.effects && Object.keys(ds.effects).length) tokens.effects = ds.effects
if (ds.components && Object.keys(ds.components).length) tokens.components = ds.components
if (ds.assets && Object.keys(ds.assets).length) tokens.assets = { ...tokens.assets, ...ds.assets }
```

**Step 11: Update applyTokens() for AI-generated results**

In `applyTokens()`, after the existing fields, add:

```javascript
if (result.palette && typeof result.palette === 'object') tokens.palette = result.palette
if (result.semanticColors && typeof result.semanticColors === 'object') tokens.semanticColors = result.semanticColors
if (result.shadows && typeof result.shadows === 'object') tokens.shadows = result.shadows
if (result.typography && typeof result.typography === 'object') tokens.typography = result.typography
if (result.effects && typeof result.effects === 'object') tokens.effects = result.effects
if (result.components && typeof result.components === 'object') tokens.components = result.components
if (result.assets && typeof result.assets === 'object') tokens.assets = { ...tokens.assets, ...result.assets }
```

**Step 12: Update runImport() to merge new fields**

In `runImport()`, after the existing merge lines, add:

```javascript
if (result.palette && Object.keys(result.palette).length) {
  for (const [g, shades] of Object.entries(result.palette)) {
    tokens.palette[g] = { ...(tokens.palette[g] ?? {}), ...shades }
  }
}
if (result.semanticColors && Object.keys(result.semanticColors).length) {
  for (const [cat, roles] of Object.entries(result.semanticColors)) {
    tokens.semanticColors[cat] = { ...(tokens.semanticColors[cat] ?? {}), ...roles }
  }
}
if (result.shadows && Object.keys(result.shadows).length) tokens.shadows = { ...tokens.shadows, ...result.shadows }
if (result.typography && Object.keys(result.typography).length) {
  tokens.typography = { ...tokens.typography, ...result.typography }
}
```

**Step 13: Update saveDs() to include all new fields**

In `saveDs()`, replace the `body: JSON.stringify({ ... })` call to include new fields:

```javascript
body: JSON.stringify({
  project,
  colors: tokens.colors,
  fonts: tokens.fonts,
  spacing: tokens.spacing,
  radius: tokens.radius,
  darkMode: tokens.darkMode,
  colorFormat: 'hex',
  palette: tokens.palette,
  semanticColors: tokens.semanticColors,
  shadows: tokens.shadows,
  typography: tokens.typography,
  effects: tokens.effects,
  components: tokens.components,
  assets: tokens.assets,
}),
```

**Step 14: Update newDs() to reset new fields**

In `newDs()`, replace the `tokens = { ... }` assignment to include empty new fields:

```javascript
tokens = {
  colors: { primary: '#6366f1', background: '#ffffff', surface: '#f8fafc', text: '#0f172a', border: '#e2e8f0' },
  fonts: { sans: 'Inter', baseSize: '16px', lineHeight: '1.5' },
  spacing: { sm: '8px', md: '16px', lg: '24px' },
  radius: { sm: '4px', md: '8px', lg: '16px' },
  darkMode: false,
  palette: { brand: {}, neutral: {}, success: {}, warning: {}, error: {}, info: {} },
  semanticColors: { text: {}, bg: {}, border: {}, feedback: {} },
  shadows: { sm: '', md: '', lg: '', xl: '', glow: '' },
  typography: { families: {}, scale: {}, weights: {} },
  effects: { aurora: { preset: 'none', customCss: '' }, gradientBorder: { preset: 'none', customCss: '' }, glow: { preset: 'none', customCss: '' } },
  components: { button: {}, card: {}, input: {}, badge: {} },
  assets: { logoUrl: '', logoWordmark: '', brandImageryUrls: [], iconLibrary: 'lucide', techLogos: [] },
}
```

**Step 15: Commit**

```bash
git add packages/codegraph/public/ds-studio/ds-studio.js
git commit -m "feat(ds-studio): add render/collect/save/load logic for 7 new token sections"
```

---

### Task 8: Final integration verify

**Step 1: Run all tests**

```bash
cd packages/storage && pnpm test
cd packages/codegraph && pnpm test
```
Expected: all PASS.

**Step 2: Typecheck both packages**

```bash
cd packages/storage && pnpm exec tsc --noEmit
cd packages/codegraph && pnpm exec tsc --noEmit
```
Expected: zero errors in both.

**Step 3: Rebuild storage dist**

```bash
cd packages/storage && pnpm build
```

**Step 4: Start server and open DS Studio**

```bash
cd packages/codegraph && node dist/cli.js mcp
# Open browser to http://localhost:3000/ds-studio/
```

Manual smoke tests:
1. Right panel shows 7 new sections (all expanded by default)
2. Tab bar in palette switches between brand/neutral/success/warning/error/info
3. Autogenerate button fills brand palette shades
4. Save DS button → reload page → all new fields persist
5. Export CSS → `--color-brand-50`, `--shadow-glow`, `--font-sans` present in output
6. Export Tailwind → `boxShadow`, `fontSize`, `fontFamily` blocks present
7. Import CSS with `--shadow-sm: 0 1px 2px;` → shadows section populated after import

**Step 5: Final commit**

```bash
git add packages/storage/dist/
git commit -m "build(storage): rebuild dist after migration 031 and DesignSystem type expansion"
```
