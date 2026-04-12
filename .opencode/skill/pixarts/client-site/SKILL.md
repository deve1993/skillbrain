---
name: pixarts/client-site
description: Pixarts client site stack - Next.js, Payload CMS, shadcn/ui, i18n, Tailwind. Use when building frontend for Pixarts client projects, setting up standard stack, or implementing multi-tenant architecture.
version: 1.0.0
context: "bash .Claude/scripts/load_project_context.sh"
---

# Client Site Stack Skill

Stack tecnologico e pattern standard per siti frontend client Pixarts.

## Stack Tecnologico

| Layer | Tecnologia | Versione |
|-------|------------|----------|
| Framework | Next.js | 15+ |
| Language | TypeScript | 5+ |
| Styling | Tailwind CSS | 4+ |
| UI Components | shadcn/ui | latest |
| Animation | Framer Motion | 11+ |
| i18n | next-intl | 3+ |
| Forms | react-hook-form + Zod | latest |
| Icons | Lucide React | latest |
| CMS | Payload CMS | 3.0 |

## Struttura Progetto

```
[client]-site/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx          # Layout con header/footer
│   │   │   ├── page.tsx            # Homepage
│   │   │   ├── not-found.tsx
│   │   │   ├── error.tsx
│   │   │   ├── loading.tsx
│   │   │   └── (routes)/
│   │   │       ├── chi-siamo/
│   │   │       │   └── page.tsx
│   │   │       ├── servizi/
│   │   │       │   └── page.tsx
│   │   │       └── contatti/
│   │   │           └── page.tsx
│   │   ├── api/
│   │   │   ├── revalidate/
│   │   │   │   └── route.ts
│   │   │   ├── contact/
│   │   │   │   └── route.ts
│   │   │   └── health/
│   │   │       └── route.ts
│   │   ├── globals.css
│   │   └── layout.tsx              # Root layout (fonts)
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── footer.tsx
│   │   │   ├── mobile-nav.tsx
│   │   │   └── language-switcher.tsx
│   │   ├── sections/
│   │   │   ├── hero.tsx
│   │   │   ├── features.tsx
│   │   │   ├── services.tsx
│   │   │   ├── testimonials.tsx
│   │   │   ├── faq.tsx
│   │   │   ├── cta.tsx
│   │   │   ├── contact-form.tsx
│   │   │   └── map.tsx
│   │   └── shared/
│   │       ├── container.tsx
│   │       ├── section.tsx
│   │       ├── heading.tsx
│   │       └── animated-element.tsx
│   │
│   ├── lib/
│   │   ├── utils.ts               # cn() utility
│   │   ├── payload.ts             # CMS client
│   │   ├── validators.ts          # Zod schemas
│   │   └── constants.ts
│   │
│   ├── hooks/
│   │   ├── use-scroll.ts
│   │   ├── use-media-query.ts
│   │   └── use-intersection.ts
│   │
│   ├── types/
│   │   ├── payload.d.ts           # CMS types
│   │   └── index.ts
│   │
│   ├── i18n/
│   │   ├── config.ts
│   │   ├── request.ts
│   │   └── messages/
│   │       ├── it.json
│   │       ├── en.json
│   │       └── cs.json
│   │
│   └── config/
│       ├── site.ts                # Metadata sito
│       └── navigation.ts          # Menu items
│
├── public/
│   ├── fonts/
│   ├── images/
│   └── favicon.ico
│
├── .env.local
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── middleware.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## File Essenziali

### lib/utils.ts

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, locale = 'it') {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}
```

### lib/payload.ts

```typescript
const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL!;
const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG!;

interface FetchOptions extends Omit<RequestInit, 'next'> {
  tags?: string[];
  revalidate?: number | false;
}

export async function fetchFromCMS<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { tags, revalidate = 3600, ...fetchOptions } = options;

  const url = new URL(`/api${endpoint}`, CMS_URL);

  const res = await fetch(url.toString(), {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
    next: {
      tags,
      revalidate,
    },
  });

  if (!res.ok) {
    console.error(`CMS Error: ${res.status} ${res.statusText}`);
    throw new Error(`CMS Error: ${res.status}`);
  }

  return res.json();
}

// Helpers
export async function getTenant() {
  const { docs } = await fetchFromCMS<{ docs: Tenant[] }>(
    `/tenants?where[slug][equals]=${TENANT_SLUG}`,
    { tags: ['tenant'], revalidate: 86400 }
  );
  return docs[0];
}

export async function getPage(slug: string, locale: string) {
  const tenant = await getTenant();
  const { docs } = await fetchFromCMS<{ docs: Page[] }>(
    `/pages?where[slug][equals]=${slug}&where[tenant][equals]=${tenant.id}&where[status][equals]=published&locale=${locale}&depth=2`,
    { tags: ['pages', `page-${slug}`] }
  );
  return docs[0] ?? null;
}

export async function getHeader(locale: string) {
  const tenant = await getTenant();
  const { docs } = await fetchFromCMS<{ docs: Header[] }>(
    `/headers?where[tenant][equals]=${tenant.id}&locale=${locale}`,
    { tags: ['header'] }
  );
  return docs[0];
}

export async function getFooter(locale: string) {
  const tenant = await getTenant();
  const { docs } = await fetchFromCMS<{ docs: Footer[] }>(
    `/footers?where[tenant][equals]=${tenant.id}&locale=${locale}`,
    { tags: ['footer'] }
  );
  return docs[0];
}

export async function getServices(locale: string) {
  const tenant = await getTenant();
  return fetchFromCMS<{ docs: Service[] }>(
    `/services?where[tenant][equals]=${tenant.id}&locale=${locale}&sort=order`,
    { tags: ['services'] }
  );
}

export async function getTestimonials(locale: string) {
  const tenant = await getTenant();
  return fetchFromCMS<{ docs: Testimonial[] }>(
    `/testimonials?where[tenant][equals]=${tenant.id}&locale=${locale}`,
    { tags: ['testimonials'] }
  );
}

export async function getFAQs(locale: string) {
  const tenant = await getTenant();
  return fetchFromCMS<{ docs: FAQ[] }>(
    `/faq?where[tenant][equals]=${tenant.id}&locale=${locale}&sort=order`,
    { tags: ['faq'] }
  );
}
```

### config/site.ts

```typescript
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || 'Site Name',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com',
  description: 'Site description for SEO',
  ogImage: '/og-image.jpg',
  links: {
    instagram: '',
    facebook: '',
    linkedin: '',
  },
  contact: {
    email: '',
    phone: '',
    address: '',
  },
};
```

### i18n/config.ts

```typescript
export const locales = ['it', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'it';

export const localeNames: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
};

export const localeFlags: Record<Locale, string> = {
  it: '🇮🇹',
  en: '🇬🇧',
};
```

### middleware.ts

```typescript
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

## Componenti Standard

### Container

```typescript
// components/shared/container.tsx
import { cn } from '@/lib/utils';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'full';
}

const sizes = {
  sm: 'max-w-4xl',
  default: 'max-w-7xl',
  lg: 'max-w-screen-2xl',
  full: 'max-w-none',
};

export function Container({ children, className, size = 'default' }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', sizes[size], className)}>
      {children}
    </div>
  );
}
```

### Section

```typescript
// components/shared/section.tsx
import { cn } from '@/lib/utils';

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  background?: 'default' | 'muted' | 'primary';
}

const backgrounds = {
  default: '',
  muted: 'bg-muted/50',
  primary: 'bg-primary text-primary-foreground',
};

export function Section({ children, className, id, background = 'default' }: SectionProps) {
  return (
    <section
      id={id}
      className={cn('py-16 md:py-24', backgrounds[background], className)}
    >
      {children}
    </section>
  );
}
```

### AnimatedElement

```typescript
// components/shared/animated-element.tsx
'use client';

import { motion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

interface AnimatedElementProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const variants: Record<string, Variants> = {
  up: {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  },
  down: {
    hidden: { opacity: 0, y: -30 },
    visible: { opacity: 1, y: 0 },
  },
  left: {
    hidden: { opacity: 0, x: 30 },
    visible: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0 },
  },
};

export function AnimatedElement({
  children,
  className,
  delay = 0,
  direction = 'up',
}: AnimatedElementProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay }}
      variants={variants[direction]}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

## API Routes

### Revalidate

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { collection, slug } = body;

    // Revalidate collection tag
    revalidateTag(collection);

    // Revalidate specific item if slug provided
    if (slug) {
      revalidateTag(`${collection.slice(0, -1)}-${slug}`);
    }

    return NextResponse.json({
      revalidated: true,
      collection,
      slug,
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

### Contact

```typescript
// app/api/contact/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().min(10),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = contactSchema.parse(body);

    // Salva in CMS come FormSubmission
    const response = await fetch(`${process.env.NEXT_PUBLIC_CMS_URL}/api/form-submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PAYLOAD_API_TOKEN}`,
      },
      body: JSON.stringify({
        form: 'contact',
        submissionData: data,
        tenant: process.env.TENANT_ID,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save submission');
    }

    // Invia email notifica (opzionale)
    // await sendNotificationEmail(data);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### Health

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
```

## Environment Variables

```env
# .env.local

# CMS
NEXT_PUBLIC_CMS_URL=https://cms.pixarts.eu
NEXT_PUBLIC_TENANT_SLUG=nome-cliente
PAYLOAD_API_TOKEN=token-sola-lettura

# Site
NEXT_PUBLIC_SITE_URL=https://nome-cliente.it
NEXT_PUBLIC_SITE_NAME=Nome Cliente

# Revalidation
REVALIDATION_SECRET=genera-stringa-32-caratteri

# Locales
NEXT_PUBLIC_DEFAULT_LOCALE=it
NEXT_PUBLIC_LOCALES=it,en

# Analytics (opzionale)
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=nome-cliente.it
```

## Docker

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm && pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

## Best Practices

1. **Server Components di default** - usa 'use client' solo quando necessario
2. **Fetch con cache tags** - per revalidation granulare
3. **Parallel data fetching** - Promise.all per query multiple
4. **Error boundaries** - gestisci errori gracefully
5. **Loading states** - usa loading.tsx e Suspense
6. **Accessibilita** - semantic HTML, ARIA labels
7. **Performance** - lazy load images, code splitting
