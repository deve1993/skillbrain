/**
 * MCP stdio→HTTP Proxy
 *
 * Bridges local stdio MCP (Claude Code/Desktop) to a remote HTTP MCP server.
 * Claude Code launches this as a command, it forwards all messages to the remote.
 *
 * Usage: node cli.js mcp-proxy
 * Env:   SKILLBRAIN_MCP_URL (default: https://memory.fl1.it/mcp)
 *        CODEGRAPH_AUTH_TOKEN (Bearer token for remote server)
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

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

  // 2. Discover remote tools and resources
  const remoteTools = await client.listTools()
  const remoteResources = await client.listResources()

  // 3. Create local stdio server that mirrors remote tools
  const server = new McpServer({ name: 'codegraph', version: '0.1.0' })

  // Register each remote tool as a local proxy tool
  for (const tool of remoteTools.tools) {
    // Build zod schema from JSON schema (simplified: accept any object)
    server.tool(
      tool.name,
      tool.description || '',
      // Accept any arguments — the remote server validates
      { _args: z.string().optional().describe('JSON arguments (pass-through to remote)') },
      async (args) => {
        try {
          const result = await client.callTool({
            name: tool.name,
            arguments: args,
          })
          return result as any
        } catch (err: any) {
          return {
            content: [{ type: 'text' as const, text: `Proxy error: ${err.message}` }],
          }
        }
      },
    )
  }

  // Register remote resources
  for (const resource of remoteResources.resources) {
    server.resource(
      resource.name || resource.uri,
      resource.uri,
      async () => {
        try {
          const result = await client.readResource({ uri: resource.uri })
          return result as any
        } catch (err: any) {
          return {
            contents: [{ uri: resource.uri, text: `Proxy error: ${err.message}`, mimeType: 'text/plain' }],
          }
        }
      },
    )
  }

  // 4. Connect local server to stdio
  const stdioTransport = new StdioServerTransport()
  await server.connect(stdioTransport)
}
