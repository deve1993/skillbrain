# Studio UX Redesign — Design Spec

**Date:** 2026-05-07  
**Status:** Approved  
**Scope:** `packages/codegraph/public/studio/` — index.html, studio.js, connectors.js

---

## Problem

The current Studio has three fixed columns (240px left + flex center + 340px right) that leave the preview area too narrow. The chat is locked at 270px below the preview, stealing vertical space. All 12 connector buttons and export actions are dumped in the chat toolbar with no visual hierarchy. The V1/V2 toggle in the header is confusing. Everything has the same visual weight.

---

## Decisions Summary

| Dimension | Choice |
|-----------|--------|
| Layout structure | B — Tab-based conversations + large preview + bottom prompt bar |
| Right panel | Y — Config chips at top, chat dominant below |
| Generation state | B — Pipeline progress showing skills used |
| New conversation | Brief optional as side sheet (`⚙ Brief` button) |
| Export & Connectors | 1 — Preview toolbar: `HTML` `ZIP` always visible + `Deploy ▾` dropdown |

---

## Layout

### Header (44px)

```
[ ⬡ Studio ]  [ Landing hero ✕ ]  [ Dashboard ✕ ]  [ + ]  ···  [ ⚡ Generate ]
```

- **Logo** left: "⬡ Studio" with gradient text (reuses SkillBrain purple)
- **Tab bar** center: one tab per conversation, horizontally scrollable on overflow. Each tab has a status dot (idle = dashed border, generating = purple pulse, done = green solid) and a close `✕` button. A `+` button opens a new tab.
- **Generate button** right: always visible, gradient purple. Disabled with `opacity: 0.5` during generation.

Tabs replace the left sidebar entirely. No more `conv-sidebar`.

### Main area (flex: 1, overflow hidden)

Two columns:

1. **Preview column** (`flex: 1`, min-width 0)
2. **Right panel** (`width: 280px`, fixed)

### Preview column

**Preview toolbar (36px):**

```
PREVIEW  ···  [↻]  [⤢]  |  [HTML]  [ZIP]  |  [Deploy ▾]
```

- `HTML` and `ZIP`: export buttons, purple tint. Appear always but are `opacity: 0.3` / `pointer-events: none` until an artifact exists.
- `Deploy ▾`: dropdown with all configured connectors. Same disable behavior. On click opens a popover list with connector name + colored dot. Only shows connectors that have credentials configured.

**Preview body (flex: 1):** Three states, toggled by JS:

- **Empty** — centered icon + "Start a conversation / Generate a design to see it here"
- **Generating** — centered concentric pulse rings with SkillBrain logo, "Generazione in corso…" subtitle. Preview stays empty until HTML is complete.
- **Done** — iframe rendering the artifact HTML at full height.

### Right panel (280px)

**Config bar (top, ~36px):**

```
[ Landing ]  [ Tailwind ]  [ Minimal ]  ···  [ ✎ edit ]
```

- Selected picks (skill + design system + direction) shown as purple chips.
- `✎ edit` button: opens a side sheet (slides in from right over the panel) showing the full pickers — skill pills, DS pills, direction pills, model selectors. Closes with `✕` or click-outside.
- On new conversation with no picks yet, shows `[ + Add skill ]  [ + Add DS ]` placeholder chips.

**Chat area (flex: 1, overflow-y: auto):**

Three states:

- **Empty** — centered ghost icon + "La chat apparirà qui dopo la generazione"
- **Generating** — shows user message bubble + pipeline block (see below) below it
- **Done** — user message + collapsed pipeline (all steps done) + AI response bubble. Subsequent iterations append more message pairs.

**Pipeline block** (shown during and after generation):

```
✓  Brief analizzato
✓  Contesto SkillBrain caricato
✓  Skill applicata                      [ nextjs-developer ]
⟳  Generazione HTML…                    (spinner)
○  Critique
○  Completato
```

- Each step has an icon: `✓` green (done), animated spinner (active), `○` muted (pending).
- The skill step shows the actual skill name as a purple badge on the right.
- When generation finishes, all steps show `✓` and the pipeline collapses to a single summary line after 3 seconds: "✓ Completato con nextjs-developer · 8.2/10".

**Critique bar (bottom of right panel, 28px):**

```
CRITIQUE   [ 8.2 / 10 ]   ···   ▾ dettaglio
```

Hidden until generation completes. `▾ dettaglio` expands an inline section below showing per-dimension scores (the existing critique rows).

### Bottom bar

```
[ ⚙ Brief ]  [ textarea: "Descrivi cosa generare…"                    ]  [ ↵ Send ]
```

- Always visible, full width.
- **`⚙ Brief` button**: opens the Brief side sheet (multi-field form: Surface, Audience, Tone, Brand, Scale). Same sheet as `✎ edit` but Brief tab active. Brief is optional — user can ignore it entirely.
- **Textarea**: auto-grows up to ~80px (3 lines). `Enter` sends, `Shift+Enter` adds newline. Placeholder changes context: "Descrivi cosa generare…" when empty, "Itera sul risultato…" after first generation.
- **Send button**: submits the message. If no job is running, also triggers generation. If a job is running, queues as next iteration.

---

## Brief Side Sheet

- Slides in from the right, overlaying the right panel (not the preview).
- Width: 280px (same as right panel — replaces it visually).
- Fields: Surface (select: landing / dashboard / form / email / component), Audience (text), Tone (select: professional / casual / bold / minimal), Brand (text), Scale (select: MVP / full).
- All fields optional. `Skip & generate` closes without filling anything. `Apply brief` saves and closes.
- Triggered by: `⚙ Brief` in bottom bar, `✎ edit` chips bar, automatically on first conversation creation (collapses if user types in prompt bar instead).

---

## State Machine

```
idle ──[Generate click]──> generating ──[SSE done]──> done
                              │
                        [SSE error / Stop]──> error (shows retry)

done ──[Send prompt]──> generating  (iteration)
done ──[New tab]──> idle (new conversation)
```

During `generating`:
- `Generate` button disabled
- `HTML`, `ZIP`, `Deploy ▾` disabled (opacity 0.3)
- Prompt textarea shows "In attesa del completamento…" placeholder and is disabled
- Tab dot pulses purple

During `error`:
- Preview shows error state with message + `↻ Retry` button
- Pipeline shows the failed step in red

---

## Removed from current UI

| Element | Reason |
|---------|--------|
| Left `conv-sidebar` (240px) | Replaced by header tabs |
| `V1 / V2` layout toggle | Confusing, removed entirely |
| Chat toolbar with export buttons | Replaced by preview toolbar |
| Fixed 270px chat section | Chat now flexible height in right panel |
| `v0.4 alpha` pill in header | Internal detail, removed |
| `Project picker` at bottom of composer | Replaced by SkillBrain session context (always current project) |

---

## Files to Change

| File | Change |
|------|--------|
| `public/studio/index.html` | Full rewrite of HTML structure and CSS |
| `public/studio/studio.js` | Router/state machine, tab management, SSE handling, pipeline rendering |
| `public/studio/connectors.js` | Update connector bar rendering to populate `Deploy ▾` dropdown |

Backend (routes, MCP tools, store) unchanged — this is a frontend-only redesign.

---

## Non-Goals

- Mobile layout (desktop-only tool)
- Dark/light theme toggle
- Drag-to-resize panels
- Real-time collaboration
- Any backend changes
