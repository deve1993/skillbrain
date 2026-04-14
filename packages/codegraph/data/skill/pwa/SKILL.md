---
name: pwa
description: Progressive Web App with Next.js — service workers, offline support, push notifications, install prompts, caching strategies. Use when adding offline capabilities, push notifications, app-like install experience, or background sync.
version: 1.0.0
---

# PWA — Progressive Web App with Next.js

## 1. Setup with @serwist/next

```bash
pnpm add @serwist/next @serwist/precaching @serwist/strategies
```

```ts
// next.config.ts
import withSerwist from '@serwist/next'

export default withSerwist({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
})({
  // your Next.js config
})
```

```ts
// src/sw.ts (Service Worker source)
import { defaultCache } from '@serwist/next/worker'
import { Serwist } from 'serwist'

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST, // auto-generated
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})

serwist.addEventListeners()
```

## 2. Web App Manifest

```json
// public/manifest.json
{
  "name": "My App",
  "short_name": "MyApp",
  "description": "Description of the app",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0f172a",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    {
      "name": "Dashboard",
      "url": "/dashboard",
      "icons": [{ "src": "/icons/shortcut-dashboard.png", "sizes": "96x96" }]
    }
  ],
  "screenshots": [
    { "src": "/screenshots/home.png", "sizes": "1280x720", "type": "image/png", "form_factor": "wide" },
    { "src": "/screenshots/mobile.png", "sizes": "750x1334", "type": "image/png", "form_factor": "narrow" }
  ]
}
```

```tsx
// app/layout.tsx — metadata
export const metadata: Metadata = {
  manifest: '/manifest.json',
  themeColor: '#0f172a',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'My App',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
}
```

## 3. Caching Strategies

```ts
// src/sw.ts — custom runtime caching
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from '@serwist/strategies'
import { ExpirationPlugin } from '@serwist/expiration'
import { Serwist } from 'serwist'

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    // Static assets — cache first (immutable)
    {
      matcher: ({ request }) => request.destination === 'image' ||
        request.destination === 'font' || request.destination === 'style',
      handler: new CacheFirst({
        cacheName: 'static-assets',
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    // API calls — network first, fallback to cache
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/'),
      handler: new NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 5,
        plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 })],
      }),
    },
    // Pages — stale while revalidate
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new StaleWhileRevalidate({
        cacheName: 'pages',
        plugins: [new ExpirationPlugin({ maxEntries: 30 })],
      }),
    },
  ],
})

serwist.addEventListeners()
```

## 4. Offline Fallback

```tsx
// app/offline/page.tsx
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">You are offline</h1>
        <p className="mt-2 text-muted-foreground">
          Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
```

```ts
// In sw.ts — add offline fallback for navigation
import { PrecacheFallbackPlugin } from '@serwist/precaching'

// Add to navigation handler:
{
  matcher: ({ request }) => request.mode === 'navigate',
  handler: new NetworkFirst({
    cacheName: 'pages',
    plugins: [
      new PrecacheFallbackPlugin({ fallbackURL: '/offline' }),
    ],
  }),
}
```

## 5. Push Notifications

### Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
# Save to .env.local:
# NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLxx...
# VAPID_PRIVATE_KEY=xxx...
```

### Subscribe (Client)

```tsx
'use client'
import { useState, useEffect } from 'react'

export function PushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub)
        })
      })
    }
  }, [])

  async function subscribe() {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    })

    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
    setIsSubscribed(true)
  }

  async function unsubscribe() {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
    }
    setIsSubscribed(false)
  }

  return (
    <button onClick={isSubscribed ? unsubscribe : subscribe}>
      {isSubscribed ? 'Disable Notifications' : 'Enable Notifications'}
    </button>
  )
}
```

### Send Push (Server)

```ts
// app/api/push/send/route.ts
import webPush from 'web-push'
import { NextRequest, NextResponse } from 'next/server'

webPush.setVapidDetails(
  'mailto:you@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export async function POST(req: NextRequest) {
  const { subscription, title, body, url } = await req.json()

  await webPush.sendNotification(
    subscription,
    JSON.stringify({ title, body, url }),
  )

  return NextResponse.json({ success: true })
}
```

### Handle Push in Service Worker

```ts
// In sw.ts
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Notification', body: '' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data.url
  event.waitUntil(clients.openWindow(url))
})
```

## 6. Install Prompt

```tsx
'use client'
import { useState, useEffect } from 'react'

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    // Track: outcome === 'accepted' | 'dismissed'
    setDeferredPrompt(null)
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border bg-background p-4 shadow-lg md:left-auto md:w-96">
      <p className="font-medium">Install our app</p>
      <p className="text-sm text-muted-foreground">Get a faster experience with offline support.</p>
      <div className="mt-3 flex gap-2">
        <button onClick={handleInstall} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">
          Install
        </button>
        <button onClick={() => setShowBanner(false)} className="rounded px-4 py-2 text-sm">
          Not now
        </button>
      </div>
    </div>
  )
}
```

### iOS Safari (no beforeinstallprompt)

```tsx
// app/layout.tsx — add Apple-specific meta tags
<head>
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="My App" />
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
  <link rel="apple-touch-startup-image" href="/splash/apple-splash.png" />
</head>

// Detect iOS and show manual instruction
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
if (isIOS && !isStandalone) {
  // Show: "Tap Share → Add to Home Screen"
}
```

## PWA Checklist

```
□ manifest.json with icons (192, 512, maskable)
□ Service worker registered and active
□ Offline fallback page
□ HTTPS (required for service workers)
□ Apple meta tags for iOS
□ Theme color in manifest AND meta tag
□ Lighthouse PWA audit score = 100
□ Install prompt with analytics
□ Push notification opt-in (not on first visit!)
```
