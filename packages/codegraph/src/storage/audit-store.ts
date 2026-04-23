import type Database from 'better-sqlite3'

export interface AuditEntry {
  entityType: 'memory' | 'skill' | 'component' | 'proposal' | 'design_scan'
  entityId: string
  action: 'approve' | 'reject' | 'generate' | 'apply' | 'dismiss' | 'rollback'
  reviewedBy: string
  notes?: string
  metadata?: Record<string, unknown>
}

export interface AuditRecord extends AuditEntry {
  id: string
  createdAt: string
}

export class AuditStore {
  constructor(private db: Database.Database) {}

  log(entry: AuditEntry): void {
    try {
      const id = `AU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      this.db.prepare(`
        INSERT INTO review_audit (id, entity_type, entity_id, action, reviewed_by, notes, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        entry.entityType,
        entry.entityId,
        entry.action,
        entry.reviewedBy,
        entry.notes ?? null,
        JSON.stringify(entry.metadata ?? {}),
      )
    } catch { /* review_audit table may not exist yet */ }
  }

  listForEntity(entityType: string, entityId: string): AuditRecord[] {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM review_audit WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC
      `).all(entityType, entityId) as any[]
      return rows.map(this.rowToRecord)
    } catch { return [] }
  }

  listByReviewer(userId: string, limit = 50): AuditRecord[] {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM review_audit WHERE reviewed_by = ? ORDER BY created_at DESC LIMIT ?
      `).all(userId, limit) as any[]
      return rows.map(this.rowToRecord)
    } catch { return [] }
  }

  private rowToRecord(row: any): AuditRecord {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      reviewedBy: row.reviewed_by,
      notes: row.notes ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    }
  }
}
