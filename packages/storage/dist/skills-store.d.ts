import type Database from 'better-sqlite3';
export type SkillType = 'domain' | 'lifecycle' | 'process' | 'agent' | 'command';
export interface Skill {
    name: string;
    category: string;
    description: string;
    content: string;
    type: SkillType;
    tags: string[];
    lines: number;
    updatedAt: string;
    status?: 'active' | 'pending' | 'deprecated';
    createdByUserId?: string;
    updatedByUserId?: string;
}
export interface SkillVersion {
    id: string;
    skillName: string;
    versionNumber: number;
    content: string;
    description: string;
    category: string;
    tags: string[];
    changedBy: string | null;
    changeReason: string;
    createdAt: string;
}
export interface SkillUpsertOptions {
    changedBy?: string;
    reason?: string;
    expectedUpdatedAt?: string;
}
export declare class ConcurrencyError extends Error {
    constructor(message: string);
}
export interface SkillSearchResult {
    skill: Skill;
    rank: number;
}
export type SkillUsageAction = 'routed' | 'loaded' | 'applied' | 'dismissed';
export interface SkillUsageContext {
    sessionId?: string;
    project?: string;
    task?: string;
    userId?: string;
}
export interface SkillUsageRow {
    skillName: string;
    count: number;
}
export declare class SkillsStore {
    private db;
    private static _telemetryWarned;
    private static _telemetryFailures;
    private stmts;
    private recentInserts;
    constructor(db: Database.Database);
    static get telemetryFailures(): number;
    private prepareStatements;
    upsert(skill: Skill, options?: SkillUpsertOptions): void;
    upsertBatch(skills: Skill[], options?: SkillUpsertOptions): void;
    private saveVersion;
    listVersions(skillName: string): SkillVersion[];
    getVersion(versionId: string): SkillVersion | null;
    rollback(skillName: string, versionId: string, changedBy: string): Skill;
    get(name: string): Skill | undefined;
    list(type?: SkillType, category?: string): Skill[];
    search(query: string, limit?: number): SkillSearchResult[];
    route(taskDescription: string, limit?: number, activeSkills?: string[], project?: string): Skill[];
    stats(): {
        total: any;
        byType: any;
        byCategory: any;
    };
    recordUsage(name: string, action: SkillUsageAction, ctx?: SkillUsageContext): void;
    topRouted(sinceHours?: number, limit?: number): SkillUsageRow[];
    topLoaded(sinceHours?: number, limit?: number): SkillUsageRow[];
    topApplied(sinceHours?: number, limit?: number): SkillUsageRow[];
    deadSkills(sinceDays?: number, limit?: number): SkillUsageRow[];
    totalUsageSince(sinceHours?: number): number;
    lastUsedMap(): Map<string, string>;
    lastLoadedSkill(sessionId: string): string | null;
    markUseful(skillName: string, sessionId: string): void;
    applyDecay(usefulSkills?: string[]): {
        reinforced: number;
        decayed: number;
        deprecated: number;
    };
    gcDeadSkills(opts: {
        threshold: number;
        days: number;
        dryRun: boolean;
    }): {
        deprecated: string[];
        scanned: number;
    };
    recordCooccurrence(skillA: string, skillB: string): void;
    buildCooccurrences(): number;
    topCooccurrences(limit?: number): {
        skillA: string;
        skillB: string;
        count: number;
    }[];
    confidenceStats(): {
        growing: {
            name: string;
            confidence: number;
        }[];
        declining: {
            name: string;
            confidence: number;
            sessionsStale: number;
        }[];
        usefulRate: {
            name: string;
            usefulCount: number;
            usageCount: number;
            rate: number;
        }[];
    };
    atRiskSkills(limit?: number): {
        name: string;
        confidence: number;
        sessionsStale: number;
        category: string;
    }[];
    private getCooccurrenceCount;
    private rowToSkill;
    private rowToVersion;
}
export declare function withSkillsStore<T>(repoPath: string, fn: (store: SkillsStore) => T): T;
//# sourceMappingURL=skills-store.d.ts.map