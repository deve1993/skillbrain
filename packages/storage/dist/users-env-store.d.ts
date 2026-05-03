import type Database from 'better-sqlite3';
export type EnvCategory = 'api_key' | 'mcp_config' | 'integration' | 'preference';
export interface UserEnvVar {
    id: string;
    userId: string;
    varName: string;
    category: EnvCategory;
    service?: string;
    isSecret: boolean;
    description?: string;
    source: string;
    lastUsedAt?: string;
    createdAt: string;
    updatedAt: string;
}
export interface UserEnvSetOptions {
    category?: EnvCategory;
    service?: string;
    isSecret?: boolean;
    description?: string;
    source?: string;
}
export interface UserEnvListOptions {
    category?: EnvCategory;
    service?: string;
}
/**
 * Per-user master.env store. Mirrors the env methods of ProjectsStore but
 * scoped by user_id instead of project_name. Same AES-256-GCM encryption,
 * same global ENCRYPTION_KEY (isolation via user_id, not via per-user key).
 */
export declare class UsersEnvStore {
    private db;
    constructor(db: Database.Database);
    setEnv(userId: string, varName: string, value: string, opts?: UserEnvSetOptions): UserEnvVar;
    /**
     * Decrypt a single value and bump last_used_at.
     * Returns undefined if the var doesn't exist for this user.
     */
    getEnv(userId: string, varName: string): string | undefined;
    /**
     * Decrypt all env values for a user as a Record<varName, value>.
     * Used for bulk export. Does NOT bump last_used_at (to keep export idempotent).
     */
    getAllEnv(userId: string, opts?: UserEnvListOptions): Record<string, string>;
    /**
     * List env vars for a user — names + metadata only, no values.
     * Used by hub UI and capability profile.
     */
    listEnv(userId: string, opts?: UserEnvListOptions): UserEnvVar[];
    hasEnv(userId: string, varName: string): boolean;
    /**
     * Capability profile: which services this user has at least one credential for.
     * Powers the session_resume payload Claude Code reads at start.
     */
    capability(userId: string): {
        services: string[];
        totalVars: number;
        categories: Record<EnvCategory, number>;
    };
    /**
     * Names of env vars this user has that overlap with a given list of project env names.
     * Used by session_resume to flag conflicts so Claude Code knows to ask which to use.
     */
    conflictsWith(userId: string, projectVarNames: string[]): string[];
    deleteEnv(userId: string, varName: string): boolean;
    /**
     * Bulk import .env content. Returns { saved, errors }.
     */
    importEnv(userId: string, envContent: string, opts?: UserEnvSetOptions): {
        saved: number;
        errors: string[];
    };
    private getMeta;
    private rowToMeta;
}
//# sourceMappingURL=users-env-store.d.ts.map