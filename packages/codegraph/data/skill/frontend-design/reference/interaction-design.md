# Interaction Design

## The Eight Interactive States

Every interactive element needs all 8 states designed:

| State | When | Visual Treatment |
|-------|------|------------------|
| **Default** | At rest | Base styling |
| **Hover** | Pointer over (not touch) | Subtle lift, color shift |
| **Focus** | Keyboard/programmatic focus | Visible ring (see below) |
| **Active** | Being pressed | Pressed in, darker |
| **Disabled** | Not interactive | Reduced opacity, `cursor: not-allowed` |
| **Loading** | Processing | Spinner or skeleton, no flicker |
| **Error** | Invalid state | Red border, icon, message |
| **Success** | Completed | Green check, confirmation |

**The common miss**: Designing hover without focus, or vice versa. Keyboard users never see
hover states.

---

## Focus Rings: Do Them Right

**Never `outline: none` without replacement.** It's an accessibility violation.
Use `:focus-visible` to show focus only for keyboard users:

```css
/* Remove for mouse/touch */
button:focus {
  outline: none;
}

/* Show for keyboard navigation */
button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

**Focus ring design rules:**
- High contrast (3:1 minimum against adjacent colors)
- 2–3px thick
- Offset from element (not inside it)
- Consistent across ALL interactive elements

---

## Form Design: The Non-Obvious

- **Placeholders aren't labels** — they disappear on input. Always use visible `<label>`
- **Validate on blur**, not on every keystroke (exception: password strength meter)
- Place errors **below** fields with `aria-describedby` connecting them
- Show format requirements via placeholder, not instructions

```html
<div class="field">
  <label for="email">Email address</label>
  <input
    id="email"
    type="email"
    placeholder="you@example.com"
    aria-describedby="email-error"
  />
  <span id="email-error" role="alert" class="error" hidden>
    Please include an @ symbol in the email address
  </span>
</div>
```

---

## Loading States

**Optimistic updates**: Show success immediately, rollback on failure.
Use for low-stakes actions (likes, follows). Never for payments or destructive actions.

**Skeleton screens > spinners** — they preview content shape and feel faster:

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface-2) 25%,
    var(--surface-3) 50%,
    var(--surface-2) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## Modals: The Inert Approach

Use the `inert` attribute for focus trapping (no complex JavaScript):

```html
<!-- When modal is open, main content can't be focused -->
<main inert><!-- ... --></main>

<dialog open>
  <h2>Modal Title</h2>
  <!-- Focus stays inside -->
</dialog>
```

Or use native `<dialog>` element:

```js
const dialog = document.querySelector('dialog');
dialog.showModal(); // Opens with focus trap, closes on Escape
```

---

## Dropdown Positioning: The #1 Bug

Dropdowns rendered with `position: absolute` inside `overflow: hidden` containers **will be
clipped**. Use one of these solutions:

### Native Popover API (Recommended)

```html
<button popovertarget="menu">Open menu</button>
<div id="menu" popover>
  <button>Option 1</button>
  <button>Option 2</button>
</div>
```

The `popover` attribute places the element in the **top layer** — above all content,
regardless of z-index or overflow. No portal needed.

### Portal / Teleport Pattern

```tsx
// React
createPortal(dropdown, document.body)

// Vue
<Teleport to="body">...</Teleport>

// Svelte
// Mount to document.body manually
```

### Anti-Patterns

- `position: absolute` inside `overflow: hidden` → dropdown is clipped
- Arbitrary `z-index: 9999` → use semantic z-index scale
- Rendering inline without escape hatch from parent stacking context

---

## Keyboard Navigation

### Roving Tabindex

For component groups (tabs, menu items, radio groups):

```html
<div role="tablist">
  <button role="tab" tabindex="0">Tab 1</button>
  <button role="tab" tabindex="-1">Tab 2</button>
  <button role="tab" tabindex="-1">Tab 3</button>
</div>
```

Arrow keys move `tabindex="0"` between items. Tab moves to the next component.

### Skip Links

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

```css
.skip-link {
  position: absolute;
  transform: translateY(-100%);
  transition: transform 200ms;
}

.skip-link:focus {
  transform: translateY(0);
}
```

---

## Destructive Actions: Undo > Confirm

**Undo is better than confirmation dialogs** — users click through confirmations mindlessly.

Pattern:
1. Remove from UI immediately
2. Show "Deleted. Undo?" toast (5s)
3. Actually delete after toast expires

Use confirmation only for: truly irreversible actions (account deletion), high-cost operations,
batch operations affecting many items.

---

**Avoid**: Removing focus indicators. Placeholder as labels. Touch targets <44×44px.
Generic error messages ("Something went wrong"). Custom controls without ARIA.
Hover-only interactions.
