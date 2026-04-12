---
name: pixarts/design-system
description: Pixarts design system - design tokens, CSS variables, standard components, layout system, dark mode. Use when implementing brand colors, typography, component variants, or the standard Pixarts visual system.
version: 1.0.0
---

# Pixarts Design System

Sistema di design standard per tutti i siti client Pixarts.

## Design Tokens

### Colori Base

Ogni client ha i propri colori brand. Il design system usa CSS variables con fallback:

```css
/* globals.css - Theme variables */
@theme {
  /* Brand - override per client */
  --color-primary: var(--brand-primary, #3b82f6);
  --color-primary-foreground: var(--brand-primary-fg, #ffffff);
  --color-secondary: var(--brand-secondary, #10b981);
  --color-accent: var(--brand-accent, #f59e0b);

  /* Neutri - consistenti */
  --color-background: #ffffff;
  --color-foreground: #0f172a;
  --color-muted: #f1f5f9;
  --color-muted-foreground: #64748b;
  --color-border: #e2e8f0;

  /* Semantici */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
}
```

### Typography Scale

```css
@theme {
  --font-sans: "Inter", system-ui, sans-serif;
  --font-display: var(--brand-font-display, "Inter", sans-serif);
  --font-mono: "JetBrains Mono", monospace;

  /* Scale - mobile first */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.25rem;   /* 36px */
  --text-5xl: 3rem;      /* 48px */
}
```

### Spacing Scale

Basato su multipli di 4px:
```
4  8  12  16  20  24  32  40  48  64  80  96  128
```

### Border Radius

```css
@theme {
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.5rem;    /* 8px - default */
  --radius-lg: 0.75rem;   /* 12px */
  --radius-xl: 1rem;      /* 16px */
  --radius-full: 9999px;  /* pill */
}
```

---

## Componenti Standard

### Layout System

```
┌─────────────────────────────────────────┐
│ Header (sticky, h-16, border-b)         │
├─────────────────────────────────────────┤
│                                         │
│  Container (max-w-7xl mx-auto px-4)     │
│  ┌─────────────────────────────────┐    │
│  │ Section (py-16 md:py-24)        │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │ Section (py-16 md:py-24)        │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│ Footer (bg-foreground text-background)  │
└─────────────────────────────────────────┘
```

### Header Pattern

```tsx
<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <Container className="flex h-16 items-center justify-between">
    <Logo />
    <Navigation />
    <div className="flex items-center gap-4">
      <LanguageSwitcher />
      <CTAButton />
    </div>
  </Container>
</header>
```

### Section Pattern

```tsx
<section className="py-16 md:py-24">
  <Container>
    <SectionHeader
      badge="Badge text"
      title="Section Title"
      description="Section description."
      align="center"
    />
    <div className="mt-12 grid gap-8 md:grid-cols-3">
      {/* Content */}
    </div>
  </Container>
</section>
```

### Container

```tsx
function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
```

---

## Component Library (shadcn/ui based)

### Sempre installati:
- button, card, badge, separator
- navigation-menu, sheet (mobile nav)
- form, input, textarea, select, checkbox, label
- dialog, dropdown-menu, tooltip
- skeleton, sonner (toast)
- accordion, tabs

### Per landing page:
- carousel, aspect-ratio
- avatar (testimonials)
- scroll-area

### Per dashboard/app:
- table, data-table
- command, popover
- sidebar, resizable

---

## Responsive Breakpoints

```
sm:  640px   (mobile landscape)
md:  768px   (tablet)
lg:  1024px  (desktop)
xl:  1280px  (large desktop)
2xl: 1536px  (ultra-wide)
```

**Pattern mobile-first:**
```tsx
// ✅ Corretto
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// ❌ Sbagliato
<div className="grid grid-cols-3 sm:grid-cols-1">
```

---

## Dark Mode

```tsx
// ThemeProvider wraps the app
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>

// Components use dark: variants
<div className="bg-white dark:bg-slate-900">
```

---

## Animation Defaults

```css
/* Transizioni standard */
.transition-default {
  @apply transition-all duration-200 ease-in-out;
}

/* Hover lift */
.hover-lift {
  @apply transition-transform duration-200 hover:-translate-y-1;
}

/* Fade in on scroll (via Intersection Observer) */
.animate-fade-in {
  @apply opacity-0 translate-y-4 transition-all duration-500;
}
.animate-fade-in.visible {
  @apply opacity-100 translate-y-0;
}
```

---

## Checklist Design System

- [ ] CSS variables definite in globals.css
- [ ] Font caricati con next/font
- [ ] Container component creato
- [ ] Header sticky con mobile sheet
- [ ] Footer con sitemap links
- [ ] Section component con padding responsive
- [ ] Dark mode supportato
- [ ] Animazioni con reduced-motion respect
- [ ] Tutti i componenti shadcn installati
