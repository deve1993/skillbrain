# ─────────────────────────────────────────────
# CodeGraph + Memory Graph — Monolite Container
# Dashboard (3737) + SQLite + Health Check
# ─────────────────────────────────────────────

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install build deps for better-sqlite3 (native addon)
RUN apk add --no-cache python3 make g++

COPY package.json pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig.json ./

RUN pnpm run build

# Stage 2: Production
FROM node:20-alpine AS runner
WORKDIR /app

# better-sqlite3 needs these at runtime
RUN apk add --no-cache sqlite

# Non-root user
RUN addgroup --system --gid 1001 codegraph && \
    adduser --system --uid 1001 codegraph

# Copy built app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Data directory for SQLite databases
RUN mkdir -p /data/.codegraph /data/skills && chown -R codegraph:codegraph /data

# Environment
ENV NODE_ENV=production
ENV PORT=3737
ENV CODEGRAPH_DATA_DIR=/data

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3737/api/data || exit 1

USER codegraph

EXPOSE 3737

# Start dashboard (serves both web UI and API)
CMD ["node", "dist/dashboard/server.js"]
