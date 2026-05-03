import type Database from 'better-sqlite3';
export interface OAuthClientRow {
    client_id: string;
    client_secret_hash: string | null;
    client_secret_expires_at: number | null;
    client_name: string | null;
    client_uri: string | null;
    logo_uri: string | null;
    redirect_uris: string;
    grant_types: string;
    response_types: string;
    token_endpoint_auth_method: string;
    scope: string | null;
    software_id: string | null;
    software_version: string | null;
    created_at: string;
    user_id: string | null;
}
export interface StoredAuthCode {
    code: string;
    client_id: string;
    user_id: string;
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: string;
    scopes: string[];
    resource: string | null;
    expires_at: number;
}
export interface StoredAuthRequest {
    id: string;
    client_id: string;
    redirect_uri: string;
    state: string | null;
    scopes: string[];
    code_challenge: string;
    code_challenge_method: string;
    resource: string | null;
    expires_at: number;
}
export interface StoredToken {
    token_hash: string;
    token_type: 'access' | 'refresh';
    client_id: string;
    user_id: string;
    scopes: string[];
    resource: string | null;
    expires_at: number | null;
    revoked_at: string | null;
}
export declare class OAuthStore {
    private db;
    constructor(db: Database.Database);
    registerClient(input: {
        redirectUris: string[];
        grantTypes?: string[];
        responseTypes?: string[];
        clientName?: string;
        clientUri?: string;
        logoUri?: string;
        scope?: string;
        tokenEndpointAuthMethod?: string;
        softwareId?: string;
        softwareVersion?: string;
        userId?: string;
    }): {
        clientId: string;
        clientSecret: string | null;
    };
    getClient(clientId: string): OAuthClientRow | undefined;
    verifyClientSecret(clientId: string, clientSecret: string): boolean;
    listClients(): OAuthClientRow[];
    deleteClient(clientId: string): void;
    createAuthRequest(input: {
        clientId: string;
        redirectUri: string;
        state?: string;
        scopes: string[];
        codeChallenge: string;
        codeChallengeMethod?: string;
        resource?: string;
    }): string;
    consumeAuthRequest(id: string): StoredAuthRequest | undefined;
    createAuthCode(input: {
        clientId: string;
        userId: string;
        redirectUri: string;
        codeChallenge: string;
        codeChallengeMethod: string;
        scopes: string[];
        resource?: string;
    }): string;
    getAuthCode(code: string): StoredAuthCode | undefined;
    consumeAuthCode(code: string): void;
    issueTokens(input: {
        clientId: string;
        userId: string;
        scopes: string[];
        resource?: string;
        parentRefreshHash?: string;
    }): {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    };
    lookupToken(token: string): StoredToken | undefined;
    revokeToken(token: string): void;
    revokeClientTokens(clientId: string): void;
    cleanupExpired(): void;
}
//# sourceMappingURL=oauth-store.d.ts.map