# Spatial Design

## Spacing Systems

### 4pt Base (Not 8pt)

8pt systems are too coarse — you'll frequently need 12px (between 8 and 16).
Use 4pt for granularity: **4, 8, 12, 16, 24, 32, 48, 64, 96px**.

### Naming & Usage

Name tokens semantically (`--space-sm`, `--space-lg`), not by value (`--spacing-8`).
Use `gap` instead of margins for sibling spacing — eliminates margin collapse and cleanup hacks.

### Fluid Spacing

```css
/* Fluid padding that breathes on larger screens */
.section {
  padding-block: clamp(2rem, 5vw, 6rem);
}
```

---

## Grid Systems

### The Self-Adjusting Grid

```css
/* Responsive grid without breakpoints */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-lg);
}
```

For complex layouts, use named grid areas and redefine at breakpoints:

```css
.layout {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar content"
    "footer footer";
  grid-template-columns: 260px 1fr;
}

@media (max-width: 768px) {
  .layout {
    grid-template-areas:
      "header"
      "content"
      "sidebar"
      "footer";
    grid-template-columns: 1fr;
  }
}
```

---

## Visual Hierarchy

### The Squint Test

Blur your eyes (or screenshot and blur). Can you still identify:
- The most important element?
- The second most important?
- Clear groupings?

If everything looks the same weight blurred, you have a hierarchy problem.

### Hierarchy Through Multiple Dimensions

Don't rely on size alone. Combine tools:

| Tool | Strong | Weak |
|------|--------|------|
| **Size** | 3:1 ratio or more | <2:1 ratio |
| **Weight** | Bold vs Regular | Medium vs Regular |
| **Color** | High contrast | Similar tones |
| **Position** | Top/left | Bottom/right |
| **Space** | Surrounded by whitespace | Crowded |

**Best hierarchy uses 2–3 dimensions at once**: A heading that's larger, bolder, AND has more
space above it.

### Cards Are Not Required

Cards are overused. Spacing and alignment create visual grouping naturally.
Use cards only when:
- Content is truly distinct and actionable
- Items need visual comparison in a grid
- Content needs clear interaction boundaries

**Never nest cards inside cards.** Use spacing, typography, and subtle dividers for hierarchy
within a card.

---

## Container Queries

Viewport queries → page layouts. **Container queries → components**.

```css
.card-container {
  container-type: inline-size;
}

.card {
  display: grid;
  gap: var(--space-md);
}

/* Card responds to its container, not the viewport */
@container (min-width: 400px) {
  .card {
    grid-template-columns: 120px 1fr;
  }
}
```

A card in a narrow sidebar stays compact, while the same card in a main content area
expands — automatically, without viewport hacks.

---

## Optical Adjustments

Text at `margin-left: 0` looks slightly indented due to letterform whitespace.
Use negative margin (`margin-left: -0.05em`) to optically align.

Geometrically centered icons often look off-center. Play icons shift right, arrows
toward their direction. Always check optically, not just mathematically.

### Touch Targets vs Visual Size

```css
.icon-button {
  width: 24px;  /* Visual size */
  height: 24px;
  position: relative;
}

/* Expand tap target to 44px minimum */
.icon-button::before {
  content: '';
  position: absolute;
  inset: -10px;
}
```

---

## Depth & Elevation

Create semantic z-index scales:
```css
:root {
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal-backdrop: 300;
  --z-modal: 400;
  --z-toast: 500;
  --z-tooltip: 600;
}
```

Shadow scale: sm → md → lg → xl.
**Key insight**: If you can clearly see the shadow, it's probably too strong.

---

**Avoid**: Arbitrary spacing values outside your scale. Making all spacing equal.
Creating hierarchy through size alone. Overpadded layouts.
