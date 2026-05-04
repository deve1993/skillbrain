interface ParsedLearning {
    id: string;
    date: string;
    type: string;
    status: string;
    project: string;
    scope: string;
    tags: string[];
    confidence: number;
    context: string;
    problem: string;
    solution: string;
    reason: string;
    validatedBy: string[];
    createdIn: string;
    supersedes?: string;
    supersededBy?: string;
    reinforces: string[];
    contradicts: string[];
    lastValidated?: string;
    sessionsSinceValidation: number;
    sourceFile: string;
    skill: string;
}
export declare function parseLearningsFile(content: string, filePath: string): ParsedLearning[];
export declare function migrate(workspacePath: string): {
    migrated: number;
    skipped: number;
    edges: number;
};
export {};
//# sourceMappingURL=migrate-learnings.d.ts.map