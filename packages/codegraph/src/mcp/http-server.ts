/**
 * MCP HTTP Server — Dual mode entry point
 *
 * Serves both:
 * - MCP protocol via Streamable HTTP (POST/GET/DELETE /mcp)
 * - Dashboard web UI and API (GET /, /api/health, /api/data)
 *
 * Usage: node cli.js mcp --http [--port 3737] [--auth-token secret]
 */

import express from 'express'
import { randomUUID } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { createMcpServer } from './server.js'
import { loadRegistry } from '../storage/registry.js'
import { openDb, closeDb } from '../storage/db.js'
import { MemoryStore } from '../storage/memory-store.js'

const SKILLBRAIN_ROOT = process.env.SKILLBRAIN_ROOT || '/Users/dan/Desktop/progetti-web/MASTER_Fullstack session'

function loadRegistrySafe() {
  try {
    return loadRegistry()
  } catch {
    return []
  }
}

// ── Dashboard data functions (imported from dashboard logic) ──

function getMemoryGraphStats() {
  try {
    const db = openDb(SKILLBRAIN_ROOT)
    const store = new MemoryStore(db)
    const stats = store.stats()
    const topMemories = store.query({ status: 'active', limit: 20 })
    const contradictions = store.getContradictions()
    const recentSessions = store.recentSessions(5)
    closeDb(db)
    return {
      ...stats,
      topMemories: topMemories.map((m) => ({
        id: m.id, type: m.type, confidence: m.confidence,
        context: m.context.slice(0, 120), tags: m.tags, skill: m.skill,
      })),
      contradictions,
      recentSessions: recentSessions.map((s) => ({
        id: s.id, session: s.sessionName, started: s.startedAt,
        summary: s.summary, memories: s.memoriesCreated,
      })),
    }
  } catch {
    return { total: 0, byType: {}, byStatus: {}, edges: 0, topMemories: [], contradictions: [], recentSessions: [] }
  }
}

// ── HTTP Server ──

export async function startHttpServer(port: number, authToken?: string): Promise<void> {
  const app = express()
  app.use(express.json())

  // Session map for MCP transports
  const transports = new Map<string, StreamableHTTPServerTransport>()

  // ── Auth middleware for /mcp routes ──
  if (authToken) {
    app.use('/mcp', (req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (token !== authToken) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      next()
    })
  }

  // ── MCP Protocol: POST /mcp ──
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    let transport: StreamableHTTPServerTransport | undefined

    if (sessionId) {
      transport = transports.get(sessionId)
    }

    if (!transport) {
      if (isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transports.set(newSessionId, transport!)
          },
        })

        transport.onclose = () => {
          const sid = (transport as any).sessionId
          if (sid) transports.delete(sid)
        }

        const server = createMcpServer()
        await server.connect(transport)
      } else {
        res.status(400).json({ error: 'No valid session. Send an initialize request first.' })
        return
      }
    }

    await transport.handleRequest(req, res, req.body)
  })

  // ── MCP Protocol: GET /mcp (SSE stream) ──
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    if (!sessionId) {
      res.status(400).json({ error: 'Missing mcp-session-id header' })
      return
    }

    const transport = transports.get(sessionId)
    if (!transport) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    await transport.handleRequest(req, res)
  })

  // ── MCP Protocol: DELETE /mcp (close session) ──
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    if (!sessionId) {
      res.status(400).json({ error: 'Missing mcp-session-id header' })
      return
    }

    const transport = transports.get(sessionId)
    if (!transport) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    await transport.handleRequest(req, res)
    transports.delete(sessionId)
  })

  // ── Dashboard: Health ──
  app.get('/api/health', (_req, res) => {
    const mg = getMemoryGraphStats()
    const repos = loadRegistrySafe()
    res.json({
      status: 'ok',
      memories: mg.total,
      memoryEdges: mg.edges,
      repos: repos.length,
      activeSessions: transports.size,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    })
  })

  // ── Dashboard: Data API ──
  app.get('/api/data', (_req, res) => {
    const mg = getMemoryGraphStats()
    const repos = loadRegistrySafe()
    res.json({
      memoryGraph: mg,
      repos: repos.map((r: any) => ({ name: r.name, path: r.path, stats: r.stats })),
      activeSessions: transports.size,
      timestamp: new Date().toISOString(),
    })
  })

  // ── Dashboard: HTML ──
  app.get('/', (_req, res) => {
    // Import the dashboard HTML dynamically
    import('../dashboard/server.js').then((mod) => {
      // The dashboard module exports HTML via its own server
      // For now, serve a lightweight status page
      res.type('html').send(getStatusPage(transports.size))
    }).catch(() => {
      res.type('html').send(getStatusPage(transports.size))
    })
  })

  app.listen(port, () => {
    console.log(`
  SkillBrain MCP Server (HTTP mode)
  ──────────────────────────────────
  Dashboard:  http://localhost:${port}
  MCP:        http://localhost:${port}/mcp
  Health:     http://localhost:${port}/api/health
  Auth:       ${authToken ? 'Bearer token required' : 'disabled'}
`)
  })
}

function getStatusPage(activeSessions: number): string {
  const mg = getMemoryGraphStats()
  const repos = loadRegistrySafe()
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><title>SkillBrain MCP</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#08080d;color:#d0d0d0;padding:40px;max-width:800px;margin:0 auto}
h1{font-size:28px;background:linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
.sub{color:#555;font-size:13px;margin-bottom:24px}
.card{background:#0e0e16;border:1px solid #1a1a2a;border-radius:10px;padding:16px;margin-bottom:12px}
.card h2{font-size:14px;color:#a78bfa;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px}
.row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid #111118}
.row:last-child{border:none}
.label{color:#777}.val{font-weight:600;color:#d0d0d0}
.tag{display:inline-block;padding:2px 8px;margin:2px;border-radius:4px;font-size:11px;background:#111120;border:1px solid #1e1e30;color:#999}
.ok{color:#34d399}.warn{color:#f59e0b}.err{color:#f87171}
.footer{text-align:center;color:#333;font-size:11px;margin-top:32px}
</style></head><body>
<h1>SkillBrain MCP Server</h1>
<div class="sub">HTTP mode &mdash; Streamable HTTP transport &bull; <span class="ok">online</span></div>

<div class="card">
<h2>Memory Graph</h2>
<div class="row"><span class="label">Active memories</span><span class="val">${mg.total}</span></div>
<div class="row"><span class="label">Edges</span><span class="val">${mg.edges}</span></div>
<div class="row"><span class="label">By type</span><span class="val">${Object.entries(mg.byType || {}).map(([t, c]) => `${t}: ${c}`).join(', ')}</span></div>
<div class="row"><span class="label">Contradictions</span><span class="val ${(mg.contradictions?.length || 0) > 0 ? 'err' : 'ok'}">${mg.contradictions?.length || 0}</span></div>
</div>

<div class="card">
<h2>Indexed Repos (${repos.length})</h2>
${repos.map((r: any) => `<div class="row"><span class="label">${r.name}</span><span class="val">${r.stats?.nodes || 0} nodes, ${r.stats?.edges || 0} edges</span></div>`).join('')}
</div>

<div class="card">
<h2>Server Status</h2>
<div class="row"><span class="label">Active MCP sessions</span><span class="val">${activeSessions}</span></div>
<div class="row"><span class="label">Uptime</span><span class="val">${Math.round(process.uptime())}s</span></div>
<div class="row"><span class="label">Transport</span><span class="val">Streamable HTTP</span></div>
</div>

<div class="card">
<h2>Endpoints</h2>
<div class="row"><span class="label">MCP Protocol</span><span class="val">POST/GET/DELETE /mcp</span></div>
<div class="row"><span class="label">Health</span><span class="val">GET /api/health</span></div>
<div class="row"><span class="label">Data API</span><span class="val">GET /api/data</span></div>
</div>

${mg.topMemories?.length ? `
<div class="card">
<h2>Recent Memories (top ${mg.topMemories.length})</h2>
${mg.topMemories.slice(0, 8).map((m: any) => `<div class="row"><span class="label">${m.type} <span class="ok">conf:${m.confidence}</span></span><span class="val" style="max-width:60%;text-align:right;font-size:12px">${m.context}</span></div>`).join('')}
</div>` : ''}

<div class="footer">SkillBrain MCP &bull; Streamable HTTP &bull; auto-refreshes on reload</div>
<script>setTimeout(()=>location.reload(),30000)</script>
</body></html>`
}
