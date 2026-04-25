/**
 * OAuth 2.1 authorization server for MCP clients (ChatGPT, Claude Desktop, etc.)
 *
 * Endpoints:
 *   GET  /.well-known/oauth-authorization-server
 *   GET  /.well-known/oauth-protected-resource
 *   POST /oauth/register              — RFC 7591 dynamic client registration
 *   GET  /oauth/authorize             — show consent page (or login first)
 *   POST /oauth/authorize/consent     — user approves the grant
 *   POST /oauth/token                 — authorization_code + refresh_token grants
 *   POST /oauth/revoke                — token revocation
 *
 * The /authorize flow leans on the existing dashboard session cookie (`sb_session`).
 * If the user isn't logged in, they're redirected to /auth/login with a return_to
 * that resumes the flow.
 */
import { type Router, type Request } from 'express';
export interface OAuthRouterDeps {
    skillbrainRoot: string;
    issuer: string;
    getUserIdFromRequest: (req: Request) => string | null;
}
export declare function createOAuthRouter(deps: OAuthRouterDeps): Router;
/**
 * Verify an OAuth bearer token and return the associated user.
 * Returns null if token is invalid, expired, or revoked.
 */
export declare function verifyOAuthBearer(skillbrainRoot: string, token: string): {
    userId: string;
    clientId: string;
    scopes: string[];
} | null;
//# sourceMappingURL=oauth-router.d.ts.map