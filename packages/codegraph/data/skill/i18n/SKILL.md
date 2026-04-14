---
name: i18n
description: Internationalization knowledge base - next-intl, routing, SEO multilingua. Use when implementing i18n, adding language support (IT/EN/CZ), setting up locale routing, or translating content in Next.js.
version: 1.0.0
---

# i18n Knowledge Base

## Lingue Supportate

| Code | Lingua | Locale |
|------|--------|--------|
| it | Italiano | it-IT |
| en | English | en-US |
| cs | Čeština | cs-CZ |

## next-intl Setup

```bash
npm install next-intl
```

```typescript
// src/i18n/config.ts
export const locales = ['it', 'en', 'cs'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'it';
```

## Middleware Configuration

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['it', 'en', 'cs'],
  defaultLocale: 'it',
  localePrefix: 'always',
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

## Messages Structure

```json
// messages/it.json
{
  "common": {
    "loading": "Caricamento...",
    "submit": "Invia"
  },
  "home": {
    "title": "Benvenuto",
    "description": "La soluzione per te"
  }
}
```

## Usage in Components

```tsx
import { useTranslations } from 'next-intl';

function Component() {
  const t = useTranslations('home');
  return <h1>{t('title')}</h1>;
}
```

## Pluralization

```json
{
  "items": "{count, plural, =0 {Nessun elemento} one {# elemento} other {# elementi}}"
}
```

```tsx
t('items', { count: 5 }) // "5 elementi"
```

## Language Switcher

```tsx
'use client';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: string) {
    router.push(pathname.replace(`/${locale}`, `/${newLocale}`));
  }

  return (
    <select value={locale} onChange={(e) => switchLocale(e.target.value)}>
      <option value="it">Italiano</option>
      <option value="en">English</option>
      <option value="cs">Čeština</option>
    </select>
  );
}
```

## SEO Multilingua

```tsx
// layout.tsx
export async function generateMetadata({ params: { locale } }) {
  return {
    alternates: {
      languages: {
        'it': '/it',
        'en': '/en',
        'cs': '/cs',
        'x-default': '/it',
      },
    },
  };
}
```

## Date/Number Formatting

```tsx
import { useFormatter } from 'next-intl';

function Formatted() {
  const format = useFormatter();
  
  return (
    <>
      <p>{format.dateTime(new Date(), { dateStyle: 'long' })}</p>
      <p>{format.number(1234.56, { style: 'currency', currency: 'EUR' })}</p>
    </>
  );
}
```

## Checklist

- [ ] Tutte le stringhe in file messaggi
- [ ] Routing con prefisso locale (/it, /en, /cs)
- [ ] Language switcher accessibile
- [ ] hreflang tags in head
- [ ] Sitemap multilingua
- [ ] Pluralization corretta
- [ ] Date/number formatting
