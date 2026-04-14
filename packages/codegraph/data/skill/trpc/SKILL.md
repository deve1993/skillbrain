---
name: trpc
description: tRPC v11 end-to-end type-safe APIs with Next.js App Router — routers, procedures, middleware, subscriptions, React Query integration. Use when building type-safe APIs without REST/GraphQL, or when maximum type safety between client and server is needed.
version: 1.0.0
---

# tRPC v11 — Next.js App Router

## 1. Setup

```bash
pnpm add @trpc/server@next @trpc/client@next @trpc/react-query@next @trpc/next@next @tanstack/react-query zod
```

### Server: Initialize tRPC

```ts
// server/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server'
import { ZodError } from 'zod'
import superjson from 'superjson'
import type { Context } from './context'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

// Auth middleware
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { user: ctx.user } })
})

export const protectedProcedure = t.procedure.use(isAuthed)

// Admin middleware
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' })
  return next({ ctx: { user: ctx.user } })
})

export const adminProcedure = t.procedure.use(isAuthed).use(isAdmin)
```

### Context Factory

```ts
// server/context.ts
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function createContext() {
  const session = await auth()
  return { user: session?.user ?? null, db }
}

export type Context = Awaited<ReturnType<typeof createContext>>
```

### Router Definition

```ts
// server/routers/user.ts
import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'

export const userRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findUnique({ where: { id: input.id } })
    }),

  list: publicProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.user.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
      })
      let nextCursor: string | undefined
      if (items.length > input.limit) {
        const next = items.pop()
        nextCursor = next!.id
      }
      return { items, nextCursor }
    }),

  update: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { name: input.name },
      })
    }),
})
```

```ts
// server/routers/_app.ts
import { router } from '../trpc'
import { userRouter } from './user'
import { postRouter } from './post'

export const appRouter = router({
  user: userRouter,
  post: postRouter,
})

export type AppRouter = typeof appRouter
```

### Next.js Route Handler

```ts
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers/_app'
import { createContext } from '@/server/context'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
  })

export { handler as GET, handler as POST }
```

## 2. Client Setup

### Provider

```tsx
// lib/trpc/client.ts
import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers/_app'

export const trpc = createTRPCReact<AppRouter>()
```

```tsx
// lib/trpc/provider.tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import { trpc } from './client'
import superjson from 'superjson'

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 1000 } },
  }))

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    }),
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
```

```tsx
// app/layout.tsx
import { TRPCProvider } from '@/lib/trpc/provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html><body>
      <TRPCProvider>{children}</TRPCProvider>
    </body></html>
  )
}
```

## 3. Client Usage

### Queries

```tsx
'use client'
import { trpc } from '@/lib/trpc/client'

function UserProfile({ id }: { id: string }) {
  const { data, isLoading, error } = trpc.user.getById.useQuery({ id })

  if (isLoading) return <Skeleton />
  if (error) return <p>Error: {error.message}</p>
  return <h1>{data?.name}</h1>
}
```

### Mutations with Optimistic Updates

```tsx
function UpdateName() {
  const utils = trpc.useUtils()

  const mutation = trpc.user.update.useMutation({
    onMutate: async (newData) => {
      await utils.user.getById.cancel()
      const prev = utils.user.getById.getData({ id: 'me' })
      utils.user.getById.setData({ id: 'me' }, (old) =>
        old ? { ...old, ...newData } : old
      )
      return { prev }
    },
    onError: (err, newData, ctx) => {
      utils.user.getById.setData({ id: 'me' }, ctx?.prev)
    },
    onSettled: () => {
      utils.user.getById.invalidate({ id: 'me' })
    },
  })

  return (
    <button onClick={() => mutation.mutate({ name: 'New Name' })}>
      {mutation.isPending ? 'Saving...' : 'Update'}
    </button>
  )
}
```

### Infinite Queries (Pagination)

```tsx
function UserList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.user.list.useInfiniteQuery(
      { limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    )

  return (
    <div>
      {data?.pages.flatMap((page) =>
        page.items.map((user) => <UserCard key={user.id} user={user} />)
      )}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
```

## 4. Server-Side Caller (RSC)

```ts
// lib/trpc/server.ts
import { createCallerFactory } from '@/server/trpc'
import { appRouter } from '@/server/routers/_app'
import { createContext } from '@/server/context'

const createCaller = createCallerFactory(appRouter)

export async function getServerCaller() {
  const ctx = await createContext()
  return createCaller(ctx)
}
```

```tsx
// app/users/page.tsx (Server Component)
import { getServerCaller } from '@/lib/trpc/server'

export default async function UsersPage() {
  const trpc = await getServerCaller()
  const { items } = await trpc.user.list({ limit: 50 })

  return (
    <ul>
      {items.map((u) => <li key={u.id}>{u.name}</li>)}
    </ul>
  )
}
```

## 5. Advanced: SSE Subscriptions (v11)

```ts
// server/routers/notifications.ts
import { observable } from '@trpc/server/observable'

export const notificationRouter = router({
  onNew: protectedProcedure.subscription(({ ctx }) => {
    return observable<Notification>((emit) => {
      const handler = (notification: Notification) => {
        if (notification.userId === ctx.user.id) emit.next(notification)
      }
      eventEmitter.on('notification', handler)
      return () => eventEmitter.off('notification', handler)
    })
  }),
})
```

```tsx
// Client subscription
function NotificationBell() {
  trpc.notification.onNew.useSubscription(undefined, {
    onData: (notification) => {
      toast(notification.message)
    },
  })
  return <BellIcon />
}
```

## 6. Testing

```ts
// __tests__/user.test.ts
import { describe, it, expect } from 'vitest'
import { createCallerFactory } from '@/server/trpc'
import { appRouter } from '@/server/routers/_app'

const createCaller = createCallerFactory(appRouter)

describe('user router', () => {
  it('lists users', async () => {
    const caller = createCaller({
      user: { id: 'test', role: 'admin' },
      db: testDb,
    })
    const result = await caller.user.list({ limit: 10 })
    expect(result.items).toBeDefined()
  })
})
```

## Decision: tRPC vs REST vs GraphQL

| Feature | tRPC | REST | GraphQL |
|---------|------|------|---------|
| Type safety | End-to-end | Manual/codegen | Codegen |
| Learning curve | Low (if TS) | Low | High |
| Bundle size | Small | Tiny (fetch) | Large (client) |
| Best for | Full-stack TS monorepo | Public APIs | Complex graph data |
| Caching | React Query | HTTP caching | Apollo cache |
| Use when | Same team owns client+server | External consumers | Multiple clients, nested data |
