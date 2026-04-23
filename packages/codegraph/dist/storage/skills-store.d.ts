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
export declare class SkillsStore {
    private db;
    private stmts;
    constructor(db: Database.Database);
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
    route(taskDescription: string, limit?: number): Skill[];
    stats(): {
        total: any;
        byType: any;
        byCategory: any;
    };
    private rowToSkill;
    private rowToVersion;
}
export declare function withSkillsStore<T>(repoPath: string, fn: (store: SkillsStore) => T): T;
//# sourceMappingURL=skills-store.d.ts.map