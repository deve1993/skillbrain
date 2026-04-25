import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export interface ToolContext {
  /**
   * The authenticated user this MCP session belongs to.
   * Set by http-server.ts when an API key (or OAuth bearer) is matched on /mcp
   * initialize. Tools that operate on user-scoped data (e.g. user_env_*) require
   * this — they fail with a clear error when it is missing rather than falling
   * back to a default user.
   */
  userId?: string
}

export type ToolRegistrar = (server: McpServer, ctx: ToolContext) => void

import { registerMemoryTools } from './memory.js'
import { registerProjectTools } from './projects.js'
import { registerSessionTools } from './sessions.js'
import { registerSkillTools } from './skills.js'
import { registerCodegraphTools } from './codegraph.js'
import { registerComponentTools } from './components.js'
import { registerUserEnvTools } from './users-env.js'

export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  registerMemoryTools(server, ctx)
  registerProjectTools(server, ctx)
  registerSessionTools(server, ctx)
  registerSkillTools(server, ctx)
  registerCodegraphTools(server, ctx)
  registerComponentTools(server, ctx)
  registerUserEnvTools(server, ctx)
}
