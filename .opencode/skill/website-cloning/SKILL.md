---
name: website-cloning
description: Pipeline v2.0 per clonazione pixel-perfect di siti web - Firecrawl + Design Copier + Playwright, per-section tokens, interactive states, dark mode. Use when cloning a website, reverse-engineering a UI, or replicating a site's design pixel-perfect.
version: 1.0.0
---

# Website Cloning Pipeline v2.0

Pipeline completa per analisi e riproduzione pixel-perfect di siti web esistenti.

## Architettura Pipeline

```
URL Input
  │
  ├─── Step 1a: Firecrawl MCP ────────── Markdown + HTML + Brand Identity
  ├─── Step 1b: Design Copier MCP ────── CSS→Tailwind diretto + React skeletons
  │
  ├─── Step 2: Playwright Script v2.0 ── 6 output files (tokens, sections, interactive, structure, screenshots, assets)
  │
  ├─── Step 3: AI Analysis ───────────── Report per-sezione + cross-reference sources
  │
  ├─── Step 4: Component Build ────────── Next.js + Tailwind con per-section accuracy
  │
  └─── Step 5: Screenshot Comparison ──── Pixel diff automatico + QA
```

## Step 1a: Firecrawl — Content + Branding

Firecrawl esegue JS-rendered scraping. **SEMPRE usare formats multipli:**

### MCP Tools Disponibili

| Tool | Formato | Uso |
|------|---------|-----|
| `firecrawl_scrape(url, formats=["markdown"])` | markdown | Contenuto testuale pulito |
| `firecrawl_scrape(url, formats=["html"])` | html | **HTML strutturale reale** (non semplificato) |
| `firecrawl_scrape(url, formats=["branding"])` | branding | **Brand identity**: colori, font, typography, spacing, UI components |
| `firecrawl_scrape(url, formats=["markdown","html","branding"])` | tutti | **Raccomandato**: estrae tutto in un colpo |
| `firecrawl_crawl` | — | Intero sito (max depth) |
| `firecrawl_map` | — | Sitemap/URL discovery |
| `firecrawl_extract` | — | Structured data extraction |

### Prompt Pattern

```
1. firecrawl_map(url) → lista completa URL
2. firecrawl_scrape(homepage, formats=["markdown", "html", "branding"])
3. Per pagine chiave: firecrawl_scrape(page, formats=["markdown", "html"])
```

### Output Atteso (con branding)

```json
{
  "url": "https://example.com",
  "markdown": "# Page Title\n\n...",
  "html": "<header>...</header><main>...",
  "branding": {
    "colors": { "primary": "#3b82f6", "secondary": "#10b981", "background": "#fff", ... },
    "fonts": { "heading": "Inter", "body": "Inter", ... },
    "typography": { ... },
    "spacing": { ... },
    "components": { ... }
  },
  "metadata": { "title": "...", "description": "...", "ogImage": "..." },
  "links": ["...", "..."]
}
```

## Step 1b: Design Copier — CSS→Tailwind Diretto

Il Design Copier MCP estrae stili e li converte direttamente a Tailwind o React.

### MCP Tools

| Tool | Uso |
|------|-----|
| `designcopier_snapshot(url)` | Cattura stili completi della pagina intera |
| `designcopier_snapshot(url, selector="header")` | Stili di una sezione specifica |
| `designcopier_extract(html, styles, "tailwind")` | Converte CSS estratti → classi Tailwind |
| `designcopier_extract(html, styles, "css")` | CSS pulito |
| `designcopier_apply(styles, "react", "ComponentName")` | Genera componente React da stili |

### Workflow Design Copier

```
1. designcopier_snapshot(url) → {html, styles} della pagina
2. designcopier_extract(html, styles, "tailwind") → mapping Tailwind globale
3. Per sezioni chiave (header, hero, features, footer):
   a. designcopier_snapshot(url, selector="header|section|footer")
   b. designcopier_extract(sectionHtml, sectionStyles, "tailwind")
4. designcopier_apply(styles, "react", "HeroSection") → React skeleton
```

**Output**: Mapping CSS→Tailwind per-sezione + componenti React scheletro.

## Step 2: Playwright Extraction Script v2.0

Script Node.js migliorato che estrae **6 output files** invece di 2.

### Esecuzione

```bash
# Estrazione base (tokens + sections + interactive + structure + screenshots)
node .Claude/templates/clone-pipeline/extract-design.mjs https://target.com

# Estrazione completa (+ download assets: images, svgs, fonts)
node .Claude/templates/clone-pipeline/extract-design.mjs https://target.com --full

# Output personalizzato
node .Claude/templates/clone-pipeline/extract-design.mjs https://target.com --output ./analisi-sito --full
```

### Output Directory v2.0

```
clone-output/
├── design-tokens.json        ← Token globali + CSS vars per OGNI selector
├── section-styles.json       ← Token PER-SEZIONE (colori, layout, spacing)
├── interactive-states.json   ← Hover/focus/active states + CSS rules
├── structure.json            ← Albero DOM depth 6 con layout completo
├── screenshots/
│   ├── mobile-375.png
│   ├── tablet-768.png
│   ├── desktop-1024.png
│   └── wide-1440.png
└── assets/                   ← Solo con --full
    ├── images/               ← Max 80 immagini
    ├── svgs/                 ← Max 50 SVG inline
    └── fonts/                ← woff2/ttf intercettati
```

### design-tokens.json Schema v2.0

```json
{
  "colors": {
    "backgrounds": ["#ffffff", "#f8f9fa"],
    "texts": ["#1a1a2e", "#666666"],
    "borders": ["#e5e7eb"],
    "all": ["#ffffff", "#f8f9fa", "#1a1a2e", "..."]
  },
  "typography": {
    "families": ["Inter, sans-serif", "JetBrains Mono, monospace"],
    "sizes": ["14px", "16px", "18px", "24px", "32px", "48px"],
    "weights": ["400", "500", "600", "700"],
    "lineHeights": ["1.5", "1.6", "1.75"],
    "letterSpacings": ["-0.02em", "0.05em"]
  },
  "spacing": {
    "paddings": ["8px", "12px", "16px", "24px", "32px", "48px", "64px"],
    "margins": ["8px", "16px", "24px", "32px"],
    "gaps": ["8px", "12px", "16px", "24px"]
  },
  "borders": {
    "radii": ["4px", "8px", "12px", "9999px"],
    "widths": ["1px", "2px"]
  },
  "shadows": ["0 1px 3px rgba(0,0,0,0.1)", "0 4px 6px rgba(0,0,0,0.1)"],
  "gradients": ["linear-gradient(135deg, #667eea 0%, #764ba2 100%)"],
  "transitions": ["all 0.3s ease", "transform 0.2s ease-out"],
  "animations": [
    { "name": "fadeIn", "duration": "0.5s", "timingFunction": "ease-out" }
  ],
  "cssVariables": {
    "root": {
      "--primary": "#3b82f6",
      "--radius": "0.5rem"
    },
    "bySelector": {
      ":root": { "--primary": "#3b82f6", "--background": "#ffffff" },
      ".dark": { "--primary": "#60a5fa", "--background": "#0f172a" },
      "[data-theme=\"dark\"]": { "--primary": "#60a5fa" },
      "@media(prefers-color-scheme: dark) :root": { "--background": "#0f172a" }
    }
  },
  "breakpoints": [640, 768, 1024, 1280],
  "keyframes": {
    "fadeIn": [
      { "keyText": "0%", "style": "opacity: 0" },
      { "keyText": "100%", "style": "opacity: 1" }
    ]
  },
  "effects": {
    "backdropFilters": ["blur(10px)", "blur(20px) saturate(180%)"],
    "filters": ["blur(4px)", "brightness(0.8)", "drop-shadow(0 4px 6px rgba(0,0,0,0.3))"],
    "transforms": ["rotate(45deg)", "scale(1.1)", "translateY(-50%)"],
    "clipPaths": ["polygon(0 0, 100% 0, 100% 85%, 0 100%)", "circle(50%)"],
    "maskImages": ["linear-gradient(to bottom, black 80%, transparent)"],
    "mixBlendModes": ["multiply", "screen", "overlay"],
    "perspectives": ["1000px"],
    "gradientTexts": [{ "selector": ".hero-title", "gradient": "linear-gradient(90deg, #667eea, #764ba2)" }],
    "textStrokes": [{ "selector": ".outline-heading", "width": "2px", "color": "#000" }],
    "objectFits": [{ "value": "cover", "count": 12 }, { "value": "contain", "count": 3 }],
    "aspectRatios": [{ "value": "16/9", "count": 4 }, { "value": "1/1", "count": 2 }],
    "scrollSnaps": [{ "type": "y mandatory", "align": "start" }],
    "customCursors": ["pointer", "url(custom.cur), auto"],
    "pseudoElements": [
      { "selector": ".decorated::before", "content": "''", "position": "absolute", "background": "linear-gradient(...)" },
      { "selector": ".quote::after", "content": "'\"'", "fontSize": "3rem" }
    ],
    "selectionStyle": { "background": "#3b82f6", "color": "#ffffff" },
    "videoBackgrounds": [
      { "src": "hero-bg.mp4", "poster": "hero-poster.jpg", "autoplay": true, "loop": true, "muted": true }
    ]
  }
}
```

### section-styles.json Schema (NUOVO)

```json
{
  "header.site-header": {
    "index": 0,
    "tag": "header",
    "heading": null,
    "rect": { "top": 0, "height": 64 },
    "tokens": {
      "colors": ["#1a1a2e"],
      "backgrounds": ["#ffffff"],
      "fontFamilies": ["Inter, sans-serif"],
      "fontSizes": ["14px", "16px"],
      "fontWeights": ["500", "600"],
      "paddings": ["12px", "16px"],
      "margins": [],
      "gaps": ["24px"],
      "borderRadii": ["8px"],
      "shadows": ["0 1px 3px rgba(0,0,0,0.1)"],
      "gradients": [],
      "layout": {
        "display": "flex",
        "position": "sticky",
        "flexDirection": "row",
        "justifyContent": "space-between",
        "alignItems": "center",
        "width": 1440,
        "height": 64,
        "maxWidth": "1280px"
      },
      "elementCount": 28
    }
  },
  "section.hero": {
    "index": 1,
    "tag": "section",
    "heading": "Build better products",
    "rect": { "top": 64, "height": 720 },
    "tokens": {
      "colors": ["#ffffff", "#1a1a2e"],
      "backgrounds": ["linear-gradient(135deg, #667eea, #764ba2)"],
      "fontFamilies": ["Inter, sans-serif"],
      "fontSizes": ["18px", "48px"],
      "fontWeights": ["400", "700"],
      "paddings": ["64px", "128px"],
      "margins": [],
      "gaps": ["24px"],
      "borderRadii": [],
      "shadows": [],
      "gradients": ["linear-gradient(135deg, #667eea, #764ba2)"],
      "effects": {
        "backdropFilters": ["blur(10px)"],
        "clipPaths": ["polygon(0 0, 100% 0, 100% 85%, 0 100%)"],
        "hasVideoBackground": true
      },
      "layout": { "display": "flex", "position": "relative", "..." : "..." },
      "elementCount": 42
    }
  }
}
```

### interactive-states.json Schema (NUOVO)

```json
{
  "elements": [
    {
      "tag": "button",
      "class": "btn btn-primary",
      "text": "Get Started",
      "baseState": {
        "color": "#ffffff",
        "backgroundColor": "#3b82f6",
        "borderColor": null,
        "boxShadow": null,
        "transform": null,
        "cursor": "pointer"
      },
      "transition": "all 0.2s ease"
    }
  ],
  "cssRules": {
    "hover": {
      ".btn-primary": { "background-color": "#2563eb", "transform": "scale(1.02)" }
    },
    "focus": {
      ".btn-primary": { "outline": "2px solid #93c5fd", "outline-offset": "2px" }
    },
    "active": {
      ".btn-primary": { "transform": "scale(0.98)" }
    }
  }
}
```

### structure.json v2.0 Improvements

- **Depth 6** (era 4) — cattura componenti annidati
- **Tutti i tag** — non solo semantic, include `span`, `button`, `picture`, `figure`, `svg`, `video`
- **Layout completo** per flex: `flexDirection`, `justifyContent`, `alignItems`, `flexWrap`, `gap`
- **Layout completo** per grid: `gridTemplateColumns`, `gridTemplateRows`, `gap`, `gridAutoFlow`
- **Position** con offsets: `position`, `top`, `right`, `bottom`, `left`
- **Extra attrs**: `maxWidth`, `minHeight`, `overflow`
- **Visual effects** nel layout: `backdropFilter`, `filter`, `transform`, `clipPath`, `mixBlendMode`, `objectFit`, `objectPosition`, `aspectRatio`, `opacity`, `perspective` (solo quando presenti)
- **Video tag**: `src`, `poster`, `autoplay`, `loop`, `muted`, `playsInline`
- **Testo** catturato per: h1-h6, p (depth ≤3), button, span (depth ≤4, length <60)
- **Classi**: fino a 8 (era 5)
- **Accessibility**: `role`, `aria-label`
- **Picture**: `sources` con srcset

## Step 3: AI Analysis

Dopo Step 1 + 2, l'agente @web-analyst produce un report strutturato usando TUTTE le fonti.

### Source Priority (quando discordano)

1. **Design Copier** (`designcopier_extract` → Tailwind) — più accurato per CSS→class mapping
2. **Playwright** (`section-styles.json`, `interactive-states.json`) — più accurato per computed values
3. **Firecrawl branding** — utile per validazione incrociata e overview

### Report Template v2.0

Vedi `11-web-analyst.md` per il formato completo. Il report v2.0 include:
- Per-Section Token Map (non più array piatto)
- Interactive States table
- Dark Mode / Theme Variants
- Cross-Reference Notes

## Step 4: Component Build

@component-builder riceve il report e costruisce i componenti Next.js.

### Regole di Conversione

| Proprietà Estratta | Mapping Tailwind v4 |
|---------------------|---------------------|
| `font-size: 48px` | `text-5xl` o custom `@theme { --font-size-hero: 48px }` |
| `padding: 24px` | `p-6` |
| `border-radius: 12px` | `rounded-xl` |
| `gap: 16px` | `gap-4` |
| `box-shadow` | `shadow-md` o custom `@theme { --shadow-card: ... }` |
| `display: flex; justify-content: space-between` | `flex justify-between` |
| `display: grid; grid-template-columns: repeat(3, 1fr)` | `grid grid-cols-3` |
| `position: sticky; top: 0` | `sticky top-0` |
| hover: `background-color: #2563eb` | `hover:bg-[#2563eb]` |
| focus: `outline: 2px solid #93c5fd` | `focus:ring-2 focus:ring-blue-300` |
| CSS variables (light) | `@theme {}` block |
| CSS variables (dark) | `.dark {}` o `@media (prefers-color-scheme: dark)` |
| `@keyframes` | Framer Motion o CSS in `globals.css` |
| `backdrop-filter: blur(10px)` | `backdrop-blur-sm` / `backdrop-blur-[10px]` |
| `filter: blur(4px)` | `blur-sm` / `blur-[4px]` |
| `clip-path: polygon(...)` | `[clip-path:polygon(...)]` (arbitrary) |
| `mix-blend-mode: multiply` | `mix-blend-multiply` |
| `object-fit: cover` | `object-cover` |
| `aspect-ratio: 16/9` | `aspect-video` / `aspect-[16/9]` |
| `opacity: 0.5` | `opacity-50` |
| `transform: scale(1.05)` | `scale-105` / `hover:scale-105` |
| `perspective: 1000px` | `[perspective:1000px]` (arbitrary) |
| `-webkit-background-clip: text` | `bg-clip-text text-transparent bg-gradient-to-r` |
| `::before` / `::after` | `before:content-[''] before:absolute before:...` |
| `<video>` background | Next.js `<video>` con `autoPlay muted loop playsInline` |

### Struttura Output Progetto

```
src/
├── app/[locale]/
│   ├── page.tsx              ← Homepage (clone)
│   └── layout.tsx            ← Root layout con font + theme
├── components/
│   ├── sections/
│   │   ├── hero.tsx
│   │   ├── features.tsx
│   │   ├── pricing.tsx
│   │   └── footer.tsx
│   └── ui/                   ← shadcn components
├── lib/
│   └── animations.ts         ← Framer Motion variants da keyframes estratti
└── globals.css               ← @theme con design tokens mappati (light + dark)
```

## Step 5: Screenshot Comparison

Script automatico per confronto pixel-level.

```bash
node .Claude/templates/clone-pipeline/compare-screenshots.mjs \
  --original ./clone-output/screenshots \
  --clone ./Progetti/<slug>/screenshots \
  --output ./clone-output/comparison
```

**Output**: `comparison-report.json` con diff score per viewport e mismatch regions.

## Checklist Clone Quality

- [ ] Screenshot comparison automatico: diff < 5% per viewport
- [ ] Tutti i colori PER-SEZIONE mappati (non solo globali)
- [ ] Font corretti (family, weight, size) per heading e body
- [ ] Spacing coerente (± 4px tolerance)
- [ ] Layout flex/grid corretto (justify, align, wrap, gap)
- [ ] Position (sticky, fixed, absolute) con offset corretti
- [ ] Hover states implementati per tutti gli elementi interattivi
- [ ] Focus states implementati (accessibilità)
- [ ] Animazioni riprodotte (timing, easing)
- [ ] Responsive breakpoints corretti
- [ ] Immagini/SVG posizionati correttamente
- [ ] Dark mode implementato (se presente nell'originale)
- [ ] Visual effects riprodotti: backdrop-filter, clip-path, blend modes
- [ ] Pseudo-elements (::before/::after) implementati dove presenti
- [ ] Video backgrounds funzionanti (autoplay, loop, muted)
- [ ] Gradient text e text-stroke dove presenti
- [ ] Lighthouse score >= originale
- [ ] Cross-reference: design-copier e playwright concordano

## Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| Cross-origin CSS non leggibile | Usa `designcopier_snapshot` che bypassa CORS, poi `firecrawl_scrape(formats=["html"])` |
| Font non scaricabili | `--full` mode intercetta font requests, fallback: Google Fonts API |
| Animazioni complesse (GSAP/Lottie) | Semplifica con Framer Motion equivalente, usa `interactive-states.json` per timing |
| Immagini protette/lazy | v2.0 fa auto-scroll prima dell'estrazione, cattura `currentSrc` e `<picture>` srcset |
| SPA senza SSR | Firecrawl gestisce JS rendering |
| Contenuti behind auth | Non supportato (vincolo etico) |
| Design Copier timeout | Riprova con `selector` specifico per sezione singola |
| Discrepanza tra fonti | Priorità: Design Copier > Playwright computed > Firecrawl branding |
| Hover states non estratti dai CSS | `interactive-states.json` legge i CSS `:hover/:focus/:active` rules direttamente |
| Dark mode non rilevata | v2.0 legge CSS vars da `.dark`, `[data-theme]`, `prefers-color-scheme` |
| Pseudo-elements non visibili | Estratti da `::before`/`::after` computed styles (content, position, background, transform, clipPath) |
| Video background non riprodotto | Controlla `effects.videoBackgrounds` in tokens e `<video>` in structure.json — usa `autoPlay muted loop playsInline` |
| Gradient text non estratto | Cerca `effects.gradientTexts` — implementa con `bg-clip-text text-transparent bg-gradient-to-r` |
| Clip-path complesso | Estratto come stringa — usa arbitrary value `[clip-path:...]` in Tailwind |
