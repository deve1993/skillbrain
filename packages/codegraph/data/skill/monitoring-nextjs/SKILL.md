---
name: monitoring-nextjs
description: Monitoring and observability for Next.js — Sentry error tracking, structured logging with Pino, OpenTelemetry tracing, health checks, uptime monitoring, alerting. Use when adding error tracking, logging, performance monitoring, or alerting to a Next.js project.
version: 1.0.0
---

# Monitoring & Observability — Next.js

## 1. Sentry Setup

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

```ts
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.01,  // 1% of sessions
  replaysOnErrorSampleRate: 1.0,   // 100% of errored sessions
  integrations: [
    Sentry.replayIntegration(),
    Sentry.feedbackIntegration({ colorScheme: 'system' }),
  ],
})
```

```ts
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
})
```

```ts
// sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
})
```

```ts
// next.config.ts
import { withSentryConfig } from '@sentry/nextjs'

const config = { /* your config */ }

export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  hideSourceMaps: true,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring', // proxy to bypass ad-blockers
})
```

### Custom Error Boundary

```tsx
// app/global-error.tsx
'use client'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html><body>
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          <button onClick={reset} className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground">
            Try again
          </button>
        </div>
      </div>
    </body></html>
  )
}
```

### Track User & Custom Events

```tsx
// After login
import * as Sentry from '@sentry/nextjs'

Sentry.setUser({ id: user.id, email: user.email, username: user.name })

// Custom event with context
Sentry.captureMessage('User upgraded plan', {
  level: 'info',
  tags: { plan: 'pro' },
  extra: { previousPlan: 'free' },
})

// Performance span
const transaction = Sentry.startSpan({ name: 'process-payment' }, () => {
  // your logic
})
```

## 2. Structured Logging with Pino

```bash
pnpm add pino pino-pretty
```

```ts
// lib/logger.ts
import pino from 'pino'

const isDev = process.env.NODE_ENV === 'development'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    env: process.env.NODE_ENV,
    service: 'my-app',
  },
})

// Child loggers for modules
export const dbLogger = logger.child({ module: 'database' })
export const authLogger = logger.child({ module: 'auth' })
export const apiLogger = logger.child({ module: 'api' })
```

### Request Logging Middleware

```ts
// middleware.ts (or in API routes)
import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

export function middleware(req: NextRequest) {
  const requestId = nanoid(12)
  const start = Date.now()

  // Add request ID to response headers
  const response = NextResponse.next()
  response.headers.set('X-Request-Id', requestId)

  // Log request
  logger.info({
    requestId,
    method: req.method,
    path: req.nextUrl.pathname,
    userAgent: req.headers.get('user-agent'),
    ip: req.headers.get('x-forwarded-for'),
  }, 'Incoming request')

  return response
}
```

### Log Shipping to Axiom/Logtail

```bash
pnpm add @axiomhq/pino
```

```ts
// lib/logger.ts (production)
import pino from 'pino'

export const logger = pino({
  level: 'info',
  transport: process.env.NODE_ENV === 'production'
    ? {
        target: '@axiomhq/pino',
        options: {
          dataset: process.env.AXIOM_DATASET,
          token: process.env.AXIOM_TOKEN,
        },
      }
    : {
        target: 'pino-pretty',
        options: { colorize: true },
      },
})
```

## 3. OpenTelemetry

```bash
pnpm add @vercel/otel @opentelemetry/api
```

```ts
// instrumentation.ts (Next.js 15+ — root of project)
// This file is auto-loaded by Next.js via the instrumentation hook.
// Requires: pnpm add @vercel/otel @opentelemetry/api
import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel({
    serviceName: 'my-app',
    // Optional: export to Honeycomb, Jaeger, etc.
    // traceExporter: new OTLPTraceExporter({ url: '...' }),
  })
}
```

```ts
// Custom spans
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('my-app')

export async function processOrder(orderId: string) {
  return tracer.startActiveSpan('process-order', async (span) => {
    span.setAttribute('order.id', orderId)
    try {
      await validateOrder(orderId)
      await chargePayment(orderId)
      await sendConfirmation(orderId)
      span.setStatus({ code: 1 }) // OK
    } catch (error) {
      span.setStatus({ code: 2, message: String(error) }) // ERROR
      throw error
    } finally {
      span.end()
    }
  })
}
```

## 4. Health Checks

```ts
// app/api/health/route.ts (Liveness)
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || 'unknown',
  })
}
```

```ts
// app/api/ready/route.ts (Readiness)
export async function GET() {
  const checks: Record<string, 'ok' | 'fail'> = {}

  // Check database
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch {
    checks.database = 'fail'
  }

  // Check Redis
  try {
    await redis.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'fail'
  }

  // Check external API
  try {
    const res = await fetch('https://api.stripe.com/v1', {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    })
    checks.stripe = res.ok ? 'ok' : 'fail'
  } catch {
    checks.stripe = 'fail'
  }

  const allHealthy = Object.values(checks).every((v) => v === 'ok')

  return Response.json(
    { status: allHealthy ? 'ready' : 'degraded', checks },
    { status: allHealthy ? 200 : 503 },
  )
}
```

```dockerfile
# Docker HEALTHCHECK
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

## 5. Error Handling Architecture

```ts
// lib/errors.ts — application error classes
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational = true,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400)
  }
}
```

```ts
// lib/api-handler.ts — error middleware for API routes
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'
import { AppError } from '@/lib/errors'
import { NextResponse } from 'next/server'

export function withErrorHandler(
  handler: (req: Request, ctx: any) => Promise<Response>
) {
  return async (req: Request, ctx: any) => {
    try {
      return await handler(req, ctx)
    } catch (error) {
      // Known operational errors
      if (error instanceof AppError && error.isOperational) {
        logger.warn({ err: error, code: error.code }, error.message)
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode },
        )
      }

      // Unknown/programmer errors — log + report
      logger.error({ err: error }, 'Unhandled error')
      Sentry.captureException(error)

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      )
    }
  }
}

// Usage
export const GET = withErrorHandler(async (req) => {
  const data = await fetchData()
  if (!data) throw new NotFoundError('Data', 'latest')
  return NextResponse.json(data)
})
```

## 6. Alerting

### Slack Webhook for Critical Errors

```ts
// lib/alerts.ts
export async function alertSlack(message: string, level: 'warn' | 'error' | 'critical') {
  const emoji = { warn: '⚠️', error: '🔴', critical: '🚨' }

  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `${emoji[level]} *[${level.toUpperCase()}]* ${message}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji[level]} *[${level.toUpperCase()}]* ${message}\n\n*Service:* ${process.env.APP_NAME}\n*Environment:* ${process.env.NODE_ENV}\n*Time:* ${new Date().toISOString()}`,
          },
        },
      ],
    }),
  })
}
```

### Sentry Alert Rules

```
Recommended alert rules in Sentry dashboard:
1. Spike detection — alert when error count > 2x normal in 5 min
2. New issue — alert on first occurrence of any new error
3. Regression — alert when resolved issue reappears
4. Performance — alert when p95 response time > 2s
5. Error budget — alert when error rate > 1% in 1 hour
```

## Quick Setup Checklist

```
□ Sentry: install, configure client/server/edge, enable source maps
□ Logger: Pino with structured output, ship to Axiom/Logtail in prod
□ Health: /api/health (liveness) + /api/ready (readiness with DB check)
□ Error classes: AppError hierarchy for operational vs programmer errors
□ Error handler: withErrorHandler wrapper for all API routes
□ Alerting: Slack webhook for critical, Sentry for everything
□ OpenTelemetry: instrumentation.ts for tracing
□ Docker: HEALTHCHECK directive
```
