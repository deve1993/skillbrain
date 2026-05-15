# Color & Contrast

## Use OKLCH, Not HSL

**Stop using HSL.** Use OKLCH (or LCH). It's perceptually uniform — equal steps in lightness
*look* equal. In HSL, 50% lightness yellow looks bright while 50% lightness blue looks dark.

```css
/* OKLCH: lightness (0-100%), chroma (0-0.4+), hue (0-360) */
--color-primary: oklch(60% 0.15 250);       /* Base blue */
--color-primary-light: oklch(85% 0.08 250); /* Lighter — note reduced chroma */
--color-primary-dark: oklch(35% 0.12 250);  /* Darker */
```

**Key insight**: As you move toward white or black, reduce chroma. High chroma at extreme lightness
looks garish. Light blue at 85% lightness needs ~0.08 chroma, not the 0.15 of your base.

---

## Building Functional Palettes

### The Tinted Neutral (Critical)

**Pure gray is dead.** Add a subtle hint of your brand hue to all neutrals:

```css
/* Dead grays */
--gray-100: oklch(95% 0 0);     /* No personality */

/* Brand-tinted grays */
--gray-100: oklch(95% 0.01 250); /* Hint of blue — barely visible but felt */
--gray-900: oklch(15% 0.01 250);
```

The chroma is tiny (0.01) but perceptible. Creates subconscious cohesion.

### Palette Structure

| Role | Purpose | Example |
|------|---------|---------|
| **Primary** | Brand, CTAs, key actions | 1 color, 3–5 shades |
| **Neutral** | Text, backgrounds, borders | 9–11 shade scale |
| **Semantic** | Success, error, warning, info | 4 colors, 2–3 shades each |
| **Surface** | Cards, modals, overlays | 2–3 elevation levels |

Skip secondary/tertiary unless you actually need them. Adding more creates decision fatigue.

### 60-30-10 Rule (Visual Weight, Not Pixel Count)

- **60%**: Neutral backgrounds, white space, base surfaces
- **30%**: Text, borders, inactive states
- **10%**: Accent — CTAs, highlights, focus states

Accent colors work *because* they're rare. Overuse kills their power.

---

## Contrast & Accessibility

### WCAG Requirements

| Content Type | AA Minimum | AAA Target |
|--------------|------------|------------|
| Body text | 4.5:1 | 7:1 |
| Large text (18px+ or 14px bold) | 3:1 | 4.5:1 |
| UI components, icons | 3:1 | 4.5:1 |
| Non-essential decorations | None | None |

**The gotcha**: Placeholder text still needs 4.5:1. That light gray placeholder you see
everywhere? Usually fails.

### Dangerous Combinations to Avoid

- Light gray text on white — the #1 accessibility fail
- **Gray text on ANY colored background** — use a darker shade of the background color
- Red text on green background (color blindness — 8% of men affected)
- Yellow text on white
- Thin light text on images (unpredictable contrast)

### Never Pure Gray or Pure Black

Real shadows and surfaces always have a color cast. Even chroma of 0.005–0.01 feels natural.

---

## Dark Mode

Dark mode is NOT inverted light mode. It requires different design decisions:

| Light Mode | Dark Mode |
|------------|-----------|
| Shadows for depth | Lighter surfaces for depth |
| Dark text on light | Light text on dark (reduce font weight slightly) |
| Vibrant accents | Desaturate accents slightly |
| White backgrounds | Never pure black — use dark gray (oklch 12–18%) |

```css
:root[data-theme="dark"] {
  /* Depth via surface color, not shadow */
  --surface-1: oklch(15% 0.01 250);
  --surface-2: oklch(20% 0.01 250);  /* "Higher" = lighter */
  --surface-3: oklch(25% 0.01 250);

  /* Slightly reduced font weight for legibility */
  --body-weight: 350;
}
```

### Token Architecture

Two layers: primitive (`--blue-500`) and semantic (`--color-primary: var(--blue-500)`).
For dark mode, only redefine the semantic layer.

---

## Alpha Is a Design Smell

Heavy `rgba`/transparency usually signals an incomplete palette. Alpha creates unpredictable
contrast and inconsistency. Define explicit overlay colors instead.
Exception: focus rings and interactive states where see-through is needed.

---

**Avoid**: Relying on color alone to convey information. Pure black (#000) for large areas.
Skipping color blindness testing. Creating palettes without clear role assignments.
