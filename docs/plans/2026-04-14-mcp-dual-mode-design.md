# MCP Dual Mode — Design Document

## Context

The CodeGraph MCP server currently runs as a local stdio process. Claude Code and Claude Desktop spawn it via `command` in their config. This works but:
- Requires the Mac to be on
- No remote access to dashboard or Memory Graph
- Path-dependent (breaks if folder is renamed)

We want the MCP server to also run as an HTTP service on Coolify, while keeping the fast local stdio mode for Claude Code/Desktop.

## Decision

**Dual mode**: one codebase, two entry points.

- `node cli.js mcp` → stdio (default, local, fast)
- `node cli.js mcp --http` → Express + StreamableHTTP (remote, Coolify)

## Architecture

```
                    ┌─────────────────────┐
                    │  createMcpServer()  │
                    │  17 tools           │
                    │  7 resources        │
                    │  shared logic       │
                    └──────┬──────────────┘
                           │
              ┌────────────┼────────────┐
              │                         │
     ┌────────▼─────────┐    ┌─────────▼──────────────┐
     │ stdio transport   │    │ HTTP transport          │
     │ (StdioServer)     │    │ (Express + Streamable)  │
     │                   │    │                         │
     │ stdin/stdout      │    │ POST /mcp → tool calls  │
     │ Claude Code       │    │ GET  /mcp → SSE stream  │
     │ Claude Desktop    │    │ DELETE /mcp → close      │
     └───────────────────┘    │                         │
                              │ GET /         → dashboard│
                              │ GET /api/health          │
                              │ GET /api/data            │
                              │                         │
                              │ Bearer token auth       │
                              └─────────────────────────┘
```

## Implementation

### Step 1: Extract server creation into a factory

Currently `server.ts` creates the McpServer AND connects the transport. Split into:
- `createMcpServer()` → registers all tools and resources, returns the McpServer
- Transport connection happens in the CLI entry point

### Step 2: Add `--http` flag to CLI

```typescript
program
  .command('mcp')
  .option('--http', 'Start HTTP server instead of stdio')
  .option('--port <port>', 'HTTP port', '3737')
  .option('--auth-token <token>', 'Bearer token for HTTP auth')
  .action(async (options) => {
    if (options.http) {
      await startHttpServer(options.port, options.authToken)
    } else {
      await startStdioServer()
    }
  })
```

### Step 3: HTTP server implementation

```typescript
import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

async function startHttpServer(port: number, authToken?: string) {
  const app = express()

  // Auth middleware for /mcp routes
  if (authToken) {
    app.use('/mcp', (req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (token !== authToken) return res.status(401).json({ error: 'Unauthorized' })
      next()
    })
  }

  // Session map
  const transports: Map<string, StreamableHTTPServerTransport> = new Map()

  // MCP protocol routes
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string
    let transport = transports.get(sessionId)

    if (!transport && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() })
      const server = createMcpServer()
      await server.connect(transport)
      transports.set(transport.sessionId, transport)
    }

    await transport.handleRequest(req, res, req.body)
  })

  app.get('/mcp', (req, res) => { /* SSE stream */ })
  app.delete('/mcp', (req, res) => { /* close session */ })

  // Dashboard routes (existing)
  app.get('/api/health', healthHandler)
  app.get('/api/data', dataHandler)
  app.get('/', dashboardHtml)

  app.listen(port)
}
```

### Step 4: Merge dashboard into HTTP server

The dashboard currently runs as a separate `dashboard/server.ts`. In HTTP mode, it becomes routes on the same Express app. No separate process needed.

### Step 5: Update Dockerfile

```dockerfile
CMD ["node", "dist/cli.js", "mcp", "--http", "--port", "3737"]
```

### Step 6: Update configs

**Local (unchanged):**
```json
// ~/.claude.json
"codegraph": {
  "command": "node",
  "args": ["cli.js", "mcp"]
}
```

**Coolify:**
- Port 3737
- Env: `CODEGRAPH_AUTH_TOKEN=<secret>`
- Health check: `GET /api/health`

## New dependency

- `express` — needed for HTTP mode only

## Files to modify

| File | Change |
|------|--------|
| `src/mcp/server.ts` | Extract `createMcpServer()` factory |
| `src/mcp/http-server.ts` | NEW — Express + StreamableHTTP + dashboard routes |
| `src/cli.ts` | Add `--http`, `--port`, `--auth-token` flags |
| `src/dashboard/server.ts` | Extract handlers into reusable functions |
| `Dockerfile` | Change CMD to `--http` mode |
| `package.json` | Add `express` dependency |

## Security

- Bearer token auth on `/mcp` routes (configurable via `--auth-token` or `CODEGRAPH_AUTH_TOKEN` env)
- Dashboard (`/`, `/api/*`) is public (read-only data)
- DNS rebinding protection via `createMcpExpressApp()` helper from SDK

## Verification

1. `node cli.js mcp` — stdio mode works as before
2. `node cli.js mcp --http` — Express starts on 3737
3. `curl localhost:3737/api/health` — returns ok
4. `curl localhost:3737/` — returns dashboard HTML
5. MCP client connects to `http://localhost:3737/mcp` via StreamableHTTPClientTransport
6. Docker build + run → same behavior on port 3737
