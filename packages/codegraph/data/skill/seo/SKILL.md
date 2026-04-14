---
name: seo
description: Complete SEO & GEO (Generative Engine Optimization) knowledge base - Metadata, Structured Data, llms.txt, Core Web Vitals. Use when implementing SEO, setting up metadata, optimizing for AI search engines, or improving Core Web Vitals.
version: 1.0.0
---

# SEO & GEO Knowledge Base 2025

## robots.txt

Use Next.js `MetadataRoute.Robots`:

```typescript
// src/app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/', '/tmp/'],
      },
      // Allow AI Crawlers for GEO
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'],
        allow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

## sitemap.ts

Use `MetadataRoute.Sitemap` with static + dynamic pages:

```typescript
// src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { getPosts } from '@/lib/cms';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPosts();
  
  const staticPages = ['', '/chi-siamo', '/servizi', '/contatti'].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const dynamicPages = posts.map(post => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...dynamicPages];
}
```

## Root Layout Metadata

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL!),
  title: {
    default: 'Brand Name | Main Keyword',
    template: '%s | Brand Name',
  },
  description: 'Persuasive description including main keywords (150-160 chars).',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: './',
  },
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    siteName: 'Brand Name',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@brand_handle',
  },
};
```

## Structured Data (JSON-LD)

Use JSON-LD for Organization schema:

```tsx
// src/components/seo/schema-org.tsx
export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Brand Name',
    url: process.env.NEXT_PUBLIC_SITE_URL,
    logo: `${process.env.NEXT_PUBLIC_SITE_URL}/logo.png`,
    sameAs: [
      'https://linkedin.com/company/brand',
      'https://twitter.com/brand'
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+39-02-12345678',
      contactType: 'customer service',
      availableLanguage: ['Italian', 'English']
    }
  };
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

## GEO (Generative Engine Optimization)

Optimization for AI search engines (ChatGPT, Perplexity, Gemini).

### Content Structure for AI
- **Direct Answers**: First 40-60 words should directly answer the main user query
- **Q&A Format**: Use H2/H3 for questions, paragraphs for answers
- **Statistics**: Include data points every 150-200 words
- **Sources**: Link to authoritative sources (increase citation probability)
- **Structure**: Use bullet points and tables

### llms.txt Standard

Place at `public/llms.txt`:

```markdown
# Project Name

> Concise description of the project (1-2 sentences).

## Documentation
- [Get Started](/docs/start): Initial setup
- [API](/docs/api): API Reference
- [FAQ](/faq): Common questions

## Core Concepts
- Concept 1: Description
- Concept 2: Description

## Resources
- [Pricing](/pricing)
- [Blog](/blog)
```

## Core Web Vitals Optimization

| Metric | Target | Optimization |
|--------|--------|--------------|
| **LCP** | < 2.5s | Preload hero images, use next/image, optimize fonts |
| **INP** | < 200ms | Reduce JS bloat, use Transition API, optimize event handlers |
| **CLS** | < 0.1 | Explicit width/height for media, reserve space for ads/embeds |

### Optimization Techniques
- **Images**: Use `next/image` with `sizes` prop
- **Fonts**: Use `next/font` (self-hosted variable fonts)
- **Scripts**: Use `next/script` with `strategy="lazyOnload"` or `worker`

## International SEO (Hreflang)

```typescript
// layout.tsx
export const metadata = {
  alternates: {
    canonical: 'https://site.com/it',
    languages: {
      'it': 'https://site.com/it',
      'en': 'https://site.com/en',
      'x-default': 'https://site.com/en',
    },
  },
}
```

## Mobile First

- **Touch Targets**: Min 48x48px
- **Font Size**: Min 16px
- **Viewport**: `width=device-width, initial-scale=1`
- **Content Parity**: Same content on mobile and desktop
