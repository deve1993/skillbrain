# Whiteboard — 6 Visual & Conceptual Improvements

**Date:** 2026-05-10  
**Status:** Approved  
**Scope:** `packages/codegraph/public/whiteboard/` + `src/mcp/whiteboard-templates.ts`

---

## Overview

Six targeted improvements to the Synapse whiteboard — three visual (frames, dark mode, thumbnails) and three interaction (inspector drawer, tool dock grouping, multi-select alignment). All improvements work within the existing idempotent render architecture (no state model changes required beyond minor additions).

---

## 1. Inspector Drawer (above tool dock)

### What
A contextual properties bar that rises above the bottom floating tool dock whenever one or more nodes are selected. It disappears on deselect. Centered, same horizontal position as the dock.

### Controls exposed (by node type)

| Node type | Controls |
|-----------|----------|
| `sticky` | BG color swatches (6), font size slider (8–32px), border style toggle (none/solid/dashed/dotted), border color picker, opacity slider |
| `frame` | BG color swatches, opacity slider (0–40%), border style + color |
| `connector` | Stroke color picker, line style toggle (solid/dashed/dotted) |
| `code` | Language selector dropdown |
| `shape` | Fill color, stroke color, stroke width |
| `image` | Opacity slider |
| `emoji` | (no controls — just shows type label) |

### Implementation details
- DOM: a `<div id="wb-inspector-drawer">` positioned `fixed`, `bottom: 64px`, `left: 50%`, `transform: translateX(-50%)`.
- Visibility: toggled via CSS class `wb-inspector-visible` added/removed in `updateFloatingToolbar()` in `main.js`.
- Color swatches: predefined palette `['#fef3c7','#dcfce7','#dbeafe','#fce7f3','#e0e7ff','#f1f5f9']` + a native `<input type="color">` hidden, triggered by a "+" swatch.
- Sliders: `<input type="range">` styled with CSS. On `input` event → `patchNode(id, { fontSize: val })` + schedule save.
- Border style buttons: 3-button segmented control → `patchNode(id, { borderColor, borderStyle })`. For connectors: `patchConnector(id, { style })`.
- Multi-selection: when >1 node selected of the same type, show only shared controls. BG color applies to all; sliders show the first node's value.
- Drawer animates in with `transform: translateY(8px) → 0` + `opacity: 0 → 1` (120ms ease-out).

### New helper needed
`patchConnector(id, patch)` in `state.js` — mirrors `patchNode` but targets `connectors` array.

---

## 2. Frame Header Strip (visual redesign)

### What
Replace the floating `wb-frame-label` badge with a structural header strip that is part of the frame layout. The strip is always visible, uses the frame's color (tinted at 0.18 opacity) as background, and shows the name + node count.

### Visual spec
- Strip height: **26px**, pinned to top of frame, full width
- Background: `hexToRgba(frame.color, 0.18)` — same function already in render.js
- Bottom border: `1.5px solid hexToRgba(frame.color, 0.25)`
- Left icon: 10×10px rounded square, `hexToRgba(frame.color, 0.5)` — visual type indicator
- Name: 11px 700 weight, color derived from frame color at full opacity (darkened, use `getContrastColor` on header bg)
- Node count: right-aligned, 9px, same color at 0.7 opacity — counts nodes whose bounding box overlaps the frame
- Frame border: solid `1.5px` at `hexToRgba(frame.color, 0.4)` replacing the current dashed rgba border
- Frame background fill: `hexToRgba(frame.color, 0.04)` (unchanged from current formula)

### CSS changes
- Remove `.wb-frame-label` absolute positioning
- Add `.wb-frame-header` as a flex row inside `.wb-frame` (frame becomes `flex-direction: column`)
- `.wb-frame` loses `overflow: visible !important` — clips to rounded corners
- Body content area: remaining height after header

### Template changes
Frames in `whiteboard-templates.ts` already have `color` set — no data changes needed.

---

## 3. SVG Thumbnail Auto-generation

### What
When a board is saved, generate an SVG thumbnail representing the board layout. Store it as a column `thumbnail_svg TEXT` on the `whiteboards` table. Render it in the list-page cards instead of "No preview".

### Server-side generation (`whiteboards.ts`)
Function `generateThumbnail(stateJson)`:
1. Parse `nodes` + `connectors` from `state_json`
2. Compute world bounding box of all nodes
3. Scale to fit `200×100` viewBox with 5% padding
4. Render:
   - Frames: `<rect>` with fill = `hexToRgba(color, 0.15)`, stroke = `hexToRgba(color, 0.4)`, `stroke-width="1"`, `rx="3"`
   - Frame header: thin colored `<rect>` at top (h=proportional 12%)
   - Stickies + other nodes: `<rect>` with proportional fill color
   - Connectors: `<path>` as straight line `stroke-opacity="0.5"` (no bezier needed at thumbnail scale)
   - Background: `<rect width="200" height="100" fill="#0f172a"/>` (dark card background)
5. Return SVG string

### When to generate
- After every successful `PUT /api/whiteboards/:id` (save endpoint) — run `generateThumbnail` and update `thumbnail_svg` column
- On board creation with a template — generate from template nodes

### Migration
`ALTER TABLE whiteboards ADD COLUMN thumbnail_svg TEXT;` — nullable, no default needed.

### List page rendering
Replace "No preview" placeholder with `<div class="wb-thumb" innerHTML={thumbnail_svg}>` when column is non-null. Sanitize SVG before inserting (strip scripts/foreignObjects).

---

## 4. Dark Canvas Mode

### What
A 🌙 toggle button in the topbar switches the canvas (only) between light and dark mode. Sidebar and topbar remain light. Preference persisted in `localStorage`.

### Implementation
- Toggle adds/removes class `wb-dark-canvas` on `#wb-canvas-container`
- CSS variables under `.wb-dark-canvas`:
  - `--wb-canvas-bg: #0f172a`
  - `--wb-grid-color: rgba(99,102,241,0.25)` (indigo tint instead of slate)
  - `--wb-node-default-bg: rgba(253,230,138,0.12)` (stickies: semi-transparent warm tint)
  - `--wb-node-border: rgba(255,255,255,0.08)`
  - `--wb-node-shadow: 0 1px 3px rgba(0,0,0,0.4)`
- Sticky nodes in dark mode: text color auto-computed (`getContrastColor`) still applies; bg color swatches rendered at 0.15 opacity against dark bg. Explicit `color` stored in state remains unchanged.
- Frame header in dark mode: header bg at 0.25 opacity (slightly more visible than light 0.18).
- Persistence: `localStorage.setItem('wb-dark', '1')` on toggle; read on page load.
- Topbar button: `<button id="btn-dark-toggle">🌙</button>` — becomes ☀️ when dark active.

---

## 5. Tool Dock — Semantic Groups

### What
Add visual dividers between 5 logical groups. Add tooltip with tool name + keyboard shortcut on hover. No icons change — only grouping and tooltip additions.

### Groups
| Group | Tools | Shortcuts |
|-------|-------|-----------|
| Selection | Cursor | V |
| Canvas objects | Sticky, Frame, Code | S, F, K |
| Connectors | Arrow connector, Line | C, L |
| Shapes | Rect, Ellipse, Triangle | — |
| Media + extras | Image, Emoji, Vote | — |

### Implementation
- `<div class="wb-tooldock-divider">` already exists in CSS — just add them between groups in `main.js` HTML template for the dock
- Tooltip: use the existing `initTooltips()` system — add `data-tip` and `data-tip-key` attributes to each `.wb-tool` button
- No functional changes to tool behavior

---

## 6. Multi-select Align & Distribute

### What
When ≥2 nodes are selected, show a dark alignment toolbar above the selection (similar to the connector-mode banner). Provides: align left/center-H/right, align top/center-V/bottom, distribute horizontally/vertically, group action.

### Toolbar position
Computed: center of the selection bounding box, positioned above the topmost selected node minus 44px. Clamped to viewport edges.

### Actions
| Button | Action |
|--------|--------|
| Align left | Set all `x` to `min(x)` |
| Center H | Set all `x` to center around midpoint |
| Align right | Set all `x` to `max(x+w) - w` |
| Align top | Set all `y` to `min(y)` |
| Center V | Set all `y` to center around midpoint |
| Align bottom | Set all `y` to `max(y+h) - h` |
| Distribute H | Evenly space nodes along X axis |
| Distribute V | Evenly space nodes along Y axis |
| Group | Create a `group` node wrapping the bounding box, add to state |

### Implementation
- New function `updateAlignToolbar()` called inside `updateFloatingToolbar()` when `selection.size >= 2`
- Toolbar: `<div id="wb-align-toolbar" class="wb-align-toolbar">` — separate from the existing `wb-floating-toolbar` (which handles single-node actions)
- Each action calls `patchNode` in a loop on all selected nodes + `commitHistory()`
- Distribute H: sort by `x`, compute total gap, set `x[i] = x[0] + i * (totalW + gap)` where `gap = (maxRight - minLeft - sum(widths)) / (n-1)`

---

## Files changed

| File | Change |
|------|--------|
| `public/whiteboard/render.js` | Frame header strip rendering, dark mode CSS vars application |
| `public/whiteboard/whiteboard.css` | Inspector drawer styles, frame header styles, dark canvas vars, align toolbar styles |
| `public/whiteboard/main.js` | Inspector drawer mount + update logic, dock grouping HTML, align toolbar logic, dark mode toggle |
| `public/whiteboard/state.js` | `patchConnector()` helper |
| `src/routes/whiteboards.ts` | `generateThumbnail()`, save trigger, DB column read/write |
| `src/mcp/whiteboard-templates.ts` | No changes needed |
| DB migration | `ALTER TABLE whiteboards ADD COLUMN thumbnail_svg TEXT` |

---

## Non-goals

- Undo/redo stack (separate initiative)
- Export PNG/SVG (separate initiative)
- Real-time collaborative cursor sync
- Mobile touch gestures beyond current
