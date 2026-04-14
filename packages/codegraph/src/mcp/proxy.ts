/**
 * MCP stdio→HTTP Proxy
 *
 * Bridges local stdio MCP (Claude Code/Desktop) to a remote HTTP MCP server.
 * Claude Code launches this as a command, it forwards all messages to the remote.
 * Dynamically discovers remote tools and mirrors them with their original schemas.
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

const REMOTE_URL = process.env.SKILLBRAIN_MCP_URL || 'https://memory.fl1.it/mcp'
const AUTH_TOKEN = process.env.CODEGRAPH_AUTH_TOKEN || ''

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

  // 2. Create local low-level server (not McpServer — raw Server for full control)
  const server = new Server(
    { name: 'codegraph', version: '0.1.0' },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
      },
    },
  )

  // 3. Forward tools/list → remote
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = await client.listTools()
    return result
  })

  // 4. Forward tools/call → remote (preserves original argument schemas)
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await client.callTool({
      name: request.params.name,
      arguments: request.params.arguments,
    })
    return result as any
  })

  // 5. Forward resources/list → remote
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const result = await client.listResources()
    return result
  })

  // 6. Forward resources/read → remote
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const result = await client.readResource({ uri: request.params.uri })
    return result as any
  })

  // 7. Connect local server to stdio
  const stdioTransport = new StdioServerTransport()
  await server.connect(stdioTransport)
}
