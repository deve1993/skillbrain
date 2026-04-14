---
name: pixarts/template-architecture
description: Standard Next.js project architecture for Pixarts client sites - folder structure, root layout, block renderer, env config. Use when scaffolding a new client project, setting up the standard folder structure, or configuring root layout/config files.
version: 1.0.0
---

# Pixarts Template Architecture

Architettura standard per i siti client Pixarts basati su Next.js 15+ App Router.

## Struttura Cartelle Standard

```
src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx           # Root layout: fonts, metadata, providers
│   │   ├── page.tsx             # Homepage
│   │   ├── loading.tsx          # Global loading skeleton
│   │   ├── error.tsx            # Global error boundary
│   │   ├── not-found.tsx        # 404 page
│   │   ├── (pages)/
│   │   │   ├── chi-siamo/
│   │   │   │   └── page.tsx
│   │   │   ├── servizi/
│   │   │   │   └── page.tsx
│   │   │   ├── contatti/
│   │   │   │   └── page.tsx
│   │   │   └── blog/
│   │   │       ├── page.tsx        # Blog list
│   │   │       └── [slug]/
│   │   │           └── page.tsx    # Blog post
│   │   └── (legal)/
│   │       ├── privacy/
│   │       │   └── page.tsx
│   │       ├── cookie-policy/
│   │       │   └── page.tsx
│   │       └── terms/
│   │           └── page.tsx
│   ├── api/
│   │   ├── health/
│   │   │   └── route.ts           # Health check endpoint
│   │   └── revalidate/
│   │       └── route.ts           # ISR revalidation from CMS
│   ├── robots.ts                   # SEO robots.txt
│   ├── sitemap.ts                  # SEO sitemap.xml
│   └── globals.css                 # Tailwind + theme variables
│
├── components/
│   ├── ui/                         # shadcn/ui components (auto-generated)
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   ├── container.tsx
│   │   ├── section.tsx
│   │   ├── mobile-nav.tsx
│   │   └── language-switcher.tsx
│   ├── blocks/                     # CMS content blocks
│   │   ├── hero-block.tsx
│   │   ├── features-block.tsx
│   │   ├── testimonials-block.tsx
│   │   ├── cta-block.tsx
│   │   ├── faq-block.tsx
│   │   └── block-renderer.tsx      # Dynamic block renderer
│   ├── shared/                     # Reusable across pages
│   │   ├── section-header.tsx
│   │   ├── cta-button.tsx
│   │   ├── image-with-fallback.tsx
│   │   └── contact-form.tsx
│   └── seo/
│       ├── schema-org.tsx          # JSON-LD structured data
│       └── meta-tags.tsx           # Dynamic OG/Twitter meta
│
├── lib/
│   ├── utils.ts                    # cn() + generic utils
│   ├── payload.ts                  # CMS client singleton
│   ├── fetchers.ts                 # Data fetching functions
│   └── validators.ts               # Zod schemas for forms
│
├── hooks/
│   ├── use-scroll-direction.ts
│   ├── use-intersection-observer.ts
│   └── use-media-query.ts
│
├── i18n/
│   ├── config.ts                   # Locale config
│   ├── request.ts                  # Server-side i18n
│   └── navigation.ts               # Localized navigation
│
├── messages/
│   ├── it.json
│   ├── en.json
│   └── cs.json
│
├── types/
│   ├── payload-types.ts            # Auto-generated from CMS
│   └── index.ts
│
└── styles/
    └── fonts.ts                    # next/font declarations
```

## File Chiave: Root Layout

```tsx
// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/config';
import { fontSans, fontDisplay } from '@/styles/fonts';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { cn } from '@/lib/utils';
import '@/app/globals.css';

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale)) notFound();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={cn(fontSans.variable, fontDisplay.variable, 'font-sans antialiased')}>
        <NextIntlClientProvider messages={messages}>
          <Header />
          <main className="min-h-[calc(100vh-4rem)]">
            {children}
          </main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

## Block Renderer Pattern

```tsx
// components/blocks/block-renderer.tsx
import { HeroBlock } from './hero-block';
import { FeaturesBlock } from './features-block';
import { TestimonialsBlock } from './testimonials-block';
import { CTABlock } from './cta-block';
import { FAQBlock } from './faq-block';

const blockComponents = {
  hero: HeroBlock,
  features: FeaturesBlock,
  testimonials: TestimonialsBlock,
  cta: CTABlock,
  faq: FAQBlock,
} as const;

type BlockType = keyof typeof blockComponents;

export function BlockRenderer({ blocks }: { blocks: Array<{ blockType: BlockType; [key: string]: unknown }> }) {
  return (
    <>
      {blocks.map((block, i) => {
        const Component = blockComponents[block.blockType];
        if (!Component) return null;
        return <Component key={`${block.blockType}-${i}`} {...block} />;
      })}
    </>
  );
}
```

## Config Files Standard

| File | Scopo |
|------|-------|
| `next.config.mjs` | Next.js config + next-intl plugin |
| `tailwind.config.ts` | Tailwind v4 (o CSS-first) |
| `tsconfig.json` | Strict mode, path aliases (@/) |
| `postcss.config.js` | Tailwind PostCSS plugin |
| `.env.local` | Environment variables |
| `Dockerfile` | Multi-stage Docker build |
| `docker-compose.yml` | Local dev con hot-reload |
| `.github/workflows/deploy.yml` | CI/CD to Coolify |

## Checklist Nuovo Progetto

- [ ] Scaffold con `create-next-app`
- [ ] next-intl configurato (IT/EN/CZ)
- [ ] Tailwind CSS + shadcn/ui installati
- [ ] Font caricati con next/font
- [ ] Layout base (Header, Footer, Container)
- [ ] CMS client configurato (lib/payload.ts)
- [ ] Revalidation route (/api/revalidate)
- [ ] Block renderer per contenuti CMS
- [ ] robots.ts + sitemap.ts
- [ ] Schema.org JSON-LD
- [ ] .env.local con tutte le variabili
- [ ] Dockerfile multi-stage
- [ ] TypeScript strict mode
