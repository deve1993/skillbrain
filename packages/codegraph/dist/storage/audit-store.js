export class AuditStore {
    db;
    constructor(db) {
        this.db = db;
    }
    log(entry) {
        try {
            const id = `AU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            this.db.prepare(`
        INSERT INTO review_audit (id, entity_type, entity_id, action, reviewed_by, notes, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, entry.entityType, entry.entityId, entry.action, entry.reviewedBy, entry.notes ?? null, JSON.stringify(entry.metadata ?? {}));
        }
        catch { /* review_audit table may not exist yet */ }
    }
    listForEntity(entityType, entityId) {
        try {
            const rows = this.db.prepare(`
        SELECT * FROM review_audit WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC
      `).all(entityType, entityId);
            return rows.map(this.rowToRecord);
        }
        catch {
            return [];
        }
    }
    listByReviewer(userId, limit = 50) {
        try {
            const rows = this.db.prepare(`
        SELECT * FROM review_audit WHERE reviewed_by = ? ORDER BY created_at DESC LIMIT ?
      `).all(userId, limit);
            return rows.map(this.rowToRecord);
        }
        catch {
            return [];
        }
    }
    rowToRecord(row) {
        return {
            id: row.id,
            entityType: row.entity_type,
            entityId: row.entity_id,
            action: row.action,
            reviewedBy: row.reviewed_by,
            notes: row.notes ?? undefined,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            createdAt: row.created_at,
        };
    }
}
//# sourceMappingURL=audit-store.js.map