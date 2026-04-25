import type Database from 'better-sqlite3';
export interface AuditEntry {
    entityType: 'memory' | 'skill' | 'component' | 'proposal' | 'design_scan' | 'user_env';
    entityId: string;
    action: 'approve' | 'reject' | 'generate' | 'apply' | 'dismiss' | 'rollback' | 'reveal' | 'create' | 'update' | 'delete' | 'import' | 'export';
    reviewedBy: string;
    notes?: string;
    metadata?: Record<string, unknown>;
}
export interface AuditRecord extends AuditEntry {
    id: string;
    createdAt: string;
}
export declare class AuditStore {
    private db;
    constructor(db: Database.Database);
    log(entry: AuditEntry): void;
    listForEntity(entityType: string, entityId: string): AuditRecord[];
    listByReviewer(userId: string, limit?: number): AuditRecord[];
    private rowToRecord;
}
//# sourceMappingURL=audit-store.d.ts.map