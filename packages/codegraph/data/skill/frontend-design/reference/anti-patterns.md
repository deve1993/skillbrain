# Anti-Patterns Reference

Combined patterns from Uncodixfy (cyxzdev) and Impeccable (pbakaus).
These are the fingerprints of AI-generated UI from 2024-2025.

---

## The "Keep It Normal" Standard

When in doubt, ask: "Does this look like Linear, Raycast, Stripe, or GitHub?"
Those products don't try to grab attention. They just work.

| Element | Normal Implementation |
|---------|----------------------|
| Sidebars | 240–260px fixed, solid background, border-right, no floating shells |
| Headers | Simple text, proper h1/h2 hierarchy, no eyebrows, no uppercase labels |
| Sections | Standard padding 20–30px, no hero blocks inside dashboards |
| Navigation | Simple links, subtle hover states, no transform animations |
| Buttons | Solid fills or simple borders, 8–10px radius max, no pills, no gradients |
| Cards | Simple containers, 8–12px radius max, subtle borders, max 8px shadow |
| Forms | Standard inputs, clear labels above fields, simple focus states |
| Inputs | Solid borders, simple focus ring, no animated underlines |
| Modals | Centered overlay, simple backdrop, straightforward close button |
| Dropdowns | Simple list, subtle shadow, clear selected state |
| Tables | Clean rows, simple borders, subtle hover, left-aligned text |
| Tabs | Simple underline or border indicator, no pill backgrounds |
| Badges | Small text, simple border/background, 6–8px radius, only when needed |
| Icons | Simple shapes, 16–20px, monochrome, no decorative backgrounds |
| Typography | Clear hierarchy, readable sizes (14–16px body) |
| Spacing | Consistent 4/8/12/16/24/32px scale, no random gaps |
| Borders | 1px solid, subtle colors, no thick decorative borders |
| Shadows | 0 2px 8px rgba(0,0,0,0.1) max, no colored shadows |
| Transitions | 100–200ms ease, simple opacity/color changes |
| Layouts | Standard grid/flex, predictable structure, clear content hierarchy |
| Containers | max-width 1200–1400px, centered, standard padding |

---

## Hard No List

### Shapes & Borders
- Oversized rounded corners (>12px on cards, >8px on buttons)
- Pill shapes everywhere (buttons, badges, inputs, panels)
- Rounded elements with thick colored border on one side ("lazy accent")
- Gradient borders
- Floating detached sidebar with rounded outer shell

### Color & Visual Effects
- Soft corporate gradients used to fake taste
- Generic dark SaaS composition: blue-black gradients + cyan accents
- Glassmorphism as default visual language (blur, glass cards, glow borders)
- Random glows, blur haze, frosted panels, conic-gradient donuts as decoration
- Colored shadows (for depth)
- Gradient text (especially on metrics or headings)
- Pure black or pure white (always tint with brand hue, even slightly)
- Gray text on colored backgrounds

### Layout Patterns
- KPI card grid as the first dashboard instinct
- Metric cards: big number + small label + supporting stats + gradient accent
- Hero sections inside dashboards or internal UI
- Cards nested inside cards
- Same-sized card grids (icon + heading + text, repeated endlessly)
- Fake charts that exist only to fill space
- Right-side rail panels with "Today" schedule
- Multiple nested panel types (panel, panel-2, rail-panel, table-panel)
- Mixed alignment (some content left-aligned, some center-floating)
- Overpadded layouts (excessive padding making content feel sparse)
- Sticky left rail unless information architecture truly needs it
- Mobile collapse that just stacks everything into one long vertical sandwich

### Typography & Labels
- `<small>` uppercase eyebrow labels above headings (e.g., "MARCH SNAPSHOT")
- Decorative copy as page headers ("Operational clarity without the clutter")
- Rounded `<span>` labels with gradient backgrounds
- Muted gray-blue text that kills contrast
- serif headline + system sans fallback as shortcut to "premium"
- Ornamental labels ("Live Pulse", "Night Shift") unless they come from product voice
- `Segoe UI`, `Trebuchet MS` (unless already in product)

### Charts & Data
- Donut charts with hand-wavy percentages
- Canvas chart placed in glass card with no product-specific reason
- Sparklines as decoration (tiny charts conveying nothing meaningful)
- Pipeline bars with gradient fills
- KPI trend indicators with colored text classes

### Motion & Interaction
- Transform animations on hover (translateX on nav links)
- Dramatic box shadows as dynamic effects (0 24px 60px rgba(0,0,0,0.35))
- Bounce or elastic easing
- Sliding tab animations (pill that slides between tabs)

### Status & Indicators
- Status dots via `::before` pseudo-elements as decoration
- Nav badges showing counts or "Live" status (decorative, not functional)
- Workspace blocks in sidebar with call-to-action buttons
- Footer lines with meta/branding information

---

## Specifically Banned HTML Patterns

### Eyebrow + Heading Combo
```html
<!-- BANNED -->
<div class="headline">
  <small>Team Command</small>
  <h2>One place to track what matters today.</h2>
  <p>Operational clarity without the clutter.</p>
</div>
```

### Small Label + Strong Copy
```html
<!-- BANNED — this is THE biggest no -->
<div class="team-note">
  <small>Focus</small>
  <strong>Keep updates brief, blockers visible, and next actions easy to spot.</strong>
</div>
```

### Gradient Brand Mark
```html
<!-- BANNED -->
<div class="brand" style="background: linear-gradient(135deg, #2a2a2a, #171717)">
  Logo
</div>
```

---

## The Rule

> If a UI choice feels like a default AI UI move, ban it and pick the harder, cleaner option.

> Colors should stay calm, not fight.

---

## Color Selection Priority

1. **Existing project colors** — read CSS variables, Tailwind config, design tokens first
2. **Curated palettes** — pick randomly from the tables in SKILL.md (dark or light)
3. **Never invent random combinations**

Colors going toward pure blue → AVOID unless specifically requested.
Dark muted colors are generally the safest choice for professional contexts.
