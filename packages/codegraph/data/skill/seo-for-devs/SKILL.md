---
name: seo-for-devs
description: Technical SEO for developers knowledge base - Next.js metadata, robots.txt, sitemap, structured data, Core Web Vitals. Use when implementing technical SEO in Next.js, configuring metadata, optimizing performance for search engines.
version: 1.0.0
---

# SEO for Devs Skill

Knowledge base per Technical SEO in applicazioni Next.js, React e framework moderni.

## Fondamenti Technical SEO

### Rendering e Indicizzazione

| Metodo | SEO Score | Quando Usare |
|--------|-----------|--------------|
| **SSG (Static)** | ⭐⭐⭐⭐⭐ | Blog, docs, landing page |
| **SSR (Server)** | ⭐⭐⭐⭐ | E-commerce, contenuti dinamici |
| **ISR (Incremental)** | ⭐⭐⭐⭐⭐ | Best of both: statico + fresco |
| **CSR (Client)** | ⭐⭐ | Dashboard, app autenticate |

**Regola**: Tutto ciò che deve essere indicizzato → SSG o SSR.

---

## Next.js SEO Implementation

### Metadata API (App Router)

```typescript
// app/layout.tsx - Metadata globale
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://tuodominio.com'),
  title: {
    default: 'Nome Azienda | Tagline Breve',
    template: '%s | Nome Azienda',
  },
  description: 'Descrizione principale del sito (max 160 caratteri).',
  keywords: ['keyword1', 'keyword2', 'keyword3'],
  authors: [{ name: 'Nome Azienda' }],
  creator: 'Nome Azienda',
  publisher: 'Nome Azienda',
  
  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: 'https://tuodominio.com',
    siteName: 'Nome Azienda',
    title: 'Nome Azienda | Tagline Breve',
    description: 'Descrizione per social media.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Nome Azienda',
      },
    ],
  },
  
  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'Nome Azienda | Tagline Breve',
    description: 'Descrizione per Twitter.',
    creator: '@twitterhandle',
    images: ['/twitter-image.jpg'],
  },
  
  // Robots
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
  
  // Verifica proprietà
  verification: {
    google: 'google-site-verification-code',
    // yandex: 'yandex-verification-code',
  },
  
  // Alternate languages
  alternates: {
    canonical: 'https://tuodominio.com',
    languages: {
      'it-IT': 'https://tuodominio.com/it',
      'en-US': 'https://tuodominio.com/en',
    },
  },
}
```

### Dynamic Metadata per Pagine

```typescript
// app/blog/[slug]/page.tsx
import type { Metadata } from 'next'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug)
  
  if (!post) {
    return {
      title: 'Post non trovato',
    }
  }

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author.name }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      images: [
        {
          url: post.featuredImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [post.featuredImage],
    },
  }
}
```

---

## Schema.org / Structured Data

### Schema Deprecation Awareness (2023-2025)

| Schema Type | Status | Data | Note |
|-------------|--------|------|------|
| **HowTo** | DEPRECATO | Sept 2023 | Non genera più rich results. Non usare. |
| **FAQ** | RISTRETTO | Aug 2023 | Solo siti gov/health autorevoli. |
| **SpecialAnnouncement** | DEPRECATO | July 2025 | Rimosso completamente. |
| **VideoObject** | ATTIVO | - | Supporta live streaming + key moments |
| **Organization** | ATTIVO | - | Sempre raccomandato |
| **Product** | ATTIVO | - | Con AggregateRating per e-commerce |
| **BreadcrumbList** | ATTIVO | - | Sempre raccomandato |
| **Article** | ATTIVO | - | Per blog/news |

> **Regola**: Mai raccomandare HowTo schema. FAQ schema solo per gov/health. Verificare sempre lo stato attuale su [Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/search-gallery).

### Organization Schema

```typescript
// components/schema/organization.tsx
export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Nome Azienda',
    url: 'https://tuodominio.com',
    logo: 'https://tuodominio.com/logo.png',
    sameAs: [
      'https://twitter.com/handle',
      'https://linkedin.com/company/handle',
      'https://github.com/handle',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+39-XXX-XXXXXXX',
      contactType: 'sales',
      availableLanguage: ['Italian', 'English'],
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

### Service Schema (per servizi di sviluppo)

```typescript
// components/schema/service.tsx
export function ServiceSchema({ service }: { service: Service }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    provider: {
      '@type': 'Organization',
      name: 'Nome Azienda',
      url: 'https://tuodominio.com',
    },
    serviceType: 'Web Development',
    areaServed: {
      '@type': 'Country',
      name: 'Italy',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Servizi di Sviluppo',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Design System Development',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Landing Page Optimization',
          },
        },
      ],
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

### SoftwareApplication Schema

```typescript
// Per prodotti SaaS
export function SoftwareSchema({ product }: { product: Product }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: product.name,
    description: product.description,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'EUR',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      ratingCount: product.reviewCount,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

### FAQ Schema

> **DEPRECATION WARNING (Aug 2023)**: Google ha ristretto FAQ rich results solo a siti **governativi e sanitari** autorevoli. Per tutti gli altri siti, FAQPage schema non genera più rich snippets in SERP. Usalo solo se il sito rientra in queste categorie. In alternativa, struttura le FAQ come contenuto normale con heading H2/H3 — è comunque utile per GEO (AI Search).

```typescript
// components/schema/faq.tsx
// NOTA: Genera rich results SOLO per siti gov/health.
// Per altri siti, il markup è comunque utile per AI search (GEO).
export function FAQSchema({ faqs }: { faqs: FAQ[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

### BreadcrumbList Schema

```typescript
// components/schema/breadcrumb.tsx
export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

---

## Sitemap e Robots

### Sitemap Dinamica

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://tuodominio.com'
  
  // Pagine statiche
  const staticPages = [
    '',
    '/about',
    '/services',
    '/contact',
    '/pricing',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  // Pagine dinamiche (blog)
  const posts = await getAllPosts()
  const blogPages = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  // Pagine servizi
  const services = await getAllServices()
  const servicePages = services.map((service) => ({
    url: `${baseUrl}/services/${service.slug}`,
    lastModified: new Date(service.updatedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }))

  return [...staticPages, ...blogPages, ...servicePages]
}
```

### Robots.txt

```typescript
// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/'],
      },
    ],
    sitemap: 'https://tuodominio.com/sitemap.xml',
  }
}
```

---

## Core Web Vitals Optimization

### LCP (Largest Contentful Paint) < 2.5s

```typescript
// 1. Preload hero image
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <link
          rel="preload"
          href="/hero-image.webp"
          as="image"
          type="image/webp"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

// 2. Priority per immagini above-the-fold
import Image from 'next/image'

<Image
  src="/hero.webp"
  alt="Hero"
  width={1200}
  height={630}
  priority // Carica subito, senza lazy loading
  sizes="100vw"
/>

// 3. Font optimization
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Evita FOIT
  preload: true,
})
```

### INP (Interaction to Next Paint) < 200ms

```typescript
// 1. Evita hydration blocking
// Usa Server Components di default

// 2. Per interazioni pesanti, usa useTransition
'use client'
import { useTransition } from 'react'

function SearchComponent() {
  const [isPending, startTransition] = useTransition()
  
  const handleSearch = (query: string) => {
    startTransition(() => {
      // Operazione pesante non blocca l'UI
      performSearch(query)
    })
  }
  
  return (
    <input 
      onChange={(e) => handleSearch(e.target.value)}
      className={isPending ? 'opacity-50' : ''}
    />
  )
}

// 3. Lazy load componenti non critici
import dynamic from 'next/dynamic'

const HeavyChart = dynamic(() => import('./Chart'), {
  loading: () => <Skeleton className="h-64" />,
  ssr: false,
})
```

### CLS (Cumulative Layout Shift) < 0.1

```typescript
// 1. Sempre dimensioni esplicite per immagini
<Image
  src="/image.jpg"
  alt="..."
  width={800}  // Sempre specificare
  height={600} // Sempre specificare
/>

// 2. Skeleton per contenuti dinamici
function PostList() {
  const { data, isLoading } = usePosts()
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }
  
  return <>{/* actual content */}</>
}

// 3. Font con size-adjust
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: true, // Previene layout shift da font
})

// 4. Riservare spazio per ads/embeds
<div className="min-h-[250px]"> {/* Altezza minima riservata */}
  <AdComponent />
</div>
```

---

## Programmatic SEO

### Generazione Pagine in Bulk

```typescript
// app/[location]/[service]/page.tsx
// Genera pagine tipo: /milano/sviluppo-react, /roma/design-system

export async function generateStaticParams() {
  const locations = ['milano', 'roma', 'torino', 'bologna']
  const services = ['sviluppo-react', 'design-system', 'landing-page']
  
  const params = []
  for (const location of locations) {
    for (const service of services) {
      params.push({ location, service })
    }
  }
  
  return params // Genera 12 pagine
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locationName = capitalizeLocation(params.location)
  const serviceName = formatServiceName(params.service)
  
  return {
    title: `${serviceName} a ${locationName} | Nome Azienda`,
    description: `Cerchi servizi di ${serviceName.toLowerCase()} a ${locationName}? 
                  Scopri le nostre soluzioni per aziende in ${locationName}.`,
  }
}

export default function LocationServicePage({ params }: Props) {
  const { location, service } = params
  
  return (
    <>
      <h1>{formatServiceName(service)} a {capitalizeLocation(location)}</h1>
      {/* Contenuto dinamico basato su location e service */}
    </>
  )
}
```

### Template per Contenuti Dinamici

```typescript
// lib/seo-templates.ts
export function generateServicePageContent(
  location: string,
  service: string,
  data: ServiceData
) {
  return {
    title: `${service} a ${location}`,
    h1: `Servizi di ${service} a ${location}`,
    intro: `Stai cercando un partner affidabile per ${service.toLowerCase()} 
            a ${location}? Con oltre ${data.yearsExperience} anni di esperienza 
            e ${data.projectsCompleted}+ progetti completati, siamo la scelta 
            giusta per la tua azienda.`,
    benefits: [
      `Team locale a ${location}`,
      `${data.averageDeliveryTime} giorni di delivery media`,
      `${data.satisfactionRate}% tasso di soddisfazione`,
    ],
    cta: `Richiedi un preventivo per ${service} a ${location}`,
  }
}
```

---

## Link Building Interno

### Struttura Silo

```
/
├── /servizi/
│   ├── /servizi/sviluppo-frontend/
│   │   ├── /servizi/sviluppo-frontend/react/
│   │   ├── /servizi/sviluppo-frontend/nextjs/
│   │   └── /servizi/sviluppo-frontend/vue/
│   ├── /servizi/design-system/
│   └── /servizi/landing-page/
├── /blog/
│   ├── /blog/categoria/react/
│   │   ├── /blog/ottimizzare-performance-react/
│   │   └── /blog/server-components-guida/
│   └── /blog/categoria/seo/
└── /case-study/
```

### Componente Link Contestuali

```typescript
// components/related-links.tsx
export function RelatedLinks({ currentSlug, category }: Props) {
  const relatedPosts = getRelatedPosts(currentSlug, category, 3)
  
  return (
    <aside className="mt-12 p-6 bg-muted rounded-lg">
      <h3 className="font-bold mb-4">Articoli correlati</h3>
      <ul className="space-y-2">
        {relatedPosts.map((post) => (
          <li key={post.slug}>
            <Link 
              href={`/blog/${post.slug}`}
              className="text-primary hover:underline"
            >
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  )
}
```

---

## Internazionalizzazione SEO

### hreflang Implementation

```typescript
// app/[locale]/layout.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = params
  
  return {
    alternates: {
      canonical: `https://tuodominio.com/${locale}`,
      languages: {
        'it-IT': 'https://tuodominio.com/it',
        'en-US': 'https://tuodominio.com/en',
        'x-default': 'https://tuodominio.com/it',
      },
    },
  }
}
```

### Sitemap Multilingua

```typescript
// app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = ['it', 'en']
  const baseUrl = 'https://tuodominio.com'
  
  const pages = ['', '/about', '/services', '/contact']
  
  return pages.flatMap((page) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}${page}`,
      lastModified: new Date(),
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${baseUrl}/${l}${page}`])
        ),
      },
    }))
  )
}
```

---

## Monitoring e Debug

### Google Search Console Integration

```typescript
// lib/search-console.ts
// Esempio di tracking per monitoraggio interno

export async function trackIndexStatus(urls: string[]) {
  // Implementa tracking interno
  // per monitorare lo stato di indicizzazione
}
```

### Schema Validation

```bash
# Test schema con Google Rich Results Test
# https://search.google.com/test/rich-results

# Oppure usa schema-dts per type safety
npm install schema-dts
```

```typescript
import type { Organization, WithContext } from 'schema-dts'

const org: WithContext<Organization> = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Nome Azienda',
  // TypeScript ti avvisa se manca qualcosa
}
```

---

## Checklist SEO Tecnico

### Pre-Launch
- [ ] Metadata su tutte le pagine
- [ ] Open Graph images (1200x630)
- [ ] Schema.org Organization
- [ ] Schema.org per tipo pagina (FAQ, Service, etc.)
- [ ] Sitemap.xml generata
- [ ] Robots.txt configurato
- [ ] Canonical URLs
- [ ] hreflang (se multilingua)

### Performance
- [ ] LCP < 2.5s
- [ ] INP < 200ms
- [ ] CLS < 0.1
- [ ] Immagini WebP/AVIF
- [ ] Font ottimizzati (display: swap)

### Post-Launch
- [ ] Search Console configurato
- [ ] Sitemap inviata
- [ ] Monitoraggio indicizzazione
- [ ] Tracking Core Web Vitals
- [ ] Link building interno attivo
