---
name: nextjs
description: Next.js 15+ knowledge base - App Router, Server Components, API Routes, best practices. Use when building Next.js apps, setting up App Router, implementing Server Actions, or optimizing performance.
version: 1.0.0
context: "bash .Claude/scripts/load_project_context.sh"
---

# Next.js 15+ Knowledge Base

## App Router Structure

```
src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx        # Root layout per locale
│   │   ├── page.tsx          # Home page
│   │   ├── loading.tsx       # Loading UI
│   │   ├── error.tsx         # Error UI
│   │   ├── not-found.tsx     # 404 page
│   │   └── (routes)/
│   │       ├── about/
│   │       │   └── page.tsx
│   │       └── contact/
│   │           └── page.tsx
│   ├── api/
│   │   └── health/
│   │       └── route.ts
│   └── globals.css
├── components/
│   ├── ui/                   # shadcn components
│   └── shared/               # custom components
├── lib/
│   ├── utils.ts
│   └── validators.ts
├── hooks/
├── types/
└── i18n/
```

## Server Components with next-intl

```tsx
// app/[locale]/page.tsx
import { getTranslations } from 'next-intl/server';

export default async function HomePage({
  params: { locale }
}: {
  params: { locale: string }
}) {
  const t = await getTranslations('home');
  
  return (
    <main>
      <h1>{t('title')}</h1>
    </main>
  );
}
```

## Server Actions with Validation

```tsx
// app/actions/contact.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(10),
});

export async function submitContact(formData: FormData) {
  const data = schema.parse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  });

  // Process data...
  
  revalidatePath('/contact');
  return { success: true };
}
```

## Metadata & Dynamic SEO

```tsx
// app/[locale]/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'My Site',
    template: '%s | My Site',
  },
  description: 'Site description',
};

// Dynamic metadata per page
export async function generateMetadata({ params }) {
  return {
    title: `Page Title`,
  };
}
```

## Data Fetching with ISR

```tsx
// Server Component with fetch
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 }, // ISR: revalidate every hour
  });
  return res.json();
}

// Static generation per locale
export async function generateStaticParams() {
  return [{ locale: 'it' }, { locale: 'en' }, { locale: 'cs' }];
}
```

## Middleware with next-intl

```tsx
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['it', 'en', 'cs'],
  defaultLocale: 'it',
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

## Environment Variables

```bash
# Server only
DATABASE_URL=
AUTH_SECRET=

# Client accessible
NEXT_PUBLIC_API_URL=
```

## Key Patterns

1. **Server Components by default** - Only use 'use client' when needed
2. **Server Actions** - Use for form submissions with validation
3. **ISR** - Use revalidate for semi-static content
4. **Metadata** - Use generateMetadata for dynamic SEO
