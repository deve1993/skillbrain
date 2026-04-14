---
name: coolify
description: Coolify deployment knowledge base - Docker multi-stage builds, CI/CD, SSL, health checks. Use when deploying to Coolify, setting up Docker containers, configuring CI/CD pipelines, or managing SSL certificates.
version: 1.0.0
---

# Coolify Deployment Knowledge Base

## Dockerfile (Next.js)

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

## next.config.js

```javascript
module.exports = {
  output: 'standalone',
};
```

## Health Check Endpoint

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
```

## .dockerignore

```
node_modules
.next
.git
*.md
.env*
!.env.example
```

## GitHub Actions Deploy

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Coolify
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}" \
            "${{ secrets.COOLIFY_WEBHOOK }}"
```

## Coolify Settings

### Environment Variables
```
NODE_ENV=production
DATABASE_URL=
AUTH_SECRET=
NEXT_PUBLIC_API_URL=https://yourdomain.com
```

### Health Check
- Path: `/api/health`
- Interval: 30s
- Timeout: 10s

### SSL
- Provider: Let's Encrypt
- Auto-renewal: Enabled

## Checklist

- [ ] Dockerfile multi-stage
- [ ] output: 'standalone' in next.config
- [ ] Health check endpoint
- [ ] .dockerignore configured
- [ ] Environment variables set
- [ ] SSL enabled
- [ ] GitHub webhook configured
