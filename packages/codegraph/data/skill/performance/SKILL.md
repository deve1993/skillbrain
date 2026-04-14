---
name: performance
description: Performance optimization for Next.js — bundle analysis, Core Web Vitals (LCP/CLS/INP), SSR streaming, code splitting, memory leaks, caching strategies, Lighthouse CI. Use when optimizing page speed, debugging slow renders, reducing bundle size, or setting up performance budgets.
version: 1.0.0
---

# Performance Optimization — Next.js

## 1. Bundle Optimization

### Bundle Analyzer

```bash
pnpm add -D @next/bundle-analyzer
```

```ts
// next.config.ts
import withBundleAnalyzer from '@next/bundle-analyzer'

const config = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})({
  // your config
})
export default config
```

```bash
ANALYZE=true pnpm build  # opens visual report
```

### Dynamic Imports (Code Splitting)

```tsx
import dynamic from 'next/dynamic'

// Heavy component — only load when needed
const HeavyEditor = dynamic(() => import('@/components/editor'), {
  loading: () => <EditorSkeleton />,
  ssr: false, // client-only (reduces server bundle)
})

// Conditional load
const AdminPanel = dynamic(() => import('@/components/admin-panel'))
// Only rendered for admins — not in main bundle
```

### Barrel File Anti-Pattern

```ts
// ❌ BAD — imports entire library
import { Button } from '@/components'  // barrel re-exports everything

// ✅ GOOD — direct import, tree-shakeable
import { Button } from '@/components/ui/button'
```

```ts
// next.config.ts — optimize known barrel-heavy packages
const config = {
  modularizeImports: {
    'lucide-react': { transform: 'lucide-react/dist/esm/icons/{{ kebabCase member }}' },
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'date-fns'],
  },
}
```

### Package Alternatives

| Heavy | Light | Savings |
|-------|-------|---------|
| moment (300kb) | date-fns (tree-shake) or dayjs (2kb) | ~290kb |
| lodash (70kb) | lodash-es (tree-shake) or native | ~60kb |
| axios (13kb) | native fetch | 13kb |
| uuid (4kb) | crypto.randomUUID() | 4kb |

## 2. Core Web Vitals

### LCP (Largest Contentful Paint) — Target < 2.5s

```tsx
// Hero image — MUST have priority
import Image from 'next/image'

<Image
  src="/hero.webp"
  alt="Hero"
  width={1200}
  height={600}
  priority          // preload, no lazy loading
  sizes="100vw"     // responsive hint
  quality={85}
/>

// Preload critical font in layout.tsx
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], display: 'swap' })
```

### CLS (Cumulative Layout Shift) — Target < 0.1

```tsx
// ✅ Always set explicit dimensions
<Image width={400} height={300} ... />
<video width="640" height="360" />
<iframe width="560" height="315" />

// ✅ Skeleton loaders with exact dimensions
function CardSkeleton() {
  return <div className="h-[300px] w-full animate-pulse rounded-lg bg-muted" />
}

// ✅ Font fallback metrics (prevents layout shift on font swap)
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: true, // auto-generates size-adjust CSS
})
```

### INP (Interaction to Next Paint) — Target < 200ms

```tsx
'use client'
import { useTransition, useDeferredValue } from 'react'

function SearchResults({ query }: { query: string }) {
  // Defer expensive re-renders
  const deferredQuery = useDeferredValue(query)
  const isStale = query !== deferredQuery

  return (
    <div className={isStale ? 'opacity-60' : ''}>
      <ExpensiveList query={deferredQuery} />
    </div>
  )
}

function FilterButton({ onFilter }: { onFilter: () => void }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => onFilter())}
      disabled={isPending}
    >
      {isPending ? 'Filtering...' : 'Apply Filter'}
    </button>
  )
}
```

### Real User Monitoring

```tsx
// app/components/web-vitals.tsx
'use client'
import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Send to analytics
    const body = { name: metric.name, value: metric.value, id: metric.id }
    navigator.sendBeacon('/api/vitals', JSON.stringify(body))
  })
  return null
}
```

## 3. SSR & Streaming

### Parallel vs Waterfall Data Fetching

```tsx
// ❌ WATERFALL — sequential, slow
async function Page() {
  const user = await getUser()        // 200ms
  const posts = await getPosts(user.id) // 300ms  ← waits for user
  // Total: 500ms
}

// ✅ PARALLEL — concurrent
async function Page() {
  const [user, posts] = await Promise.all([
    getUser(),    // 200ms
    getPosts(),   // 300ms
  ])
  // Total: 300ms
}
```

### Streaming with Suspense

```tsx
import { Suspense } from 'react'

export default function DashboardPage() {
  return (
    <div>
      {/* Renders instantly (static) */}
      <h1>Dashboard</h1>
      <StaticSidebar />

      {/* Streams in when ready */}
      <Suspense fallback={<ChartSkeleton />}>
        <SlowAnalyticsChart />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <SlowDataTable />
      </Suspense>
    </div>
  )
}
```

### Rendering Decision Tree

```
Does data change per request?
├── No → Static (default, fastest)
│   └── Needs periodic update? → ISR (revalidate: 3600)
└── Yes
    ├── Per user? → Dynamic (force-dynamic or cookies()/headers())
    └── Real-time? → Client component with SWR/React Query
```

## 4. Caching Strategy

```tsx
// Server Component data fetching
// ✅ Cached by default in production
const data = await fetch('https://api.example.com/data')

// ✅ Revalidate every hour
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600 },
})

// ✅ No cache (always fresh)
const data = await fetch('https://api.example.com/data', {
  cache: 'no-store',
})
```

```tsx
// unstable_cache for non-fetch data
import { unstable_cache } from 'next/cache'

const getCachedProducts = unstable_cache(
  async (category: string) => {
    return db.product.findMany({ where: { category } })
  },
  ['products'],            // cache key prefix
  { revalidate: 3600, tags: ['products'] }
)

// Invalidate on demand (Server Action)
import { revalidateTag } from 'next/cache'
revalidateTag('products')
```

### CDN Headers

```ts
// next.config.ts
const config = {
  headers: async () => [
    {
      source: '/_next/static/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
    {
      source: '/api/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=300' }],
    },
  ],
}
```

## 5. Image & Font Optimization

```tsx
// Responsive images with sizes
<Image
  src="/product.jpg"
  alt="Product"
  width={800}
  height={600}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQ..."  // tiny blur placeholder
/>

// Remote images — configure domains
// next.config.ts
const config = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
}
```

## 6. Memory Leaks

```tsx
// ❌ LEAK — event listener never cleaned up
useEffect(() => {
  window.addEventListener('resize', handler)
  // Missing cleanup!
}, [])

// ✅ FIXED
useEffect(() => {
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])

// ❌ LEAK — interval never cleared
useEffect(() => {
  setInterval(pollData, 5000)
}, [])

// ✅ FIXED
useEffect(() => {
  const id = setInterval(pollData, 5000)
  return () => clearInterval(id)
}, [])

// ❌ LEAK — AbortController for fetch
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData)
  // Component unmounts, setState on unmounted component
}, [])

// ✅ FIXED
useEffect(() => {
  const controller = new AbortController()
  fetch('/api/data', { signal: controller.signal })
    .then(r => r.json())
    .then(setData)
    .catch(() => {}) // abort throws
  return () => controller.abort()
}, [])
```

## 7. Lighthouse CI

```bash
pnpm add -D @lhci/cli
```

```js
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm start',
      url: ['http://localhost:3000', 'http://localhost:3000/about'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: 'temporary-public-storage', // or LHCI server
    },
  },
}
```

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile && pnpm build
      - run: pnpm exec lhci autorun
```

## Quick Wins Checklist

```
□ next/image with priority on LCP image
□ next/font with display: swap
□ optimizePackageImports for icon/date libs
□ Suspense boundaries around slow data
□ Parallel data fetching (Promise.all)
□ Dynamic imports for heavy client components
□ Cache-Control headers for static assets
□ Bundle analyzer check (ANALYZE=true pnpm build)
□ No barrel file imports from large packages
```
