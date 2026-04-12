
## Task 14: CORS + Security Headers ✅

**Status**: COMPLETE

**What was done**:
1. Created `src/middleware/security.ts` with security headers middleware
   - X-Content-Type-Options: nosniff (prevent MIME sniffing)
   - X-Frame-Options: DENY (prevent clickjacking)
   - Referrer-Policy: strict-origin-when-cross-origin (control referrer info)

2. Updated `src/server.ts`:
   - Imported securityHeaders middleware
   - Applied globally via `app.use(securityHeaders)` before routes
   - Replaced hardcoded CORS (localhost:4200) with dynamic config
   - Set `origin: true` to allow all origins (widget use case)
   - Added OPTIONS method support
   - Added Accept header to allowedHeaders

**Design Decision**:
- Widget must work on any client site → permissive CORS
- Per-skill origin restriction via `allowedOrigins` field is a future enhancement
- Would require skill lookup on every CORS preflight (expensive)

**Verification**:
- ✅ `npx tsc --noEmit` passes (no TypeScript errors)
- ✅ All files in English
- ✅ No `as any`, `@ts-ignore` used
- ✅ Evidence saved to `.sisyphus/evidence/task-14-tsc-check.txt`


## Task 16: Docker + Deployment Config ✅

**Completed**: Docker configuration for production deployment

### Files Created/Modified:
1. **Dockerfile** - Multi-stage build (builder + runner stages)
   - Stage 1: Compiles TypeScript and builds widget
   - Stage 2: Production runtime with minimal footprint
   - Health check: GET /health (30s interval, 10s timeout)
   - Exposes port 3001

2. **tsconfig.json** - Added `rootDir: "./src"`
   - outDir: ./dist (already present)
   - rootDir: ./src (newly added)
   - Strict mode enabled
   - ES2022 target

3. **package.json** - Updated scripts
   - `"start": "node dist/server.js"` (production)
   - `"build": "tsc && npm run build:widget"` (new)
   - `"dev": "tsx watch src/server.ts"` (development)

4. **.dockerignore** - Excludes non-essential files
   - node_modules, dist, .git, client/, tests/, .sisyphus, .opencode, etc.

### Verification:
- ✅ `npx tsc --noEmit` passes (no TypeScript errors)
- ✅ All configuration files in English
- ✅ Multi-stage build optimized for production
- ✅ Health check configured

### Next Steps:
- Ready for Docker build and deployment to Coolify
- Can run `docker build -t lead-qualifier .` to test build
