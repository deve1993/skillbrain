---
name: security-headers
description: Security headers and hardening for Next.js — CSP, CORS, rate limiting, CSRF protection, input sanitization, secrets management. Use when hardening a Next.js app, configuring security headers, or implementing rate limiting.
version: 1.0.0
---

# Security Headers & Hardening for Next.js

## 1. Security Headers in next.config.js

### Complete Headers Configuration

```ts
// next.config.ts
import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking
  {
    key: "X-Frame-Options",
    value: "DENY", // or SAMEORIGIN if you embed your own iframes
  },
  // Prevent MIME type sniffing
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // HSTS — force HTTPS for 2 years, include subdomains, allow preload list
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Control referrer information
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Disable browser features you don't use
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Prevent XSS in older browsers (modern browsers use CSP)
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  // DNS prefetch control
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

### CSP Header (Static — No Nonce)

For sites without inline scripts, add CSP directly in `next.config.ts`:

```ts
const cspHeader = `
  default-src 'self';
  script-src 'self' https://cdn.example.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\n/g, "");

// Add to securityHeaders array:
{ key: "Content-Security-Policy", value: cspHeader }
```

---

## 2. CSP with Nonce (App Router)

For apps that need inline scripts (analytics, etc.), use nonce-based CSP via middleware.

### middleware.ts — Generate Nonce

```ts
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Generate a random nonce for each request
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Build CSP with the nonce
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data: https:;
    font-src 'self';
    connect-src 'self';
    frame-src 'none';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Use Report-Only during testing, then switch to enforcing
  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

export const config = {
  matcher: [
    // Skip static files and images
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
```

### Read Nonce in Layout

```tsx
// app/layout.tsx
import { headers } from "next/headers";
import Script from "next/script";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";

  return (
    <html lang="en">
      <body>
        {children}
        {/* Analytics script with nonce */}
        <Script
          src="https://analytics.example.com/script.js"
          nonce={nonce}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
```

### Report-Only Mode for Testing

Switch to report-only before enforcing. This logs violations without blocking:

```ts
// In middleware.ts, replace:
response.headers.set("Content-Security-Policy", cspHeader);
// With:
response.headers.set("Content-Security-Policy-Report-Only", cspHeader);
```

### CSP Report Endpoint

```ts
// app/api/csp-report/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const report = body["csp-report"] || body;

    console.warn("[CSP Violation]", {
      blockedUri: report["blocked-uri"],
      violatedDirective: report["violated-directive"],
      documentUri: report["document-uri"],
      sourceFile: report["source-file"],
      lineNumber: report["line-number"],
    });

    // Send to your logging service (Sentry, LogDrain, etc.)
    // await logToService("csp-violation", report);

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }
}
```

Add `report-uri /api/csp-report;` to your CSP header to enable reporting.

---

## 3. CORS Configuration

### API Route CORS Handler

```ts
// lib/cors.ts
const ALLOWED_ORIGINS: Record<string, string[]> = {
  development: ["http://localhost:3000", "http://localhost:3001"],
  production: ["https://example.com", "https://app.example.com"],
};

export function getCorsHeaders(origin: string | null) {
  const env = process.env.NODE_ENV || "development";
  const origins = ALLOWED_ORIGINS[env] ?? ALLOWED_ORIGINS.production;

  const isAllowed = origin && origins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}
```

### API Route with CORS

```ts
// app/api/data/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/cors";

// Handle preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = getCorsHeaders(origin);

  if (!headers["Access-Control-Allow-Origin"]) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const data = { message: "Hello" };
  return NextResponse.json(data, { headers });
}
```

### CORS via Middleware (All API Routes)

```ts
// middleware.ts — add CORS handling alongside CSP
import { NextResponse, type NextRequest } from "next/server";
import { getCorsHeaders } from "@/lib/cors";

export function middleware(request: NextRequest) {
  // CORS for /api/* routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    const response = NextResponse.next();
    const corsHeaders = getCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // CSP for pages (see section 2)
  // ...
}
```

---

## 4. Rate Limiting

### In-Memory Rate Limiter (Single Instance)

```ts
// lib/rate-limit.ts
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean expired entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60_000);

export function rateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60_000
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
```

### Redis-Based Rate Limiter (Upstash)

```ts
// lib/rate-limit-redis.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Sliding window: 10 requests per 10 seconds
export const rateLimiter = new Ratelimit({
  redis: Redis.fromEnv(), // Uses UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
  prefix: "@upstash/ratelimit",
});

// Stricter limiter for auth endpoints
export const authRateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  analytics: true,
  prefix: "@upstash/ratelimit:auth",
});
```

### Apply in Middleware

```ts
// middleware.ts — rate limiting section
import { NextResponse, type NextRequest } from "next/server";
import { rateLimiter, authRateLimiter } from "@/lib/rate-limit-redis";

async function applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
  // Get identifier: prefer authenticated user ID, fallback to IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "anonymous";

  const identifier = ip;
  const isAuthRoute = request.nextUrl.pathname.startsWith("/api/auth");
  const limiter = isAuthRoute ? authRateLimiter : rateLimiter;

  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
          "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null; // Continue processing
}

export async function middleware(request: NextRequest) {
  // Rate limit API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const rateLimitResponse = await applyRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;
  }

  return NextResponse.next();
}
```

### Per-User Rate Limiting (After Auth)

```ts
// lib/rate-limit-user.ts
import { auth } from "@/auth";
import { rateLimiter } from "@/lib/rate-limit-redis";

export async function rateLimitByUser(fallbackIp: string) {
  const session = await auth();
  const identifier = session?.user?.id ?? `ip:${fallbackIp}`;
  return rateLimiter.limit(identifier);
}
```

---

## 5. CSRF Protection

### Next.js Server Actions (Built-In)

Next.js 15 Server Actions have **built-in CSRF protection**. The framework automatically:
- Validates the `Origin` header matches the host
- Uses a non-guessable action ID

No extra work needed for Server Actions. Use them over raw API routes when possible.

### Double Submit Cookie for API Routes

```ts
// lib/csrf.ts
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE = "__csrf";
const CSRF_HEADER = "x-csrf-token";

export function generateCsrfToken(): string {
  return crypto.randomUUID();
}

export async function setCsrfCookie(): Promise<string> {
  const token = generateCsrfToken();
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });
  return token;
}

export async function validateCsrf(request: NextRequest): Promise<boolean> {
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) return false;
  return cookieToken === headerToken;
}
```

### CSRF Token API + Validated Route

```ts
// app/api/csrf/route.ts — issue token
import { NextResponse } from "next/server";
import { setCsrfCookie } from "@/lib/csrf";

export async function GET() {
  const token = await setCsrfCookie();
  return NextResponse.json({ csrfToken: token });
}
```

```ts
// app/api/protected/route.ts — validate token
import { NextRequest, NextResponse } from "next/server";
import { validateCsrf } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  const valid = await validateCsrf(request);
  if (!valid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  // Process the request safely
  const data = await request.json();
  return NextResponse.json({ success: true });
}
```

### Client-Side Usage

```ts
// hooks/useCsrf.ts
"use client";
import { useEffect, useState } from "react";

export function useCsrf() {
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d) => setToken(d.csrfToken));
  }, []);

  return token;
}

// Usage in a form submission:
const csrfToken = useCsrf();

await fetch("/api/protected", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-csrf-token": csrfToken,
  },
  body: JSON.stringify({ data: "value" }),
});
```

---

## 6. Input Sanitization

### Zod Validation at API Boundary

Always validate ALL input with Zod before processing:

```ts
// lib/validations/contact.ts
import { z } from "zod";

export const contactSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .regex(/^[\p{L}\p{N}\s\-'.]+$/u, "Invalid characters in name"),
  email: z
    .string()
    .email("Invalid email")
    .max(254, "Email too long")
    .toLowerCase(),
  message: z
    .string()
    .min(10, "Message too short")
    .max(5000, "Message too long")
    .trim(),
  // Prevent hidden fields injection
  honeypot: z.string().max(0, "Bot detected").optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
```

```ts
// app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { contactSchema } from "@/lib/validations/contact";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = contactSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, message } = result.data;
  // Safe to use — validated and sanitized by Zod
}
```

### DOMPurify for User HTML

```ts
// lib/sanitize.ts
import DOMPurify from "isomorphic-dompurify";

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });
}

// Usage in a component
function UserContent({ html }: { html: string }) {
  const clean = sanitizeHtml(html);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

### SQL Injection Prevention

Always use parameterized queries. Never interpolate user input into SQL:

```ts
// WRONG — vulnerable to SQL injection
const user = await db.query(`SELECT * FROM users WHERE id = '${userId}'`);

// CORRECT — Prisma (parameterized by default)
const user = await prisma.user.findUnique({ where: { id: userId } });

// CORRECT — Drizzle (parameterized by default)
const user = await db.select().from(users).where(eq(users.id, userId));

// CORRECT — Raw SQL with parameters
const user = await db.execute(sql`SELECT * FROM users WHERE id = ${userId}`);
```

### Path Traversal Prevention

```ts
// lib/safe-path.ts
import path from "path";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export function safePath(userInput: string): string | null {
  // Resolve the full path
  const resolved = path.resolve(UPLOAD_DIR, userInput);

  // Ensure it stays within the allowed directory
  if (!resolved.startsWith(UPLOAD_DIR)) {
    return null; // Path traversal attempt
  }

  // Block dangerous patterns
  if (/\.\.|~|%2e%2e|%00/i.test(userInput)) {
    return null;
  }

  return resolved;
}

// Usage
export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get("file");
  if (!filename) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const filePath = safePath(filename);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
  }

  // Safe to read the file
}
```

---

## 7. Secrets Management

### .env.local Best Practices

```bash
# .env.local — NEVER commit this file
# Add to .gitignore: .env*.local

# Server-only secrets (safe — never sent to browser)
DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
AUTH_SECRET="randomly-generated-64-char-string"
STRIPE_SECRET_KEY="sk_live_..."
RESEND_API_KEY="re_..."

# Public vars (exposed to browser — only non-sensitive values)
NEXT_PUBLIC_APP_URL="https://example.com"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

### Runtime vs Build-Time Env Vars

```ts
// lib/env.ts — validate env at startup with Zod
import { z } from "zod";

// Server-only env (validated at build/startup)
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  NODE_ENV: z.enum(["development", "production", "test"]),
});

// Client env (available in browser — no secrets here)
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
});

export const serverEnv = serverSchema.parse(process.env);
export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});
```

### NEXT_PUBLIC_ Exposure Risks

```
RULE: Never prefix secrets with NEXT_PUBLIC_

NEXT_PUBLIC_* vars are inlined into the client JS bundle at build time.
They are visible to anyone who views your page source.

SAFE:     NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_GA_ID
DANGER:   NEXT_PUBLIC_API_SECRET, NEXT_PUBLIC_DB_URL
```

If you need a secret client-side, create a server API route that uses the secret and call it from the client.

### Vault / Infisical Integration Pattern

```ts
// lib/secrets.ts — fetch secrets from Infisical at startup
import { InfisicalClient } from "@infisical/sdk";

let cachedSecrets: Record<string, string> | null = null;

export async function getSecrets(): Promise<Record<string, string>> {
  if (cachedSecrets) return cachedSecrets;

  const client = new InfisicalClient({
    siteUrl: "https://app.infisical.com",
  });

  await client.auth().universalAuth.login({
    clientId: process.env.INFISICAL_CLIENT_ID!,
    clientSecret: process.env.INFISICAL_CLIENT_SECRET!,
  });

  const secrets = await client.secrets().listSecrets({
    environment: process.env.NODE_ENV === "production" ? "prod" : "dev",
    projectId: process.env.INFISICAL_PROJECT_ID!,
  });

  cachedSecrets = Object.fromEntries(
    secrets.map((s) => [s.secretKey, s.secretValue])
  );

  return cachedSecrets;
}

// Usage in server code
const secrets = await getSecrets();
const dbUrl = secrets.DATABASE_URL;
```

### Secret Rotation Strategy

```
1. Use Infisical/Vault with automatic rotation policies
2. Never hardcode secrets — always use env vars or secret manager
3. Rotate immediately if a secret is exposed in git history:
   - Revoke the old secret
   - Generate a new one
   - Update in secret manager
   - Redeploy
4. Use short-lived tokens where possible (JWT with 15min expiry)
5. Audit secret access logs monthly
```

---

## 8. OWASP Top 10 Checklist for Next.js

| # | OWASP Risk | Next.js Mitigation |
|---|-----------|-------------------|
| A01 | Broken Access Control | Middleware auth checks, Server Actions with `auth()`, route-level guards |
| A02 | Cryptographic Failures | HTTPS via HSTS header, secure cookies (`httpOnly`, `secure`, `sameSite`) |
| A03 | Injection | Zod validation, parameterized queries (Prisma/Drizzle), DOMPurify |
| A04 | Insecure Design | Server Components by default (no client data exposure), RSC boundaries |
| A05 | Security Misconfiguration | Security headers (CSP, X-Frame, HSTS), env validation at startup |
| A06 | Vulnerable Components | `npm audit`, Dependabot/Renovate, lock file pinning |
| A07 | Auth Failures | Auth.js v5, rate limiting on login, CSRF protection, session rotation |
| A08 | Data Integrity Failures | CSP with nonce (prevent script injection), SRI for external scripts |
| A09 | Logging & Monitoring | CSP report endpoint, Sentry error tracking, structured logging |
| A10 | SSRF | Validate/allowlist URLs in Server Components, block internal IPs in fetches |

### Quick Hardening Checklist

```
[ ] Security headers configured in next.config.ts or middleware
[ ] CSP with nonce for inline scripts
[ ] HSTS enabled with preload
[ ] Rate limiting on all API routes (stricter on auth)
[ ] CSRF protection on state-changing endpoints
[ ] All user input validated with Zod
[ ] No secrets in NEXT_PUBLIC_* vars
[ ] .env*.local in .gitignore
[ ] npm audit clean (no critical/high vulnerabilities)
[ ] Cookies: httpOnly + secure + sameSite=strict
[ ] Error pages don't leak stack traces in production
[ ] File uploads validated (type, size, path traversal)
[ ] CORS allowlist per environment
[ ] Logging for security events (failed auth, rate limits, CSP violations)
```
