---
name: fonts
description: Font management knowledge base - next/font, self-hosting, download, licensing, variable fonts. Use when managing fonts in Next.js, setting up self-hosted fonts, or optimizing font loading performance.
version: 1.0.0
---

# Font Management Skill

Gestione completa dei font per progetti Next.js: download, ottimizzazione e struttura.

## Struttura Standard

```
src/
├── fonts/
│   ├── index.ts              # Export font configurations
│   ├── local/                # Font files locali
│   │   ├── inter/
│   │   │   ├── Inter-Regular.woff2
│   │   │   ├── Inter-Medium.woff2
│   │   │   ├── Inter-SemiBold.woff2
│   │   │   └── Inter-Bold.woff2
│   │   └── geist/
│   │       ├── GeistVF.woff2
│   │       └── GeistMonoVF.woff2
│   └── README.md             # Licenze e crediti
```

## Next.js Font Optimization

### next/font/local (Raccomandato)

```typescript
// src/fonts/index.ts
import localFont from 'next/font/local'

// Variable Font (preferito)
export const geist = localFont({
  src: [
    {
      path: './local/geist/GeistVF.woff2',
      weight: '100 900',
      style: 'normal',
    },
  ],
  variable: '--font-geist',
  display: 'swap',
  preload: true,
})

export const geistMono = localFont({
  src: './local/geist/GeistMonoVF.woff2',
  variable: '--font-geist-mono',
  display: 'swap',
  preload: true,
})

// Static Font (multiple weights)
export const inter = localFont({
  src: [
    { path: './local/inter/Inter-Regular.woff2', weight: '400', style: 'normal' },
    { path: './local/inter/Inter-Medium.woff2', weight: '500', style: 'normal' },
    { path: './local/inter/Inter-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: './local/inter/Inter-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
})
```

### next/font/google

```typescript
// src/fonts/index.ts
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google'

export const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
})

export const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})
```

## Applicazione in Layout

```typescript
// app/layout.tsx
import { geist, geistMono, inter } from '@/fonts'
import '@/styles/globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html 
      lang="it" 
      className={`${geist.variable} ${geistMono.variable} ${inter.variable}`}
    >
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
```

## Tailwind Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'var(--font-mono)', 'monospace'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
    },
  },
}

export default config
```

## Download Font da Google Fonts

### Script Automatico

```bash
#!/bin/bash
# scripts/download-fonts.sh

FONTS_DIR="src/fonts/local"
mkdir -p "$FONTS_DIR"

# Google Fonts Helper (usa google-webfonts-helper)
# https://gwfh.mranftl.com/fonts

# Inter
curl -o "$FONTS_DIR/inter/Inter-Regular.woff2" \
  "https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_fjbvMwCp50SjIa1ZL7.woff2"

# Oppure usa fontsource
pnpm add @fontsource-variable/inter
```

### Fontsource (Alternativa)

```bash
# Installa font come pacchetto npm
pnpm add @fontsource-variable/inter
pnpm add @fontsource-variable/geist-sans
pnpm add @fontsource-variable/geist-mono
pnpm add @fontsource/playfair-display
```

```typescript
// src/styles/globals.css
@import '@fontsource-variable/inter';
@import '@fontsource-variable/geist-sans';
@import '@fontsource-variable/geist-mono';
```

## Font Popolari per Web

### Sans-Serif (UI/Body)

| Font | Stile | Variable | Licenza |
|------|-------|----------|---------|
| **Inter** | Neutro, moderno | Si | OFL |
| **Geist** | Vercel, tech | Si | OFL |
| **Plus Jakarta Sans** | Friendly | Si | OFL |
| **DM Sans** | Geometric | Si | OFL |
| **Outfit** | Rounded | Si | OFL |
| **Satoshi** | Premium feel | Si | Free |

### Serif (Display/Headlines)

| Font | Stile | Variable | Licenza |
|------|-------|----------|---------|
| **Playfair Display** | Elegant | Si | OFL |
| **Fraunces** | Funky serif | Si | OFL |
| **Libre Baskerville** | Classic | No | OFL |
| **Source Serif Pro** | Adobe | Si | OFL |

### Monospace (Code)

| Font | Stile | Variable | Licenza |
|------|-------|----------|---------|
| **Geist Mono** | Vercel | Si | OFL |
| **JetBrains Mono** | Coding | Si | OFL |
| **Fira Code** | Ligatures | Si | OFL |
| **IBM Plex Mono** | Corporate | Si | OFL |

## Subset per Lingua

```typescript
// Per italiano + ceco
const inter = Inter({
  subsets: ['latin', 'latin-ext'], // latin-ext per caratteri cechi (ě, š, č, ř, ž, etc.)
  display: 'swap',
})
```

## Performance Tips

1. **Usa Variable Fonts** - Un file per tutti i weights
2. **Preload critical fonts** - `preload: true`
3. **display: swap** - Evita FOIT (Flash of Invisible Text)
4. **Subset** - Solo i caratteri necessari
5. **Self-host** - Evita richieste esterne
6. **WOFF2 only** - Supportato ovunque, più piccolo

## Font Loading CSS

```css
/* globals.css */
@layer base {
  html {
    font-family: var(--font-sans), system-ui, sans-serif;
    font-feature-settings: 'liga' 1, 'calt' 1; /* Ligature */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  
  code, pre, kbd {
    font-family: var(--font-mono), monospace;
  }
}
```

## Licenze

Sempre verificare le licenze:

- **OFL (Open Font License)** - Uso commerciale OK, crediti apprezzati
- **Apache 2.0** - Uso commerciale OK
- **Free for personal** - Solo progetti non commerciali
- **Paid** - Richiede licenza

### Credits Template

```markdown
<!-- src/fonts/README.md -->
# Font Credits

## Inter
- Designer: Rasmus Andersson
- License: SIL Open Font License 1.1
- Source: https://rsms.me/inter/

## Geist
- Designer: Vercel
- License: SIL Open Font License 1.1
- Source: https://vercel.com/font

## Playfair Display
- Designer: Claus Eggers Sørensen
- License: SIL Open Font License 1.1
- Source: https://fonts.google.com/specimen/Playfair+Display
```
