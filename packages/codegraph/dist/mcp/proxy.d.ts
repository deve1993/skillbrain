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
export interface SessionCandidate {
    id: string;
    status: string;
    started: string;
}
/**
 * Find the most recent in-progress session whose age is within the reuse window.
 * Pure function — no side effects, safe to test without a live server.
 */
export declare function findReusableSession(sessions: SessionCandidate[], now: number, windowMs: number): SessionCandidate | null;
export declare function startProxy(): Promise<void>;
//# sourceMappingURL=proxy.d.ts.map