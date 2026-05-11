import type Database from 'better-sqlite3';
import type { EnvCategory } from './users-env-store.js';
export interface TeamMember {
    name: string;
    role?: string;
    email?: string;
}
export interface Project {
    name: string;
    displayName?: string;
    description?: string;
    clientName?: string;
    category?: string;
    teamLead?: string;
    teamMembers: TeamMember[];
    startedAt?: string;
    endedAt?: string;
    status: 'active' | 'paused' | 'archived' | 'completed';
    repoUrl?: string;
    mainBranch?: string;
    workspacePath?: string;
    stack: string[];
    language?: string;
    packageManager?: string;
    nodeVersion?: string;
    dbType?: string;
    dbReference?: string;
    dbAdminUrl?: string;
    cmsType?: string;
    cmsAdminUrl?: string;
    deployPlatform?: string;
    liveUrl?: string;
    deployStatus?: string;
    lastDeploy?: string;
    hasCi: boolean;
    domainPrimary?: string;
    domainsExtra: string[];
    integrations: Record<string, any>;
    legalCookieBanner?: string;
    legalPrivacyUrl?: string;
    legalTermsUrl?: string;
    aliases: string[];
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
export interface EnvVar {
    id: string;
    projectName: string;
    varName: string;
    category: EnvCategory;
    service?: string;
    environment: string;
    source?: string;
    isSecret: boolean;
    description?: string;
    createdAt: string;
    updatedAt: string;
}
export declare class ProjectsStore {
    private db;
    constructor(db: Database.Database);
    upsert(project: Partial<Project> & {
        name: string;
    }): Project;
    get(name: string): Project | undefined;
    list(): Project[];
    delete(name: string): void;
    upsertArchived(name: string): void;
    /**
     * Merge aliases into a primary project.
     * Moves sessions/memories/env-vars from aliases → primary, then deletes alias rows.
     * Throws if the primary project does not exist.
     */
    merge(primary: string, aliases: string[]): {
        movedSessions: number;
        movedMemories: number;
        movedEnvVars: number;
    };
    setEnv(projectName: string, varName: string, value: string, environment?: string, source?: string, isSecret?: boolean, description?: string, category?: EnvCategory, service?: string): void;
    getEnv(projectName: string, varName: string, environment?: string): string | undefined;
    getAllEnv(projectName: string, environment?: string): Record<string, string>;
    listEnvNames(projectName: string, environment?: string): EnvVar[];
    deleteEnv(projectName: string, varName: string, environment?: string): void;
    generateEnvExample(projectName: string, environment?: string): string;
    static sanitizeNotes(notes?: string): string | undefined;
    listSanitized(): Project[];
    getSanitized(name: string): Project | undefined;
    private rowToProject;
}
//# sourceMappingURL=projects-store.d.ts.map