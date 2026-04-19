import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export interface ToolContext {
  // No db needed — all stores open their own db via openDb(repoPath)
}

export type ToolRegistrar = (server: McpServer, ctx: ToolContext) => void

import { registerMemoryTools } from './memory.js'
import { registerProjectTools } from './projects.js'
import { registerSessionTools } from './sessions.js'
import { registerSkillTools } from './skills.js'
import { registerCodegraphTools } from './codegraph.js'
import { registerComponentTools } from './components.js'

export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  registerMemoryTools(server, ctx)
  registerProjectTools(server, ctx)
  registerSessionTools(server, ctx)
  registerSkillTools(server, ctx)
  registerCodegraphTools(server, ctx)
  registerComponentTools(server, ctx)
}
