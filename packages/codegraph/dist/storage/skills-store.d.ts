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
    upsert(skill: Skill): void;
    upsertBatch(skills: Skill[]): void;
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
}
//# sourceMappingURL=skills-store.d.ts.map