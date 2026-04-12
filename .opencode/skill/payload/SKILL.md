---
name: payload
description: Payload CMS 3.0 knowledge base - collections, multi-tenancy, frontend integration. Use when setting up Payload CMS, configuring collections, implementing multi-tenancy, or integrating CMS with Next.js frontend.
version: 1.0.0
context: "bash .Claude/scripts/load_project_context.sh"
---

# Payload CMS 3.0 Skill

Documentazione per Payload CMS 3.0 con Next.js e MongoDB.

## Installazione

```bash
# Nuovo progetto
pnpm create payload-app@latest

# Aggiungere a progetto Next.js esistente
pnpm add payload @payloadcms/next @payloadcms/db-mongodb @payloadcms/richtext-lexical
```

## Configurazione Base

**payload.config.ts** deve includere:
- Database adapter: `mongooseAdapter` con MongoDB URI
- Editor: `lexicalEditor` per rich text
- Collections: Users, Pages, Posts, Media, Categories, Tenants
- Globals: Header, Footer, Settings
- Plugins: seoPlugin, formBuilderPlugin, nestedDocsPlugin, redirectsPlugin, searchPlugin
- Localization: it, en, cs (defaultLocale: 'it')
- TypeScript output: `payload-types.ts`

## Collections Overview

| Collection | Key Fields | Notes |
|------------|-----------|-------|
| **Users** | name, email, roles (admin/editor/user), tenant | Auth enabled, JWT saveToJWT |
| **Pages** | title, slug, status (draft/published), layout (blocks), meta | Drafts enabled, revalidation hooks |
| **Posts** | title, slug, excerpt, content, featuredImage, author, categories, status | Drafts enabled, blog content |
| **Media** | alt, caption, tenant | imageSizes: thumbnail, card, tablet, desktop |
| **Categories** | name | Taxonomy for posts |
| **Tenants** | name, slug, domain, settings (colors, logo), locales | Multi-tenancy root |

## Reusable Fields (Project-Specific)

### slugField()
Auto-generates slug from title, required, unique, sidebar position.

```typescript
export const slugField = (fieldToUse = 'title'): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  admin: { position: 'sidebar' },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (!value && data?.[fieldToUse]) {
          return formatSlug(data[fieldToUse])
        }
        return value
      },
    ],
  },
})
```

### tenantField
Relationship to Tenants collection, auto-filled from user.tenant, hidden from admins.

```typescript
export const tenantField: Field = {
  name: 'tenant',
  type: 'relationship',
  relationTo: 'tenants',
  required: true,
  admin: {
    position: 'sidebar',
    condition: (data, siblingData, { user }) => !user?.roles?.includes('admin'),
  },
  hooks: {
    beforeChange: [
      ({ req, value }) => {
        if (!value && req.user?.tenant) {
          return req.user.tenant
        }
        return value
      },
    ],
  },
}
```

## Access Control Patterns (Multi-Tenancy)

### tenantReadAccess
- Admins: read all
- Others: read only their tenant's data

```typescript
export const tenantReadAccess: Access = ({ req: { user } }) => {
  if (user?.roles?.includes('admin')) return true
  if (user?.tenant) {
    return { tenant: { equals: user.tenant } }
  }
  return false
}
```

### tenantWriteAccess
- Admins: write all
- Editors with tenant: write only their tenant's data

```typescript
export const tenantWriteAccess: Access = ({ req: { user } }) => {
  if (user?.roles?.includes('admin')) return true
  if (user?.roles?.includes('editor') && user?.tenant) {
    return { tenant: { equals: user.tenant } }
  }
  return false
}
```

## Frontend Integration

### getPayloadClient (Singleton)

```typescript
// lib/payload.ts
import { getPayload } from 'payload'
import config from '@payload-config'

let cached = global.payload

if (!cached) {
  cached = global.payload = { client: null, promise: null }
}

export const getPayloadClient = async () => {
  if (cached.client) return cached.client

  if (!cached.promise) {
    cached.promise = getPayload({ config })
  }

  cached.client = await cached.promise
  return cached.client
}
```

### Fetch Data with Tenant Filter

```typescript
export async function getPage(slug: string, tenant?: string) {
  const payload = await getPayloadClient()
  
  const { docs } = await payload.find({
    collection: 'pages',
    where: {
      slug: { equals: slug },
      status: { equals: 'published' },
      ...(tenant && { tenant: { equals: tenant } }),
    },
    depth: 2,
  })
  
  return docs[0] || null
}
```

## Revalidation API Route

```typescript
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')
  const tag = request.nextUrl.searchParams.get('tag')
  const secret = request.nextUrl.searchParams.get('secret')
  
  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 })
  }
  
  if (path) {
    revalidatePath(path)
    return NextResponse.json({ revalidated: true, path })
  }
  
  if (tag) {
    revalidateTag(tag)
    return NextResponse.json({ revalidated: true, tag })
  }
  
  return NextResponse.json({ message: 'Missing path or tag' }, { status: 400 })
}
```

## Localization Config

```typescript
// payload.config.ts
export default buildConfig({
  localization: {
    locales: [
      { label: 'Italiano', code: 'it' },
      { label: 'English', code: 'en' },
      { label: 'Cestina', code: 'cs' },
    ],
    defaultLocale: 'it',
    fallback: true,
  },
})
```

## Best Practices

1. **Always type** - Use `payload-types.ts` generated from schema
2. **Access control** - Never trust frontend, enforce in hooks
3. **Hooks for side effects** - Use beforeChange/afterChange for revalidation
4. **Drafts** - Enable versions with drafts for content editing
5. **Multi-tenancy** - Always filter queries by tenant
6. **Image optimization** - Use imageSizes for responsive images
7. **Caching** - Use revalidateTag for granular cache invalidation
