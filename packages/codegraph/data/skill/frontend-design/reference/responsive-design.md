# Responsive Design

## Mobile-First: Write It Right

Start with base styles for mobile, use `min-width` queries to add complexity.
Desktop-first (`max-width`) means mobile loads unnecessary styles first.

```css
/* Mobile-first */
.component {
  display: block; /* Mobile default */
}

@media (min-width: 768px) {
  .component {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
```

---

## Breakpoints: Content-Driven

Don't chase device sizes — let content tell you where to break.
Start narrow, stretch until design breaks, add breakpoint there.

**Three breakpoints usually suffice:**
- `640px` — small tablets, landscape phones
- `768px` — tablets
- `1024px` — desktop

Use `clamp()` for fluid values without breakpoints.

---

## Detect Input Method, Not Just Screen Size

**Screen size doesn't tell you input method.** A laptop with touchscreen, a tablet with
keyboard — use pointer and hover queries:

```css
/* Fine pointer (mouse, trackpad) — smaller targets OK */
@media (pointer: fine) {
  .button { padding: 8px 16px; }
}

/* Coarse pointer (touch, stylus) — need larger targets */
@media (pointer: coarse) {
  .button { padding: 12px 20px; }
}

/* Device supports hover */
@media (hover: hover) {
  .card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
}

/* Device doesn't support hover — use active instead */
@media (hover: none) {
  .card:active {
    transform: scale(0.98);
  }
}
```

**Critical**: Don't rely on hover for functionality. Touch users can't hover.

---

## Safe Areas: Handle the Notch

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* With fallback */
.footer {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

---

## Responsive Images

### srcset with Width Descriptors

```html
<img
  src="hero-800.jpg"
  srcset="
    hero-400.jpg 400w,
    hero-800.jpg 800w,
    hero-1200.jpg 1200w,
    hero-2400.jpg 2400w
  "
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="Hero image"
  loading="lazy"
>
```

**How it works**: `srcset` lists available images with actual widths. `sizes` tells the browser
how wide the image displays. Browser picks the best file based on viewport + device pixel ratio.

### Art Direction (Different Crops)

```html
<picture>
  <source media="(min-width: 768px)" srcset="landscape.jpg">
  <source media="(max-width: 767px)" srcset="portrait.jpg">
  <img src="fallback.jpg" alt="...">
</picture>
```

---

## Layout Adaptation Patterns

### Navigation

Three stages:
1. **Mobile**: Hamburger + drawer
2. **Tablet**: Horizontal compact (icons + abbreviated labels)
3. **Desktop**: Full navigation with labels

### Tables → Cards on Mobile

```css
@media (max-width: 640px) {
  table, thead, tbody, th, td, tr {
    display: block;
  }

  thead tr {
    position: absolute;
    top: -9999px;
    left: -9999px;
  }

  td {
    position: relative;
    padding-left: 50%;
  }

  td::before {
    content: attr(data-label);
    position: absolute;
    left: 0;
    width: 45%;
    font-weight: bold;
  }
}
```

### Progressive Disclosure on Mobile

Use `<details>/<summary>` for content that can collapse:

```html
<details>
  <summary>Advanced Options</summary>
  <div class="advanced-content">...</div>
</details>
```

---

## Testing: Don't Trust DevTools Alone

DevTools device emulation misses:
- Actual touch interactions
- Real CPU/memory constraints
- Network latency patterns
- Font rendering differences
- Browser chrome/keyboard appearances

**Test on at least**: One real iPhone, one real Android.
Cheap Android phones reveal performance issues you'll never see on simulators.

---

**Avoid**: Desktop-first design. Device detection instead of feature detection.
Separate mobile/desktop codebases. Ignoring tablet and landscape.
Assuming all mobile devices are powerful. Hiding critical functionality on mobile.
