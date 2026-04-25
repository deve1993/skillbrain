import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export interface CreateMcpServerOptions {
    /**
     * The authenticated user this MCP session is bound to.
     * Required for user-scoped tools (e.g. user_env_*).
     */
    userId?: string;
}
export declare function createMcpServer(opts?: CreateMcpServerOptions): McpServer;
export declare function startMcpServer(): Promise<void>;
//# sourceMappingURL=server.d.ts.map