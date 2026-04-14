---
name: astro
description: Astro 5+ knowledge base - Content Collections, Islands, SSG/SSR, integrations. Use when working on an Astro project, building static sites, or migrating from Next.js to Astro.
version: 1.0.0
---

# Astro 5+ Knowledge Base

## Setup

```bash
npm create astro@latest -- --template minimal --typescript strict
```

## Project Structure

```
src/
├── pages/
│   ├── [locale]/
│   │   ├── index.astro
│   │   └── [...slug].astro
│   ├── api/
│   │   └── contact.ts
│   └── robots.txt.ts
├── layouts/
│   └── BaseLayout.astro
├── components/
│   ├── Header.astro
│   └── Footer.astro
├── content/
│   ├── config.ts
│   └── blog/
│       └── post-1.md
├── i18n/
│   ├── it.json
│   └── en.json
├── styles/
│   └── global.css
└── lib/
    └── utils.ts
```

## Pages

```astro
---
// src/pages/[locale]/index.astro
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getTranslations } from '../../i18n';

const { locale } = Astro.params;
const t = getTranslations(locale);
---

<BaseLayout title={t.home.title}>
  <main>
    <h1>{t.home.heading}</h1>
    <p>{t.home.description}</p>
  </main>
</BaseLayout>
```

## Layouts

```astro
---
// src/layouts/BaseLayout.astro
interface Props {
  title: string;
  description?: string;
}

const { title, description = 'Default description' } = Astro.props;
---

<!DOCTYPE html>
<html lang={Astro.currentLocale || 'it'}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width" />
  <meta name="description" content={description} />
  <title>{title}</title>
</head>
<body>
  <slot />
</body>
</html>
```

## Content Collections

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    author: z.string(),
    image: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
```

```astro
---
// src/pages/[locale]/blog/[slug].astro
import { getCollection } from 'astro:content';
import BaseLayout from '../../../layouts/BaseLayout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map(post => ({
    params: { slug: post.slug, locale: 'it' },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await post.render();
---

<BaseLayout title={post.data.title}>
  <article>
    <h1>{post.data.title}</h1>
    <Content />
  </article>
</BaseLayout>
```

## Islands Architecture (React)

```bash
npx astro add react
```

```astro
---
// Interactive React component
import Counter from '../components/Counter';
---

<!-- Static by default -->
<div>Static content</div>

<!-- Hydrate on load -->
<Counter client:load />

<!-- Hydrate when visible -->
<Counter client:visible />

<!-- Hydrate on idle -->
<Counter client:idle />

<!-- Hydrate on media query -->
<Counter client:media="(max-width: 768px)" />
```

## API Endpoints

```typescript
// src/pages/api/contact.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();
  
  // Process...
  
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

## Image Optimization

```astro
---
import { Image } from 'astro:assets';
import heroImage from '../assets/hero.jpg';
---

<Image
  src={heroImage}
  alt="Hero"
  widths={[400, 800, 1200]}
  sizes="(max-width: 800px) 100vw, 800px"
  format="webp"
/>
```

## Integrations

```bash
# Tailwind
npx astro add tailwind

# React
npx astro add react

# Sitemap
npx astro add sitemap

# MDX
npx astro add mdx
```

## SSR Mode

```javascript
// astro.config.mjs
export default defineConfig({
  output: 'server', // or 'hybrid'
  adapter: node({ mode: 'standalone' }),
});
```

## Best Practices

1. **Zero JS by default** - Only add client: when needed
2. **Content Collections** - Type-safe content management
3. **Islands** - Partial hydration for interactivity
4. **Image optimization** - Use astro:assets
5. **Static first** - Use SSG, SSR only when needed
