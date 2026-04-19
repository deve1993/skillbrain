import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export interface ToolContext {
}
export type ToolRegistrar = (server: McpServer, ctx: ToolContext) => void;
export declare function registerAllTools(server: McpServer, ctx: ToolContext): void;
//# sourceMappingURL=index.d.ts.map