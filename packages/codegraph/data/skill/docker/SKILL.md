---
name: docker
description: Docker MCP - gestione container Coolify, debug log, ispezione deployment, monitor risorse. Use when inspecting containers, debugging deployments, reading logs, or monitoring resource usage via Docker MCP.
version: 1.0.0
---

# Docker MCP Skill

## MCP Server

Docker MCP Gateway — Accesso diretto al Docker daemon tramite Docker Desktop (v4.43+). Gestisce container, immagini, log e stats.

## Attivazione

Richiede Docker Desktop installato e attivo sulla macchina locale. Il MCP si connette al socket Docker locale.

```json
"docker": {
  "type": "local",
  "command": ["docker", "mcp", "gateway", "run", "docker"],
  "enabled": true
}
```

## Tool MCP Principali

### list_containers — Lista container
```
list_containers(all: false)   // solo running
list_containers(all: true)    // tutti (inclusi stopped/exited)

// Con filtri:
list_containers(filters: { "status": ["exited"] })
list_containers(filters: { "name": ["pixarts-"] })
```

### get_logs — Leggi log container
```
get_logs(container_id: "abc123def456")
get_logs(container_name: "app-nome-progetto")
get_logs(container_id: "abc123", tail: 100)        // ultimi 100 righe
get_logs(container_id: "abc123", since: "2026-01-01T00:00:00Z")
```

### inspect_container — Ispezione completa
```
inspect_container(container_id: "abc123")
// Restituisce: Config, NetworkSettings, Mounts, State, Env vars, Labels
```

### stats — Risorse in real-time
```
stats(container_id: "abc123")
// Restituisce: CPU%, Memory usage/limit, Network I/O, Block I/O
```

### exec_run — Esegui comando nel container (solo diagnosi)
```
exec_run(container_id: "abc123", command: ["node", "--version"])
exec_run(container_id: "abc123", command: ["ls", "-la", "/app"])
exec_run(container_id: "abc123", command: ["cat", "/app/.env.local"])
exec_run(container_id: "abc123", command: ["wget", "-q", "-O-", "http://localhost:3000/api/health"])
```

### list_images — Lista immagini
```
list_images()
list_images(filters: { "dangling": ["true"] })  // immagini orfane
```

### image_history — Layer history
```
image_history(image: "sha256:abc...")
```

## Stack Coolify — Context

I container Coolify seguono questi pattern:

| Aspetto | Pattern |
|---------|---------|
| Container name | `{uuid-applicazione}` o `{nome-servizio}` |
| Networking | Traefik come reverse proxy |
| Labels | `traefik.enable=true`, `traefik.http.routers.*` |
| Restart policy | `unless-stopped` |
| Volumes | `/data/coolify/applications/{uuid}/` |
| Registry | GitHub Container Registry (`ghcr.io`) |

## Workflow Debug Standard

### 1. Container non parte dopo deploy
```
Step 1: list_containers(all: true, filters: { "name": ["nome-progetto"] })
         → Trova container, nota status (exited? created? restarting?)

Step 2: get_logs(container_id, tail: 150)
         → Leggi gli ultimi log — il problema è quasi sempre qui

Step 3: inspect_container(container_id)
         → Controlla: Env vars presenti? Command corretto? Porte configurate?

Step 4: Diagnosi comune:
         - "MODULE_NOT_FOUND" → npm build incompleto, riesegui build
         - "EADDRINUSE" → porta già in uso da altro container
         - "Cannot find module" → dipendenza mancante o path errato
         - "Invalid environment variable" → ENV var mancante o malformata
```

### 2. Container running ma sito non risponde (502/504)
```
Step 1: list_containers → verifica che il container sia "running" non "restarting"
Step 2: stats(container_id) → memoria > 80%? CPU spike?
Step 3: get_logs → cerca crash loop, OOM killer, errori runtime
Step 4: exec_run(["wget", "-q", "-O-", "http://localhost:3000/api/health"])
         → Testa l'health endpoint dall'interno del container
Step 5: inspect_container → verifica labels Traefik correttamente configurate
```

### 3. Container lento / OOM
```
Step 1: stats(container_id) → controlla Memory usage vs limit
Step 2: Se memory > 80% del limit:
         - Aumento limite in Coolify: Settings → Resources → Memory
         - Oppure ottimizza next.config.ts (experimental.serverMemoryOptimizations)
Step 3: get_logs → cerca "heap out of memory", "SIGKILL", "Killed"
Step 4: Se CPU spike persistente:
         - exec_run(["node", "-e", "process.memoryUsage()"])
         - Controlla bundle size con Next.js analyzer
```

### 4. Verifica post-deploy (routine)
```
Step 1: list_containers → container running? da quanto tempo?
Step 2: stats → stabile (non spike continui)
Step 3: exec_run(["wget", "-q", "-O-", "http://localhost:3000/api/health"])
         → Risposta attesa: {"status":"ok","timestamp":"..."}
Step 4: get_logs(tail: 30) → nessun errore nei log recenti
Step 5: ✅ Deploy confermato sano
```

### 5. Pulizia immagini orfane
```
list_images(filters: { "dangling": ["true"] })
→ Mostra immagini non tagggate che occupano spazio
→ Segnala a devops-engineer per cleanup con: docker image prune
```

## Dockerfile Next.js Standard (Coolify-Ready)

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runner (minimal)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

## Coolify API (alternativa REST quando Docker MCP non disponibile)

```bash
BASE_URL: https://coolify.pixarts.eu  # oppure IP del VPS
API_KEY: {env:COOLIFY_API_KEY}

# Lista applicazioni
GET /api/v1/applications

# Trigger deploy manuale
GET /api/v1/deploy?uuid={app-uuid}&force=false

# Env vars dell'applicazione
GET /api/v1/applications/{uuid}/envs
POST /api/v1/applications/{uuid}/envs  # Aggiunge/modifica env var

# Logs (alternativa a Docker MCP)
GET /api/v1/applications/{uuid}/logs
```

## Thresholds di Allarme

| Metrica | Normale | Attenzione | Critico |
|---------|---------|------------|---------|
| Memory usage | < 60% limit | 60-80% | > 80% |
| CPU (steady) | < 20% | 20-50% | > 50% |
| CPU (spike) | spike brevi ok | spike > 2min | spike > 10min |
| Restart count | 0 | 1-3 | > 3 in 1h |
| Container uptime | > 24h | < 1h (deploy recente) | restarting loop |

## Best Practices

1. **Logs prima di tutto** — Il 90% dei problemi si capisce dai log
2. **Mai stop/rm in prod** — Solo inspect, logs, stats, exec per lettura
3. **exec solo per diagnosi** — Comandi read-only: `ls`, `node -v`, `cat`, `wget`
4. **Escalation a @devops-engineer** — Se serve modifica a Dockerfile o config Coolify
5. **Stats prima di restart** — Documenta le stats prima di qualsiasi intervento
6. **Health check first** — Verifica sempre `/api/health` come primo test

## Integrazione con Agenti

| Agente | Quando usa Docker MCP |
|--------|----------------------|
| @docker-manager | Debug runtime, log inspection, health check |
| @devops-engineer | Build issues, Dockerfile optimization |
| @site-deployer | Verifica post-deploy automatica |
| @site-qa | Confirm container health prima di QA |
