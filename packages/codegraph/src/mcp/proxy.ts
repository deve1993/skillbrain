/**
 * MCP stdio→HTTP Proxy with Auto-Session
 *
 * Bridges local stdio MCP (Claude Code/Desktop) to remote HTTP MCP server.
 * Auto-detects project from cwd, auto-starts session on connect,
 * auto-ends session on disconnect.
 *
 * Usage: node cli.js mcp-proxy
 * Env:   SKILLBRAIN_MCP_URL (default: https://memory.fl1.it/mcp)
 *        CODEGRAPH_AUTH_TOKEN (Bearer token for remote server)
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const REMOTE_URL = process.env.SKILLBRAIN_MCP_URL || 'https://memory.fl1.it/mcp'
const AUTH_TOKEN = process.env.CODEGRAPH_AUTH_TOKEN || ''

// ── Auto-detect project context from working directory ──

function detectProject(): { name: string; branch?: string; workspace?: string } {
  const cwd = process.cwd()

  // Try package.json name
  let name = path.basename(cwd)
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'))
    if (pkg.name) name = pkg.name
  } catch {}

  // Try git branch
  let branch: string | undefined
  try {
    branch = execSync('git branch --show-current', { cwd, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim()
  } catch {}

  return { name, branch, workspace: cwd }
}

function detectSessionName(): string {
  // Try to detect if we're Claude Code or Claude Desktop
  const ppid = process.ppid
  try {
    const parentCmd = execSync(`ps -p ${ppid} -o comm=`, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim()
    if (parentCmd.includes('Claude')) return 'Claude Desktop'
    if (parentCmd.includes('claude') || parentCmd.includes('node')) return 'Claude Code'
  } catch {}
  return 'Claude Code'
}

export async function startProxy(): Promise<void> {
  // 1. Connect to remote HTTP server as a client
  const clientTransport = new StreamableHTTPClientTransport(
    new URL(REMOTE_URL),
    {
      requestInit: AUTH_TOKEN
        ? { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }
        : undefined,
    },
  )

  const client = new Client({ name: 'skillbrain-proxy', version: '1.0.0' })
  await client.connect(clientTransport)

  // 2. Auto-start session (with dedup)
  const project = detectProject()
  const sessionName = detectSessionName()
  let sessionId: string | null = null
  const SESSION_REUSE_WINDOW_MS = 4 * 60 * 60 * 1000 // 4 hours

  try {
    // Check for existing in-progress session on same project
    const historyResult = await client.callTool({
      name: 'session_history',
      arguments: { project: project.name, limit: 5 },
    })
    const historyText = (historyResult as any)?.content?.[0]?.text || '[]'
    let sessions: any[] = []
    try { sessions = JSON.parse(historyText) } catch {}

    // Find most recent in-progress session on this project
    const recent = sessions.find((s) => {
      if (s.status !== 'in-progress') return false
      const started = new Date(s.started).getTime()
      const age = Date.now() - started
      return age < SESSION_REUSE_WINDOW_MS
    })

    if (recent?.id) {
      // Reuse existing session
      sessionId = recent.id
    } else {
      // Close any stale in-progress sessions (older than window)
      for (const s of sessions) {
        if (s.status !== 'in-progress') continue
        const age = Date.now() - new Date(s.started).getTime()
        if (age >= SESSION_REUSE_WINDOW_MS) {
          try {
            await client.callTool({
              name: 'session_end',
              arguments: {
                sessionId: s.id,
                summary: 'Auto-closed (stale session, >4h)',
                status: 'paused',
                memoriesCreated: 0, memoriesValidated: 0,
                filesChanged: [], commits: [],
              },
            })
          } catch {}
        }
      }

      // Create new session
      const result = await client.callTool({
        name: 'session_start',
        arguments: {
          sessionName,
          project: project.name,
          branch: project.branch || undefined,
          workspacePath: project.workspace,
        },
      })
      const text = (result as any)?.content?.[0]?.text || ''
      const match = text.match(/Session started: (S-[a-z0-9]+)/)
      if (match) sessionId = match[1]
    }
  } catch {
    // Session start is best-effort — don't block proxy
  }

  // 3. Auto-end session on shutdown
  const cleanup = async () => {
    if (sessionId) {
      try {
        await client.callTool({
          name: 'session_end',
          arguments: {
            sessionId,
            summary: 'Session ended (auto-closed by proxy)',
            status: 'paused',
            nextSteps: '',
            memoriesCreated: 0,
            memoriesValidated: 0,
            filesChanged: [],
            commits: [],
          },
        })
      } catch {}
    }
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('beforeExit', cleanup)

  // 4. Create local low-level server
  const server = new Server(
    { name: 'codegraph', version: '0.1.0' },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
      },
    },
  )

  // 5. Forward tools/list → remote
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return await client.listTools()
  })

  // 6. Forward tools/call → remote
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await client.callTool({
      name: request.params.name,
      arguments: request.params.arguments,
    })
    return result as any
  })

  // 7. Forward resources/list → remote
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return await client.listResources()
  })

  // 8. Forward resources/read → remote
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const result = await client.readResource({ uri: request.params.uri })
    return result as any
  })

  // 9. Connect local server to stdio
  const stdioTransport = new StdioServerTransport()
  await server.connect(stdioTransport)
}
