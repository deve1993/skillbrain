# Design System Studio — Design Doc

**Date:** 2026-05-08  
**Status:** Approved  

---

## Context

Studio currently embeds `/studio/` (HTML prototype generator) in an iframe. The page needs to become the primary design system creation and management interface — inspired by Claude Design — while keeping the prototype generator accessible as a second tab.

Design systems saved here are consumed by Claude Code sessions via the existing `design_system_get` MCP tool.

---

## Layout

Studio page replaces the current iframe approach with an inline two-tab UI:

```
[Design System]  [Prototype Generator]
```

- **Design System tab** — new DS editor (built inline, replaces current `renderStudio`)
- **Prototype Generator tab** — iframe `/studio/` exactly as today, zero changes

---

## Design System Tab Layout

Two-column split, full viewport height:

```
LEFT (320px fixed)                RIGHT (flex-1)
──────────────────────            ─────────────────────────────
[▾ Select DS]  [+ New]            COLORS
                                  ● primary  #6366f1  [picker]
── GENERATE ──────────            ● surface  #0f172a  [picker]
[brief textarea]                  ● accent   #a855f7  [picker]
[▸ Generate with AI]              [+ Add color]

── IMPORT ─────────────           TYPOGRAPHY
[Figma] [CSS vars]                Family: Inter  [input]
[Tailwind] [JSON]                 Base: 16px · 1.5 line-height

── EXPORT ─────────────           SPACING SCALE
[CSS vars] [JSON]                 4 · 8 · 12 · 16 · 24 · 32
[Tailwind config]
                                  RADIUS
                                  sm:4px  md:8px  lg:16px

                                  ── PREVIEW ───────────────
                                  [sandboxed iframe: sample HTML
                                   rendered with live token CSS]

                                  [project name input]  [Save DS]
```

---

## AI Generation Flow

1. User writes brief in textarea (e.g. "Dark SaaS, purple accent, Inter, minimal")
2. Click **Generate** → `POST /api/studio/ds/generate` → creates `DsGenJob`
3. Backend spawns Claude Code CLI (same `localProviderOverrides` / credential resolution already implemented in `studio-runner.ts`)
4. System prompt instructs model to return **only valid JSON** matching the DS schema
5. SSE stream at `GET /api/studio/ds/stream/:jobId` — chunks accumulate, UI tries `JSON.parse` on each snapshot, progressively populates token editor
6. On `done` event, final JSON is parsed and tokens are rendered in right panel
7. User edits any token inline → click **Save DS** → `ComponentsStore.upsertDesignSystem`

---

## Import Sources

| Source | Implementation |
|--------|----------------|
| **JSON** (W3C / Style Dictionary) | Server-side parser: `POST /api/studio/ds/import/json` — maps `$value` / flat keys onto DS fields |
| **CSS variables** | Regex on `--color-*`, `--font-*`, `--spacing-*` → categorized → `POST /api/studio/ds/import/css` |
| **Tailwind config** | Extract `theme.colors`, `theme.fontFamily`, `theme.spacing` via `Function()` eval of the `theme` export → `POST /api/studio/ds/import/tailwind` |
| **Figma** | `GET /api/studio/ds/import/figma?url=<figmaUrl>` — backend calls Figma MCP tool `get_variable_defs`, maps Figma variable collections to DS fields |

All import endpoints return a DS-shaped JSON object. The frontend populates the editor — does **not** auto-save. User still clicks Save.

---

## Export

| Format | Endpoint | Output |
|--------|----------|--------|
| CSS custom properties | `GET /api/design-systems/:project/export/css` | `:root { --color-primary: ...; }` block |
| W3C Design Tokens JSON | `GET /api/design-systems/:project/export/json` | `{ "color": { "primary": { "$value": "#..." } } }` |
| Tailwind config | `GET /api/design-systems/:project/export/tailwind` | `module.exports = { theme: { colors: {...} } }` |

---

## DS Preview (iframe)

The right panel's preview iframe renders a static HTML sample that imports the current token values as inline CSS custom properties. Updated live on every token change via `srcdoc` reassignment. No external requests — fully sandboxed.

Sample HTML: a card, a button (primary + secondary), a heading, body text — sufficient to validate color + typography tokens at a glance.

---

## Backend New Pieces

### New routes (`/api/studio/ds/*`) in a new route file `routes/studio-ds.ts`:
- `POST /api/studio/ds/generate` — create DsGenJob, enqueue runner
- `GET /api/studio/ds/stream/:jobId` — SSE
- `POST /api/studio/ds/import/json`
- `POST /api/studio/ds/import/css`
- `POST /api/studio/ds/import/tailwind`
- `GET /api/studio/ds/import/figma`
- `GET /api/design-systems/:project/export/css`
- `GET /api/design-systems/:project/export/json`
- `GET /api/design-systems/:project/export/tailwind`

### New `DsRunner` (in `studio-runner.ts` or a new `ds-runner.ts`):
- Reuses `resolveCredentials` and `localProviderOverrides` from `studio-runner.ts`
- System prompt forces JSON-only output with explicit DS schema
- Parses streamed text into JSON after `done` event
- Stores result in a lightweight `ds_gen_jobs` table (or in-memory Map since jobs are short-lived)

### Migration `030_ds_gen_jobs.sql`:
```sql
CREATE TABLE IF NOT EXISTS ds_gen_jobs (
  id         TEXT PRIMARY KEY,
  status     TEXT DEFAULT 'pending',
  brief      TEXT,
  result_json TEXT,
  error_msg  TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## What Stays Unchanged

- `ComponentsStore.upsertDesignSystem` — save target, no changes
- `design_system_get` MCP tool — already works, zero changes
- `studio-runner.ts` — reused, not modified (DsRunner is a sibling)
- `/studio/` app (HTML prototype generator) — iframe in tab 2, untouched
- `#/design-systems` page — still exists for list/merge/pending review

---

## Integration with Sessions

Design systems are stored in the `design_systems` table keyed by `project`. Claude Code sessions call `design_system_get({ project })` which returns the full token set. No new work required — the MCP tool already exists and is documented.
