import type Database from 'better-sqlite3';
export type SessionStatus = 'in-progress' | 'completed' | 'paused' | 'blocked';
export type WorkType = 'feature' | 'fix' | 'setup' | 'deploy' | 'refactor' | 'design' | 'docs' | 'other';
export interface SessionLog {
    id: string;
    sessionName: string;
    startedAt: string;
    endedAt?: string;
    summary?: string;
    memoriesCreated: number;
    memoriesValidated: number;
    filesChanged: string[];
    project?: string;
    workspacePath?: string;
    taskDescription?: string;
    status: SessionStatus;
    nextSteps?: string;
    blockers?: string;
    commits: string[];
    branch?: string;
    workType?: WorkType;
    deliverables?: string;
}
export interface Notification {
    id: string;
    channel: string;
    eventType: string;
    payload?: string;
    sentAt: string;
    success: boolean;
    error?: string;
    consecutiveFailures: number;
}
export type MemoryType = 'Fact' | 'Preference' | 'Decision' | 'Pattern' | 'AntiPattern' | 'BugFix' | 'Goal' | 'Todo';
export type MemoryEdgeType = 'RelatedTo' | 'Updates' | 'Contradicts' | 'CausedBy' | 'PartOf';
export type MemoryStatus = 'active' | 'pending-review' | 'deprecated';
export type MemoryScope = 'global' | 'project-specific';
export interface Memory {
    id: string;
    type: MemoryType;
    status: MemoryStatus;
    scope: MemoryScope;
    project?: string;
    skill?: string;
    context: string;
    problem: string;
    solution: string;
    reason: string;
    confidence: number;
    importance: number;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    lastValidated?: string;
    sessionsSinceValidation: number;
    validatedBy: string[];
    validUntilVersion?: string;
    sourceFile?: string;
    sourceSession?: string;
    migratedFrom?: string;
}
export interface MemoryEdge {
    id: string;
    sourceId: string;
    targetId: string;
    type: MemoryEdgeType;
    reason?: string;
    createdAt: string;
}
export interface MemoryInput {
    type: MemoryType;
    scope?: MemoryScope;
    project?: string;
    skill?: string;
    context: string;
    problem: string;
    solution: string;
    reason: string;
    confidence?: number;
    importance?: number;
    tags: string[];
    sourceFile?: string;
    sourceSession?: string;
    migratedFrom?: string;
}
export interface MemoryQuery {
    type?: MemoryType | MemoryType[];
    status?: MemoryStatus;
    scope?: MemoryScope;
    project?: string;
    skill?: string;
    minConfidence?: number;
    tags?: string[];
    limit?: number;
}
export interface MemorySearchResult {
    memory: Memory;
    rank: number;
    edges: MemoryEdge[];
}
export interface DecayResult {
    reinforced: number;
    decayed: number;
    pendingReview: number;
    deprecated: number;
}
export declare class MemoryStore {
    private db;
    private stmts;
    constructor(db: Database.Database);
    private prepareStatements;
    add(input: MemoryInput): Memory;
    addEdge(sourceId: string, targetId: string, type: MemoryEdgeType, reason?: string): MemoryEdge;
    get(id: string): Memory | undefined;
    delete(id: string): void;
    query(q: MemoryQuery): Memory[];
    search(query: string, limit?: number): MemorySearchResult[];
    getEdges(memoryId: string): MemoryEdge[];
    getContradictions(): {
        id1: string;
        ctx1: string;
        id2: string;
        ctx2: string;
        reason?: string;
    }[];
    scored(project?: string, activeSkills?: string[], limit?: number): MemorySearchResult[];
    applyDecay(validatedIds: string[], sessionDate: string): DecayResult;
    detectContradictions(memory: Memory): Memory[];
    stats(): {
        total: number;
        byType: any;
        byStatus: any;
        edges: any;
    };
    private populateFts;
    private rowToMemory;
    private rowToEdge;
    startSession(sessionName: string, project?: string, workspacePath?: string, taskDescription?: string, branch?: string): SessionLog;
    endSession(id: string, summary: string, memoriesCreated: number, memoriesValidated: number, filesChanged: string[], nextSteps?: string, blockers?: string, commits?: string[], status?: SessionStatus, workType?: WorkType, deliverables?: string): void;
    recentSessions(limit?: number): SessionLog[];
    projectSessions(project: string, limit?: number): SessionLog[];
    lastProjectSession(project: string): SessionLog | undefined;
    pendingSessions(): SessionLog[];
    listProjects(): {
        name: string;
        lastSession: any;
        totalSessions: number;
        totalMemories: number;
        memoriesByType: Record<string, number>;
        lastBranch?: string;
        blockers?: string;
    }[];
    projectDetail(project: string): {
        name: string;
        sessions: SessionLog[];
        memories: any[];
        stats: any;
    };
    autoDecayIfDue(): {
        ran: boolean;
        reinforced?: number;
        decayed?: number;
        deprecated?: number;
    };
    heartbeat(id: string): void;
    /**
     * Auto-close sessions with no heartbeat for >staleMinutes.
     * Generates smart summary + auto-detects workType/deliverables from git commits.
     */
    autoCloseStale(staleMinutes?: number): number;
    /**
     * Detect workType and deliverables from git commits in the workspace
     * made after the session started.
     */
    private detectWorkFromGit;
    private mapCommitPrefixToWorkType;
    /**
     * Generate a smart summary for a session from its activity:
     * memories created during the session window + any recorded files/commits.
     */
    private generateSessionSummary;
    deleteSession(id: string): void;
    updateSession(id: string, fields: Partial<SessionLog>): void;
    updateMemory(id: string, fields: {
        confidence?: number;
        status?: MemoryStatus;
        context?: string;
        problem?: string;
        solution?: string;
        reason?: string;
        tags?: string[];
    }): void;
    workLog(): Record<string, {
        entries: any[];
        totalEntries: number;
    }>;
    private rowToSession;
    logNotification(channel: string, eventType: string, success: boolean, payload?: string, error?: string): void;
    isChannelCircuitBroken(channel: string): boolean;
}
//# sourceMappingURL=memory-store.d.ts.map