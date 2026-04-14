---
name: database
description: Database and ORM knowledge base - Prisma, Drizzle, migrations, seeding, connection pooling. Use when setting up a database, configuring an ORM, writing migrations, or managing data connections.
version: 1.0.0
---

# Database Skill

Knowledge base per database, ORM e gestione dati in applicazioni frontend moderne.

## ORM Raccomandati

### Prisma (Preferito)

```bash
# Installazione
pnpm add prisma @prisma/client
pnpm add -D prisma

# Inizializzazione
npx prisma init
```

#### Schema Base

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // o "mysql", "sqlite", "mongodb"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  avatar    String?
  role      Role     @default(USER)
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
}

model Post {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  content     String?  @db.Text
  published   Boolean  @default(false)
  author      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId    String
  categories  Category[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([authorId])
  @@index([slug])
}

model Category {
  id    String @id @default(cuid())
  name  String @unique
  posts Post[]
}

enum Role {
  USER
  ADMIN
  EDITOR
}
```

#### Prisma Client Setup

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

export default db
```

#### Query Patterns

```typescript
// CRUD Operations
// Create
const user = await db.user.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe',
  },
})

// Read con relations
const posts = await db.post.findMany({
  where: { published: true },
  include: {
    author: { select: { name: true, avatar: true } },
    categories: true,
  },
  orderBy: { createdAt: 'desc' },
  take: 10,
  skip: 0,
})

// Update
const updated = await db.user.update({
  where: { id: userId },
  data: { name: 'New Name' },
})

// Delete
await db.post.delete({
  where: { id: postId },
})

// Upsert
const user = await db.user.upsert({
  where: { email: 'user@example.com' },
  update: { name: 'Updated Name' },
  create: { email: 'user@example.com', name: 'New User' },
})

// Transaction
const [post, user] = await db.$transaction([
  db.post.create({ data: postData }),
  db.user.update({ where: { id: userId }, data: { postsCount: { increment: 1 } } }),
])

// Interactive transaction
await db.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  
  await tx.post.create({
    data: { ...postData, authorId: user.id },
  })
})
```

### Drizzle ORM (Alternativa Leggera)

```bash
# Installazione
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

#### Schema Drizzle

```typescript
// db/schema.ts
import { pgTable, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const roleEnum = pgEnum('role', ['USER', 'ADMIN', 'EDITOR'])

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  role: roleEnum('role').default('USER'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const posts = pgTable('posts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content'),
  published: boolean('published').default(false),
  authorId: text('author_id').references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}))
```

#### Drizzle Client

```typescript
// db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })

// Query
const allPosts = await db.query.posts.findMany({
  where: eq(posts.published, true),
  with: {
    author: true,
  },
})
```

## Migrations

### Prisma Migrations

```bash
# Crea migration
npx prisma migrate dev --name init

# Applica in produzione
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# Genera client dopo schema change
npx prisma generate

# Studio GUI
npx prisma studio
```

### Drizzle Migrations

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config
```

```bash
# Genera migration
npx drizzle-kit generate:pg

# Applica
npx drizzle-kit push:pg

# Studio
npx drizzle-kit studio
```

## Database Seeding

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Clean existing data
  await prisma.post.deleteMany()
  await prisma.user.deleteMany()

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
    },
  })

  // Create sample posts
  await prisma.post.createMany({
    data: [
      {
        title: 'First Post',
        slug: 'first-post',
        content: 'This is the first post content.',
        published: true,
        authorId: admin.id,
      },
      {
        title: 'Draft Post',
        slug: 'draft-post',
        content: 'This is a draft.',
        published: false,
        authorId: admin.id,
      },
    ],
  })

  console.log('Database seeded successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

```json
// package.json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

## Best Practices

### 1. Connection Pooling

```typescript
// Per serverless (Vercel, Netlify)
// Usa Prisma Accelerate o PgBouncer

// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // Per migrations
}
```

### 2. Soft Deletes

```prisma
model Post {
  id        String    @id @default(cuid())
  // ... altri campi
  deletedAt DateTime?
}
```

```typescript
// Middleware per soft delete
prisma.$use(async (params, next) => {
  if (params.model === 'Post') {
    if (params.action === 'delete') {
      params.action = 'update'
      params.args['data'] = { deletedAt: new Date() }
    }
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args['where'] = { ...params.args['where'], deletedAt: null }
    }
  }
  return next(params)
})
```

### 3. Pagination Pattern

```typescript
// lib/pagination.ts
export async function paginate<T>(
  model: any,
  args: {
    page?: number
    limit?: number
    where?: any
    orderBy?: any
    include?: any
  }
) {
  const page = args.page || 1
  const limit = args.limit || 10
  const skip = (page - 1) * limit

  const [items, total] = await Promise.all([
    model.findMany({
      where: args.where,
      orderBy: args.orderBy,
      include: args.include,
      take: limit,
      skip,
    }),
    model.count({ where: args.where }),
  ])

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  }
}
```

### 4. Type-Safe Queries

```typescript
// types/db.ts
import type { Prisma } from '@prisma/client'

// Type per Post con Author
export type PostWithAuthor = Prisma.PostGetPayload<{
  include: { author: true }
}>

// Type per User senza password
export type SafeUser = Omit<User, 'password'>

// Select specifico
const userSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} satisfies Prisma.UserSelect

export type PublicUser = Prisma.UserGetPayload<{ select: typeof userSelect }>
```

## Environment Variables

```env
# .env.local
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"

# Per connection pooling (produzione)
DATABASE_URL="postgresql://user:password@pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:password@db.supabase.com:5432/postgres"
```

## Database Providers Consigliati

1. **Supabase** - PostgreSQL managed, ottimo free tier
2. **PlanetScale** - MySQL serverless, branching
3. **Neon** - PostgreSQL serverless, branching
4. **Railway** - PostgreSQL semplice
5. **Turso** - SQLite edge (libSQL)

## Checklist Database

- [ ] Schema definito con relazioni
- [ ] Migrations create e testate
- [ ] Seed data per development
- [ ] Connection pooling configurato
- [ ] Indexes su campi frequenti
- [ ] Soft delete se necessario
- [ ] Types esportati per frontend
- [ ] Environment variables sicure
