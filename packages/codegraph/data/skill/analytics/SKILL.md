---
name: analytics
description: Privacy-first analytics knowledge base - Plausible, PostHog, Umami, Vercel Analytics, cookie consent. Use when setting up analytics, tracking events, measuring conversions, or integrating analytics tools.
version: 1.0.0
---

# Analytics Skill

Knowledge base per analytics privacy-first in applicazioni frontend moderne.

## Provider Raccomandati

| Provider | Tipo | GDPR | Free Tier |
|----------|------|------|-----------|
| **Plausible** | Privacy-first, no cookies | Compliant | Self-host |
| **PostHog** | Product analytics, feature flags | Compliant | 1M events/mese |
| **Umami** | Open source, self-hosted | Compliant | Unlimited |
| **Vercel Analytics** | Web Vitals, Next.js native | Compliant | 2500 events/mese |

---

## Plausible Analytics (Raccomandato)

### Installazione

```bash
# Script tag (più semplice)
# Aggiungi in <head>

# Oppure pacchetto npm
pnpm add plausible-tracker
```

### Setup con Script Tag

```typescript
// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <Script
          defer
          data-domain="tuodominio.com"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Setup con NPM Package

```typescript
// lib/analytics.ts
import Plausible from 'plausible-tracker'

export const plausible = Plausible({
  domain: 'tuodominio.com',
  apiHost: 'https://plausible.io', // o self-hosted
  trackLocalhost: false,
})

// Auto pageview tracking
export function enableAutoPageviews() {
  plausible.enableAutoPageviews()
}

// Custom events
export function trackEvent(
  eventName: string,
  props?: Record<string, string | number | boolean>
) {
  plausible.trackEvent(eventName, { props })
}
```

### Provider Component

```typescript
// components/analytics-provider.tsx
'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { plausible } from '@/lib/analytics'

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Track pageview on route change
    const url = pathname + (searchParams.toString() ? `?${searchParams}` : '')
    plausible.trackPageview({ url })
  }, [pathname, searchParams])

  return <>{children}</>
}
```

### Custom Events

```typescript
// Tracking conversions
import { trackEvent } from '@/lib/analytics'

// Signup
function handleSignup() {
  trackEvent('Signup', { plan: 'free' })
}

// Purchase
function handlePurchase(amount: number) {
  trackEvent('Purchase', { 
    revenue: amount,
    currency: 'EUR' 
  })
}

// Feature usage
function handleFeatureUse(feature: string) {
  trackEvent('Feature Used', { feature })
}

// CTA Click
function handleCTAClick(location: string) {
  trackEvent('CTA Click', { location })
}
```

### Goals e Conversions

```typescript
// Track outbound links
<a 
  href="https://external.com" 
  onClick={() => trackEvent('Outbound Link', { url: 'https://external.com' })}
>
  External Link
</a>

// Track file downloads
<a 
  href="/files/guide.pdf"
  onClick={() => trackEvent('File Download', { file: 'guide.pdf' })}
>
  Download Guide
</a>

// Track form submissions
function onSubmit(data: FormData) {
  trackEvent('Form Submit', { form: 'contact' })
  // ... submit logic
}
```

---

## PostHog (Product Analytics)

### Installazione

```bash
pnpm add posthog-js posthog-node
```

### Client Setup

```typescript
// lib/posthog.ts
import posthog from 'posthog-js'

export function initPostHog() {
  if (typeof window !== 'undefined' && !posthog.__loaded) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          posthog.debug()
        }
      },
      capture_pageview: false, // Manual control
      capture_pageleave: true,
      autocapture: true,
    })
  }
  return posthog
}

export { posthog }
```

### Provider

```typescript
// components/posthog-provider.tsx
'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { initPostHog, posthog } from '@/lib/posthog'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    initPostHog()
  }, [])

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`
      }
      posthog.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams])

  return <>{children}</>
}
```

### Identify Users

```typescript
// Dopo login
import { posthog } from '@/lib/posthog'

function onLogin(user: User) {
  posthog.identify(user.id, {
    email: user.email,
    name: user.name,
    plan: user.plan,
    createdAt: user.createdAt,
  })
}

// Dopo logout
function onLogout() {
  posthog.reset()
}
```

### Feature Flags

```typescript
// lib/feature-flags.ts
import { posthog } from '@/lib/posthog'

export function isFeatureEnabled(flagKey: string): boolean {
  return posthog.isFeatureEnabled(flagKey) ?? false
}

export function getFeatureFlag(flagKey: string) {
  return posthog.getFeatureFlag(flagKey)
}

// Usage in component
function PricingPage() {
  const showNewPricing = isFeatureEnabled('new-pricing-page')

  return showNewPricing ? <NewPricing /> : <OldPricing />
}

// Con React hook
import { useFeatureFlagEnabled } from 'posthog-js/react'

function Component() {
  const showBetaFeature = useFeatureFlagEnabled('beta-feature')
  
  if (!showBetaFeature) return null
  return <BetaFeature />
}
```

### Server-Side (Node)

```typescript
// lib/posthog-server.ts
import { PostHog } from 'posthog-node'

export const posthogServer = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
})

// Server-side event
export async function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, any>
) {
  posthogServer.capture({
    distinctId,
    event,
    properties,
  })
}

// Server-side feature flag
export async function getServerFeatureFlag(
  distinctId: string,
  flagKey: string
) {
  return posthogServer.getFeatureFlag(flagKey, distinctId)
}
```

---

## Umami (Self-Hosted)

### Docker Setup

```yaml
# docker-compose.yml
version: '3'
services:
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://umami:umami@db:5432/umami
      DATABASE_TYPE: postgresql
      APP_SECRET: your-random-secret
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: umami
      POSTGRES_USER: umami
      POSTGRES_PASSWORD: umami
    volumes:
      - umami-db:/var/lib/postgresql/data

volumes:
  umami-db:
```

### Script Integration

```typescript
// app/layout.tsx
<Script
  defer
  src="https://your-umami-instance.com/script.js"
  data-website-id="your-website-id"
/>
```

### Custom Events

```typescript
// Umami usa data attributes
<button data-umami-event="signup-click">
  Sign Up
</button>

<button data-umami-event="purchase" data-umami-event-amount="99">
  Buy Now
</button>

// O programmaticamente
declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, any>) => void
    }
  }
}

function trackUmamiEvent(event: string, data?: Record<string, any>) {
  window.umami?.track(event, data)
}
```

---

## Vercel Analytics (Next.js Native)

### Setup

```bash
pnpm add @vercel/analytics @vercel/speed-insights
```

### Integration

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

### Custom Events

```typescript
import { track } from '@vercel/analytics'

// Track custom event
track('Signup', { plan: 'pro' })
track('Purchase', { amount: 99, currency: 'EUR' })
```

---

## Google Analytics (GA4) - Se Necessario

```typescript
// components/google-analytics.tsx
'use client'

import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export function GoogleAnalytics() {
  if (!GA_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  )
}

// Track events
export function trackGAEvent(action: string, category: string, label?: string, value?: number) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    })
  }
}
```

---

## Cookie Consent Banner

```typescript
// components/cookie-consent.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      setShowBanner(true)
    }
  }, [])

  const acceptAll = () => {
    localStorage.setItem('cookie-consent', 'all')
    setShowBanner(false)
    // Enable analytics
    initAnalytics()
  }

  const acceptNecessary = () => {
    localStorage.setItem('cookie-consent', 'necessary')
    setShowBanner(false)
    // Only necessary cookies, no analytics
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-50">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Utilizziamo cookie per migliorare la tua esperienza.
          <a href="/privacy" className="underline ml-1">Privacy Policy</a>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={acceptNecessary}>
            Solo necessari
          </Button>
          <Button size="sm" onClick={acceptAll}>
            Accetta tutti
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

## Environment Variables

```env
# Plausible
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=tuodominio.com

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
POSTHOG_API_KEY=phx_xxx

# Umami
NEXT_PUBLIC_UMAMI_WEBSITE_ID=xxx

# Vercel Analytics (auto-configured on Vercel)

# Google Analytics (se necessario)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

---

## Checklist Analytics

- [ ] Provider privacy-first scelto (Plausible/PostHog/Umami)
- [ ] Script/SDK installato
- [ ] Pageview tracking attivo
- [ ] Custom events definiti
- [ ] Conversions/Goals configurati
- [ ] Cookie consent banner (se necessario)
- [ ] User identification (se app con auth)
- [ ] Feature flags (se PostHog)
- [ ] Dashboard configurata
- [ ] GDPR compliance verificata
