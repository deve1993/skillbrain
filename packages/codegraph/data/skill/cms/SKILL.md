---
name: cms
description: Headless CMS integration knowledge base - Sanity, Strapi, Contentful, GROQ queries, Portable Text, draft mode. Use when integrating a headless CMS, setting up content collections, or implementing preview/revalidation.
version: 1.0.0
---

# CMS Headless Skill

Knowledge base per integrare CMS headless in applicazioni frontend moderne.

## Provider Raccomandati

| CMS | Tipo | Free Tier | Best For |
|-----|------|-----------|----------|
| **Sanity** | API-first, real-time | Generous | Blog, Portfolio, E-commerce |
| **Strapi** | Self-hosted, open source | Unlimited | Full control, custom |
| **Contentful** | Enterprise, CDN globale | Limited | Large teams, enterprise |
| **Payload** | Code-first, TypeScript | Self-hosted | Developers, custom admin |

---

## Sanity (Raccomandato)

### Installazione

```bash
# Crea nuovo progetto Sanity
npm create sanity@latest -- --template clean --create-project "My Project" --dataset production

# In progetto esistente
pnpm add @sanity/client @sanity/image-url next-sanity
```

### Client Setup

```typescript
// lib/sanity/client.ts
import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: process.env.NODE_ENV === 'production',
})

// Per mutations (server-side only)
export const writeClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
})

// Image URL builder
const builder = imageUrlBuilder(client)

export function urlFor(source: any) {
  return builder.image(source)
}
```

### Schema Definition

```typescript
// sanity/schemas/post.ts
import { defineType, defineField } from 'sanity'

export const post = defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: [{ type: 'author' }],
    }),
    defineField({
      name: 'mainImage',
      title: 'Main Image',
      type: 'image',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alternative Text',
        },
      ],
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent', // Portable Text
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'category' }] }],
    }),
  ],
  preview: {
    select: {
      title: 'title',
      author: 'author.name',
      media: 'mainImage',
    },
  },
})
```

### GROQ Queries

```typescript
// lib/sanity/queries.ts
import { groq } from 'next-sanity'

// Get all posts
export const postsQuery = groq`
  *[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    mainImage {
      asset->,
      alt
    },
    author->{
      name,
      image
    },
    categories[]->{
      title,
      slug
    }
  }
`

// Get single post by slug
export const postQuery = groq`
  *[_type == "post" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    publishedAt,
    body,
    mainImage {
      asset->,
      alt
    },
    author->{
      name,
      image,
      bio
    },
    categories[]->{
      title,
      slug
    },
    "relatedPosts": *[_type == "post" && slug.current != $slug && count(categories[@._ref in ^.^.categories[]._ref]) > 0] | order(publishedAt desc) [0...3] {
      title,
      slug,
      mainImage
    }
  }
`

// Get posts by category
export const postsByCategoryQuery = groq`
  *[_type == "post" && $categorySlug in categories[]->slug.current] | order(publishedAt desc) {
    _id,
    title,
    slug,
    publishedAt,
    mainImage
  }
`
```

### Data Fetching (Next.js)

```typescript
// lib/sanity/fetch.ts
import { client } from './client'
import { postsQuery, postQuery } from './queries'

export async function getPosts() {
  return client.fetch(postsQuery)
}

export async function getPost(slug: string) {
  return client.fetch(postQuery, { slug })
}

// Con caching Next.js 14+
export async function getPostsCached() {
  return client.fetch(
    postsQuery,
    {},
    {
      next: {
        revalidate: 60, // Revalidate every 60 seconds
        tags: ['posts'],
      },
    }
  )
}
```

### Page Component

```typescript
// app/blog/[slug]/page.tsx
import { getPost, getPosts } from '@/lib/sanity/fetch'
import { urlFor } from '@/lib/sanity/client'
import { PortableText } from '@portabletext/react'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  const posts = await getPosts()
  return posts.map((post: any) => ({
    slug: post.slug.current,
  }))
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)
  if (!post) return {}
  
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      images: [urlFor(post.mainImage).width(1200).height(630).url()],
    },
  }
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)
  
  if (!post) {
    notFound()
  }

  return (
    <article className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold">{post.title}</h1>
      
      {post.mainImage && (
        <img
          src={urlFor(post.mainImage).width(800).height(400).url()}
          alt={post.mainImage.alt || post.title}
          className="w-full rounded-lg my-8"
        />
      )}

      <div className="prose prose-lg">
        <PortableText value={post.body} />
      </div>
    </article>
  )
}
```

### Portable Text Components

```typescript
// components/portable-text.tsx
import { PortableText as PortableTextComponent } from '@portabletext/react'
import Image from 'next/image'
import Link from 'next/link'
import { urlFor } from '@/lib/sanity/client'

const components = {
  types: {
    image: ({ value }: any) => (
      <figure className="my-8">
        <Image
          src={urlFor(value).width(800).url()}
          alt={value.alt || ''}
          width={800}
          height={400}
          className="rounded-lg"
        />
        {value.caption && (
          <figcaption className="text-center text-sm text-muted-foreground mt-2">
            {value.caption}
          </figcaption>
        )}
      </figure>
    ),
    code: ({ value }: any) => (
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
        <code>{value.code}</code>
      </pre>
    ),
  },
  marks: {
    link: ({ children, value }: any) => {
      const href = value.href
      const isExternal = href.startsWith('http')
      
      return isExternal ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ) : (
        <Link href={href}>{children}</Link>
      )
    },
  },
  block: {
    h2: ({ children }: any) => (
      <h2 className="text-2xl font-bold mt-8 mb-4">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-xl font-bold mt-6 mb-3">{children}</h3>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-primary pl-4 italic my-4">
        {children}
      </blockquote>
    ),
  },
}

export function PortableText({ value }: { value: any }) {
  return <PortableTextComponent value={value} components={components} />
}
```

### Live Preview (Draft Mode)

```typescript
// app/api/preview/route.ts
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const slug = searchParams.get('slug')

  if (secret !== process.env.SANITY_PREVIEW_SECRET) {
    return new Response('Invalid token', { status: 401 })
  }

  draftMode().enable()
  redirect(slug || '/')
}

// app/api/disable-preview/route.ts
export async function GET() {
  draftMode().disable()
  redirect('/')
}
```

### Webhook Revalidation

```typescript
// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const { _type } = body

  // Revalidate based on content type
  if (_type === 'post') {
    revalidateTag('posts')
  }

  return NextResponse.json({ revalidated: true })
}
```

---

## Strapi (Self-Hosted)

### Setup con Docker

```yaml
# docker-compose.yml
version: '3'
services:
  strapi:
    image: strapi/strapi
    environment:
      DATABASE_CLIENT: postgres
      DATABASE_HOST: db
      DATABASE_PORT: 5432
      DATABASE_NAME: strapi
      DATABASE_USERNAME: strapi
      DATABASE_PASSWORD: strapi
    volumes:
      - ./app:/srv/app
    ports:
      - '1337:1337'
    depends_on:
      - db

  db:
    image: postgres
    environment:
      POSTGRES_DB: strapi
      POSTGRES_USER: strapi
      POSTGRES_PASSWORD: strapi
    volumes:
      - strapi-data:/var/lib/postgresql/data

volumes:
  strapi-data:
```

### Client Setup

```typescript
// lib/strapi.ts
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337'
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN

interface StrapiResponse<T> {
  data: T
  meta: {
    pagination?: {
      page: number
      pageSize: number
      pageCount: number
      total: number
    }
  }
}

export async function fetchStrapi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<StrapiResponse<T>> {
  const url = `${STRAPI_URL}/api${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STRAPI_TOKEN}`,
      ...options?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`Strapi error: ${response.statusText}`)
  }

  return response.json()
}

// Usage
export async function getPosts() {
  return fetchStrapi<Post[]>('/posts?populate=*&sort=publishedAt:desc')
}

export async function getPost(slug: string) {
  return fetchStrapi<Post>(`/posts?filters[slug][$eq]=${slug}&populate=*`)
}
```

---

## Contentful

### Setup

```bash
pnpm add contentful @contentful/rich-text-react-renderer
```

### Client

```typescript
// lib/contentful.ts
import { createClient } from 'contentful'

export const contentfulClient = createClient({
  space: process.env.CONTENTFUL_SPACE_ID!,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN!,
})

// Preview client
export const previewClient = createClient({
  space: process.env.CONTENTFUL_SPACE_ID!,
  accessToken: process.env.CONTENTFUL_PREVIEW_TOKEN!,
  host: 'preview.contentful.com',
})

export async function getPosts(preview = false) {
  const client = preview ? previewClient : contentfulClient
  
  const entries = await client.getEntries({
    content_type: 'post',
    order: ['-fields.publishedAt'],
    include: 2,
  })

  return entries.items
}
```

---

## Environment Variables

```env
# Sanity
NEXT_PUBLIC_SANITY_PROJECT_ID=xxx
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=xxx
SANITY_PREVIEW_SECRET=xxx

# Strapi
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=xxx

# Contentful
CONTENTFUL_SPACE_ID=xxx
CONTENTFUL_ACCESS_TOKEN=xxx
CONTENTFUL_PREVIEW_TOKEN=xxx
```

---

## Checklist CMS

- [ ] CMS scelto e configurato
- [ ] Schema/Content types definiti
- [ ] Client setup con caching
- [ ] Queries ottimizzate
- [ ] Image optimization
- [ ] Preview/Draft mode
- [ ] Webhook revalidation
- [ ] SEO metadata da CMS
- [ ] Portable Text/Rich Text rendering
- [ ] Error handling
