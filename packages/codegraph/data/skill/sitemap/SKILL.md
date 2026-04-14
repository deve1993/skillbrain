---
name: sitemap
description: Sitemap knowledge base - XML sitemap generation, XSL styling, hreflang, sitemap index for Next.js. Use when creating or improving XML sitemaps, adding hreflang sitemap entries, or implementing sitemap index files.
version: 1.0.0
---

# Sitemap Skill

Knowledge base per generazione sitemap XML ottimizzate con XSL styling.

## Sitemap Next.js (App Router)

### Sitemap Base

```typescript
// app/sitemap.ts
import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const locales = ['it', 'en', 'cs'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ['', '/chi-siamo', '/servizi', '/contatti'];
  const legalRoutes = ['/privacy', '/cookie-policy', '/terms'];

  // Static pages per locale
  const staticPages = locales.flatMap(locale =>
    staticRoutes.map(route => ({
      url: `${BASE_URL}/${locale}${route}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: route === '' ? 1.0 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          locales.map(l => [l, `${BASE_URL}/${l}${route}`])
        ),
      },
    }))
  );

  // Legal pages (lower priority)
  const legalPages = locales.flatMap(locale =>
    legalRoutes.map(route => ({
      url: `${BASE_URL}/${locale}${route}`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    }))
  );

  // Dynamic pages from CMS
  const dynamicPages = await getDynamicPages();

  return [...staticPages, ...legalPages, ...dynamicPages];
}

async function getDynamicPages(): Promise<MetadataRoute.Sitemap> {
  // Fetch from Payload CMS
  const payload = await getPayloadClient();

  // Blog posts
  const { docs: posts } = await payload.find({
    collection: 'posts',
    where: { status: { equals: 'published' } },
    limit: 1000,
  });

  return locales.flatMap(locale =>
    posts.map(post => ({
      url: `${BASE_URL}/${locale}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
      alternates: {
        languages: Object.fromEntries(
          locales.map(l => [l, `${BASE_URL}/${l}/blog/${post.slug}`])
        ),
      },
    }))
  );
}
```

### Sitemap con XSL Styling

Per una sitemap leggibile da umani, usa un foglio XSL:

```xml
<!-- public/sitemap.xsl -->
<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9">

  <xsl:output method="html" indent="yes" encoding="UTF-8"/>

  <xsl:template match="/">
    <html>
      <head>
        <title>Sitemap — [SITE NAME]</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 2rem; }
          h1 { color: #1e293b; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th { background: #f1f5f9; text-align: left; padding: 0.75rem; }
          td { padding: 0.75rem; border-bottom: 1px solid #e2e8f0; }
          a { color: #3b82f6; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .count { color: #64748b; margin-bottom: 1rem; }
        </style>
      </head>
      <body>
        <h1>Sitemap</h1>
        <p class="count">
          <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/> URLs
        </p>
        <table>
          <tr>
            <th>URL</th>
            <th>Priority</th>
            <th>Change Freq</th>
            <th>Last Modified</th>
          </tr>
          <xsl:for-each select="sitemap:urlset/sitemap:url">
            <xsl:sort select="sitemap:priority" order="descending"/>
            <tr>
              <td><a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a></td>
              <td><xsl:value-of select="sitemap:priority"/></td>
              <td><xsl:value-of select="sitemap:changefreq"/></td>
              <td><xsl:value-of select="sitemap:lastmod"/></td>
            </tr>
          </xsl:for-each>
        </table>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
```

**Nota**: Next.js `MetadataRoute.Sitemap` non supporta nativamente XSL. Per aggiungere il processing instruction, usa un Route Handler custom:

```typescript
// app/sitemap.xml/route.ts
import { getPayloadClient } from '@/lib/payload';

export async function GET() {
  const entries = await buildSitemapEntries();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map(entry => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastModified}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority}</priority>
${entry.alternates ? Object.entries(entry.alternates).map(([lang, url]) =>
    `    <xhtml:link rel="alternate" hreflang="${lang}" href="${url}"/>`
  ).join('\n') : ''}
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
```

---

## Sitemap Index (per siti grandi)

Se il sito ha >50.000 URL, usa un sitemap index:

```typescript
// app/sitemap.xml/route.ts
export async function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE_URL}/sitemap-pages.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-blog.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
</sitemapindex>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
```

---

## Robots.txt + Sitemap Reference

```typescript
// app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/'] },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
```

---

## Checklist Sitemap

- [ ] sitemap.ts o sitemap.xml/route.ts creato
- [ ] Tutte le pagine statiche incluse
- [ ] Pagine dinamiche dal CMS incluse
- [ ] Hreflang alternates per ogni locale
- [ ] Priority corrette (home=1.0, pages=0.8, blog=0.6, legal=0.3)
- [ ] robots.ts con riferimento a sitemap
- [ ] Sitemap registrata in Google Search Console
- [ ] XSL styling per leggibilità umana (opzionale)
- [ ] Cache headers per performance
