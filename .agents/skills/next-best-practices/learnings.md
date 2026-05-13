# Learnings

> Auto-maintained by `capture-learning` and `post-session-review`.
> Do NOT edit manually. Schema: `_schema/learning-template.yml`

<!-- LEARNINGS START -->

## Learning L-next-001
id: "L-next-001"
date: "2026-04-10"
type: "pattern"
status: "active"
project: "global"
scope: "global"
tags: [next-intl, i18n, middleware, routing]
confidence: 3
context: "In Next.js 15 App Router with next-intl, when configuring the i18n middleware"
problem: "Middleware matcher pattern that is incomplete causes i18n redirects to break, loop, or not apply to some routes"
solution: "Use localePrefix 'always', include '/' root, '/(locale)/:path*' for each locale, and the catch-all excluding _next/_vercel/static files. Always import locales and defaultLocale from the i18n/request config file."
reason: "next-intl middleware must intercept every navigable route to detect and apply the locale cookie. Incomplete matchers let some routes bypass locale detection silently"
validated_by: ["cold-start-2026-04-10"]
created_in: "cold-start-2026-04-10"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

## Learning L-next-002
id: "L-next-002"
date: "2026-04-10"
type: "bug-fix"
status: "active"
project: "global"
scope: "global"
tags: [next-intl, i18n, server-components, client-components]
confidence: 3
context: "In Next.js 15 App Router with next-intl, when adding translations to a component"
problem: "Using useTranslations() in a Server Component throws a runtime error. Using getTranslations() without await returns a Promise instead of the t() function."
solution: "Server Components: 'const t = await getTranslations()' (async function, awaited). Client Components: 'const t = useTranslations()' (hook, no async/await). Never swap the two."
reason: "getTranslations() is the async Server-safe API. useTranslations() is the React hook for Client Components. They share the same interface but are not interchangeable"
validated_by: ["cold-start-2026-04-10"]
created_in: "cold-start-2026-04-10"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

## Learning L-next-003
id: "L-next-003"
date: "2026-04-10"
type: "pattern"
status: "active"
project: "global"
scope: "global"
tags: [payload-cms, local-api, data-fetching, next.js]
confidence: 3
context: "In Next.js 15 with Payload CMS Local API (embedded), when fetching CMS data in Server Components"
problem: "Calling getPayload() directly inside page components leads to code duplication, inconsistent error handling, and no single place to add caching or logging"
solution: "Create a dedicated lib/payload.ts with typed utility functions (getHomePage, getHeader, etc.) each calling getPayload({ config: configPromise }) freshly per request. Functions return null on error."
reason: "A fresh Payload instance per request is required for Live Preview support. Centralizing in lib/ functions makes error handling consistent and creates a single place to add caching or retry logic"
validated_by: ["cold-start-2026-04-10"]
created_in: "cold-start-2026-04-10"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

## Learning L-next-004
id: "L-next-004"
date: "2026-04-12"
type: "bug-fix"
status: "active"
project: "global"
scope: "global"
tags: [next.js, server-actions, cookies, auth, app-router]
confidence: 3
context: "In Next.js 15 App Router, when calling a Server Action that reads cookies or auth session from a Client Component"
problem: "Server Action returns null or unauthenticated result even when user is logged in"
solution: "Use the direct action function reference (imported function) rather than a manual fetch call. Direct references automatically handle cookie forwarding. If using fetch, add 'credentials: include'."
reason: "Next.js Server Actions via direct function reference automatically handle cookie forwarding. Manual fetch to the action endpoint bypasses this mechanism"
validated_by: ["cold-start-2026-04-12"]
created_in: "cold-start-2026-04-12"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

## Learning L-next-005
id: "L-next-005"
date: "2026-04-12"
type: "pattern"
status: "active"
project: "global"
scope: "global"
tags: [next.js, image, optimization, webp, core-web-vitals, lcp, cls]
confidence: 3
context: "In Next.js 15 projects with many images, when optimizing for Core Web Vitals"
problem: "Images cause layout shift (CLS) or are slow to load (LCP) even with next/image"
solution: "1) Always set explicit width+height on non-fill images. 2) Add priority={true} on FIRST visible image only. 3) fill images: parent must have position:relative and explicit height. 4) Use sizes prop: 'sizes=(max-width: 768px) 100vw, 50vw'. 5) Use WebP at source."
reason: "next/image needs explicit dimensions to reserve space (CLS prevention). priority adds preload. fill requires a sized parent to calculate dimensions"
validated_by: ["cold-start-2026-04-12"]
created_in: "cold-start-2026-04-12"
supersedes: null
superseded_by: null
reinforces: []
contradicts: []

<!-- LEARNINGS END -->
