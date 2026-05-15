# Motion Design

## Duration: The 100/300/500 Rule

| Duration | Use Case | Examples |
|----------|----------|----------|
| **100–150ms** | Instant feedback | Button press, toggle, color change |
| **200–300ms** | State changes | Menu open, tooltip, hover states |
| **300–500ms** | Layout changes | Accordion, modal, drawer |
| **500–800ms** | Entrance animations | Page load, hero reveals |

**Exit animations are faster than entrances** — use ~75% of enter duration.

---

## Easing: Pick the Right Curve

**Don't use `ease`.** It's a compromise that's rarely optimal.

| Curve | Use For | CSS |
|-------|---------|-----|
| **ease-out** | Elements entering | `cubic-bezier(0.16, 1, 0.3, 1)` |
| **ease-in** | Elements leaving | `cubic-bezier(0.7, 0, 0.84, 0)` |
| **ease-in-out** | State toggles | `cubic-bezier(0.65, 0, 0.35, 1)` |

**For micro-interactions, use exponential curves** — they mimic real physics (friction,
deceleration):

```css
:root {
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);      /* Smooth, refined — recommended default */
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);      /* Slightly more dramatic */
  --ease-out-expo:  cubic-bezier(0.16, 1, 0.3, 1);       /* Snappy, confident */
  --ease-in-out-quart: cubic-bezier(0.76, 0, 0.24, 1);   /* State toggles */
}
```

**Avoid bounce and elastic curves.** They were trendy in 2015. Real objects don't bounce —
they decelerate smoothly. These draw attention to the animation, not the content.

---

## The Only Two Properties to Animate

**`transform` and `opacity` only.** Everything else causes layout recalculation.

For height animations (accordions, expanding content):
```css
/* Instead of animating height */
.accordion-content {
  display: grid;
  grid-template-rows: 0fr;   /* Collapsed */
  transition: grid-template-rows 300ms var(--ease-out-quart);
}

.accordion-content.open {
  grid-template-rows: 1fr;   /* Expanded */
}

/* Inner element prevents content overflow */
.accordion-inner {
  overflow: hidden;
}
```

---

## Staggered Animations

```css
/* CSS custom property for clean stagger */
.list-item {
  animation: slide-up 400ms var(--ease-out-expo) both;
  animation-delay: calc(var(--i, 0) * 50ms);
}
```

```html
<li class="list-item" style="--i: 0">Item 1</li>
<li class="list-item" style="--i: 1">Item 2</li>
<li class="list-item" style="--i: 2">Item 3</li>
```

**Cap total stagger time** — 10 items at 50ms = 500ms total.
For many items, reduce per-item delay or cap the staggered count.

---

## Reduced Motion (Required)

Vestibular disorders affect ~35% of adults over 40. This is not optional.

```css
/* Define animations normally */
.card {
  animation: slide-up 500ms var(--ease-out-expo);
}

/* Alternative for reduced motion */
@media (prefers-reduced-motion: reduce) {
  .card {
    animation: fade-in 200ms ease;  /* Crossfade instead of motion */
  }
}

/* Or nuclear option */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Preserve functional animations**: Progress bars, loading spinners (slowed), focus indicators
should still work — just without spatial movement.

---

## Perceived Performance

**Nobody cares how fast your site is — just how fast it *feels*.**

**The 80ms threshold**: Our brains buffer ~80ms. Anything under 80ms feels instant.

**Strategies:**
- **Optimistic UI**: Update the interface immediately, sync later (Instagram likes work offline)
- **Skeleton screens**: Preview content shape — feels faster than generic spinners
- **Progressive loading**: Show content as it arrives, don't wait for everything
- **Preemptive start**: Begin transitions while loading — users perceive work happening

**Caution**: Too-fast responses can decrease perceived value. Brief delays signal "real work"
for complex operations (search, analysis).

---

## Performance

```css
/* Only use will-change when animation is imminent */
.card:hover {
  will-change: transform;
}

/* Unset after animation */
.card:not(:hover) {
  will-change: auto;
}
```

For scroll-triggered animations, use Intersection Observer (not scroll events).
Unobserve elements after they've animated once.

### Motion Tokens

```css
:root {
  /* Durations */
  --duration-instant: 100ms;
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;

  /* Easings */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  /* Common transitions */
  --transition-color: color var(--duration-instant) var(--ease-out),
                      background-color var(--duration-instant) var(--ease-out);
  --transition-transform: transform var(--duration-fast) var(--ease-out);
}
```

---

**Avoid**: Animating everything (animation fatigue is real). Using >500ms for UI feedback.
Ignoring `prefers-reduced-motion`. Using animation to hide slow loading.
Bounce/elastic easing. Animating layout properties.
