/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

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
import { gzipSync } from 'node:zlib'
import { HEARTBEAT_INTERVAL_MS, SESSION_REUSE_WINDOW_MS } from '../constants.js'
import { analyzeCommand } from '../cli/commands/analyze.js'
import { getDbPath } from '../storage/db.js'
import { loadMeta } from '../storage/meta.js'

// Default points to the author's public instance. Override via SKILLBRAIN_MCP_URL for your own deployment.
const REMOTE_URL = process.env.SKILLBRAIN_MCP_URL || 'https://memory.fl1.it/mcp'
const AUTH_TOKEN = process.env.CODEGRAPH_AUTH_TOKEN || ''

/**
 * Run codegraph analyze on the local workspace, then upload
 * the resulting graph.db to the remote SkillBrain server.
 */
async function localAnalyzeAndUpload(repoPath: string, remoteUrl: string, authToken: string): Promise<void> {
  // 1. Run local analysis
  await analyzeCommand(repoPath, { noProgress: true, skipGit: false })

  // 2. Read graph.db produced by analyze
  const dbPath = getDbPath(repoPath)
  if (!fs.existsSync(dbPath)) return

  // gzip compress before base64 to reduce payload size (~3x smaller)
  const rawDb = fs.readFileSync(dbPath)
  const graphDb = gzipSync(rawDb).toString('base64')

  // 3. Load local meta for stats + lastCommit
  const meta = loadMeta(repoPath)
  if (!meta) throw new Error('meta.json not found after analysis — index may have failed')

  // 4. POST to server upload endpoint
  const base = new URL(remoteUrl)
  base.pathname = '/api/codegraph/upload'
  const uploadUrl = base.toString()
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      repoName: meta.name,
      lastCommit: meta.lastCommit,
      stats: meta.stats,
      graphDb,
      compressed: true,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`CodeGraph upload failed (${response.status}): ${text}`)
  }
}

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

// ── Session dedup (pure, testable) ──

export interface SessionCandidate {
  id: string
  status: string
  started: string
}

/**
 * Find the most recent in-progress session whose age is within the reuse window.
 * Pure function — no side effects, safe to test without a live server.
 */
export function findReusableSession(
  sessions: SessionCandidate[],
  now: number,
  windowMs: number,
): SessionCandidate | null {
  return (
    sessions.find((s) => {
      if (s.status !== 'in-progress') return false
      const started = new Date(s.started).getTime()
      return now - started < windowMs
    }) ?? null
  )
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
  const workspacePath = project.workspace ?? process.cwd()
  const sessionName = detectSessionName()
  let sessionId: string | null = null

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
    const recent = findReusableSession(sessions, Date.now(), SESSION_REUSE_WINDOW_MS)

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

  // Auto-index current workspace if not in remote registry or stale commit
  try {
    const listResult = await client.callTool({ name: 'codegraph_list_repos', arguments: {} })
    const remoteRepos: Array<{ name: string; lastCommit: string | null }> =
      JSON.parse((listResult as any)?.content?.[0]?.text || '[]')

    const localMeta = loadMeta(workspacePath)
    const remoteEntry = remoteRepos.find((r) => r.name === project.name)

    const needsUpload =
      localMeta !== null &&
      (!remoteEntry || remoteEntry.lastCommit !== localMeta.lastCommit)

    if (needsUpload) {
      // Fire-and-forget — never block proxy startup
      localAnalyzeAndUpload(workspacePath, REMOTE_URL, AUTH_TOKEN).catch(() => {})
    }
  } catch {
    // best-effort — never block proxy startup
  }

  // 3. Heartbeat every 5 minutes (keeps session alive on server)
  // Server auto-closes sessions without heartbeat after 15 min
  if (sessionId) {
    setInterval(async () => {
      try {
        await client.callTool({
          name: 'session_heartbeat',
          arguments: { sessionId },
        })
      } catch {}
    }, HEARTBEAT_INTERVAL_MS)
  }

  // 4. Auto-end session on shutdown (best effort — server also auto-closes stale)
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

  // 5. Forward tools/list → remote (+ inject local codegraph_analyze tool)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const remote = await client.listTools()
    return {
      tools: [
        ...remote.tools,
        {
          name: 'codegraph_analyze',
          description: 'Analyze current workspace and upload graph to SkillBrain server',
          inputSchema: { type: 'object' as const, properties: {}, required: [] },
        },
      ],
    }
  })

  // 6. Forward tools/call → remote (intercept codegraph_analyze locally)
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Intercept codegraph_analyze — runs locally in the proxy, not on remote server
    if (request.params.name === 'codegraph_analyze') {
      try {
        await localAnalyzeAndUpload(workspacePath, REMOTE_URL, AUTH_TOKEN)
        return {
          content: [{ type: 'text' as const, text: `✅ Workspace "${project.name}" analyzed and uploaded to SkillBrain.` }],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `❌ Analysis failed: ${err.message}` }],
        }
      }
    }

    // All other tools → remote server
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
