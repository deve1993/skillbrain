# ─────────────────────────────────────────────
# SkillBrain MCP Server — Skills-as-a-Service
# 26 MCP tools + 258 skills + Memory Graph + Dashboard
# ─────────────────────────────────────────────

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig.json ./
RUN pnpm run build

# Stage 2: Production
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache sqlite libstdc++ curl

RUN addgroup --system --gid 1001 codegraph && \
    adduser --system --uid 1001 codegraph

# Copy built app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy bundled skills data (258 skills, agents, commands)
COPY data/ ./data/

# Copy entrypoint
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Persistent data directory
RUN mkdir -p /data/.codegraph && chown -R codegraph:codegraph /data

ENV NODE_ENV=production
ENV PORT=3737
ENV SKILLBRAIN_ROOT=/data

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3737/api/health || exit 1

USER codegraph

EXPOSE 3737

CMD ["./entrypoint.sh"]
