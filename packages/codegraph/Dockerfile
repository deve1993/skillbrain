# ─────────────────────────────────────────────
# CodeGraph + Memory Graph — Monolite Container
# MCP HTTP server + Dashboard + SQLite
# ─────────────────────────────────────────────

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install build deps for better-sqlite3 (native addon)
RUN apk add --no-cache python3 make g++

# Copy package files for install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source and build
COPY src/ ./src/
COPY tsconfig.json ./
RUN pnpm run build

# Stage 2: Production
FROM node:20-alpine AS runner
WORKDIR /app

# better-sqlite3 needs libstdc++, curl needed for Coolify healthcheck
RUN apk add --no-cache sqlite libstdc++ curl

# Non-root user
RUN addgroup --system --gid 1001 codegraph && \
    adduser --system --uid 1001 codegraph

# Copy built app + production deps only
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Data directory for SQLite database (persistent volume)
RUN mkdir -p /data/.codegraph && chown -R codegraph:codegraph /data

# Environment
ENV NODE_ENV=production
ENV PORT=3737
ENV SKILLBRAIN_ROOT=/data

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3737/api/health || exit 1

USER codegraph

EXPOSE 3737

# Start MCP server in HTTP mode
# Auth token: set CODEGRAPH_AUTH_TOKEN env in Coolify
CMD ["node", "dist/cli.js", "mcp", "--http"]
