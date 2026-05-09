# ─────────────────────────────────────────────
# SkillBrain MCP Server — Skills-as-a-Service
# 26 MCP tools + 258 skills + Memory Graph + Dashboard
# ─────────────────────────────────────────────

# Stage 1: Build
# node:20-slim (Debian/glibc) so native addons (better-sqlite3, etc.)
# are compiled against glibc and are compatible with the runner stage.
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig.json ./
RUN pnpm run build

# tsc does not copy .sql files — pull storage migrations into dist explicitly.
# Workspace link: node_modules/@skillbrain/storage → ../storage (relative to /app).
# We try that first, then fall back to common alternative locations.
RUN for dir in \
      node_modules/@skillbrain/storage/dist/migrations \
      node_modules/@skillbrain/storage/src/migrations \
      packages/storage/dist/migrations \
      packages/storage/src/migrations; do \
      if [ -d "$dir" ]; then \
        mkdir -p dist/storage && cp -r "$dir" dist/storage/migrations; \
        echo "Copied storage migrations from $dir"; \
        break; \
      fi; \
    done

# Stage 2: Production
# node:20-slim (Debian) provides native glibc — required by onnxruntime-node.
# Alpine + gcompat shim is insufficient: libonnxruntime.so.1 needs libm.so.6,
# libc.so.6, libpthread.so.0 as glibc natives, not musl wrappers.
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 curl libstdc++6 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 codegraph && \
    useradd --system --uid 1001 --gid 1001 --no-create-home codegraph

# Copy built app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy bundled skills data (258 skills, agents, commands)
COPY data/ ./data/

# Copy dashboard frontend
COPY public/ ./public/

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
