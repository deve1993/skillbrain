import { openDb, closeDb } from './db.js';
export class ConcurrencyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConcurrencyError';
    }
}
export class SkillsStore {
    db;
    stmts;
    constructor(db) {
        this.db = db;
        this.stmts = this.prepareStatements();
    }
    prepareStatements() {
        return {
            upsert: this.db.prepare(`
        INSERT OR REPLACE INTO skills (name, category, description, content, type, tags, lines, updated_at, status, created_by_user_id, updated_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_by_user_id FROM skills WHERE name = ?), ?), ?)
      `),
            get: this.db.prepare('SELECT * FROM skills WHERE name = ?'),
            getUpdatedAt: this.db.prepare('SELECT updated_at FROM skills WHERE name = ?'),
            listAll: this.db.prepare("SELECT name, category, description, type, tags, lines, status, updated_at, created_by_user_id FROM skills WHERE status = 'active' ORDER BY category, name"),
            listByType: this.db.prepare("SELECT name, category, description, type, tags, lines, status, updated_at, created_by_user_id FROM skills WHERE type = ? AND status = 'active' ORDER BY category, name"),
            listByCategory: this.db.prepare("SELECT name, category, description, type, tags, lines, status, updated_at, created_by_user_id FROM skills WHERE category = ? AND status = 'active' ORDER BY name"),
            searchFts: this.db.prepare(`
        SELECT s.*, fts.rank
        FROM skills_fts fts
        JOIN skills s ON s.rowid = fts.rowid
        WHERE skills_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `),
            countByType: this.db.prepare('SELECT type, COUNT(*) as count FROM skills GROUP BY type'),
            countByCategory: this.db.prepare('SELECT category, COUNT(*) as count FROM skills GROUP BY category ORDER BY count DESC'),
            total: this.db.prepare('SELECT COUNT(*) as count FROM skills'),
            deleteAll: this.db.prepare('DELETE FROM skills'),
        };
    }
    upsert(skill, options = {}) {
        const { changedBy, reason = 'manual', expectedUpdatedAt } = options;
        if (expectedUpdatedAt) {
            const row = this.stmts.getUpdatedAt.get(skill.name);
            if (row && row.updated_at !== expectedUpdatedAt) {
                throw new ConcurrencyError('Skill modificata da altro utente, ricarica e riprova');
            }
        }
        this.stmts.upsert.run(skill.name, skill.category, skill.description, skill.content, skill.type, JSON.stringify(skill.tags), skill.lines, skill.updatedAt, skill.status ?? 'active', skill.name, skill.createdByUserId ?? null, changedBy ?? null);
        this.saveVersion(skill, changedBy ?? null, reason);
        // Populate FTS
        try {
            this.db.prepare(`
        INSERT OR REPLACE INTO skills_fts(rowid, name, description, content, tags)
        VALUES ((SELECT rowid FROM skills WHERE name = ?), ?, ?, ?, ?)
      `).run(skill.name, skill.name, skill.description, skill.content, skill.tags.join(' '));
        }
        catch { /* FTS can fail silently */ }
    }
    upsertBatch(skills, options = {}) {
        const tx = this.db.transaction((items) => {
            for (const s of items)
                this.upsert(s, options);
        });
        tx(skills);
    }
    saveVersion(skill, changedBy, reason) {
        try {
            const maxRow = this.db.prepare(`SELECT MAX(version_number) as max FROM skill_versions WHERE skill_name = ?`).get(skill.name);
            const nextVersion = (maxRow?.max ?? 0) + 1;
            const id = `SV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            this.db.prepare(`
        INSERT INTO skill_versions (id, skill_name, version_number, content, description, category, tags, changed_by, change_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, skill.name, nextVersion, skill.content, skill.description, skill.category, JSON.stringify(skill.tags ?? []), changedBy, reason);
        }
        catch { /* skill_versions table may not exist yet */ }
    }
    listVersions(skillName) {
        try {
            const rows = this.db.prepare(`SELECT * FROM skill_versions WHERE skill_name = ? ORDER BY version_number DESC`).all(skillName);
            return rows.map(this.rowToVersion);
        }
        catch {
            return [];
        }
    }
    getVersion(versionId) {
        try {
            const row = this.db.prepare(`SELECT * FROM skill_versions WHERE id = ?`).get(versionId);
            return row ? this.rowToVersion(row) : null;
        }
        catch {
            return null;
        }
    }
    rollback(skillName, versionId, changedBy) {
        const version = this.getVersion(versionId);
        if (!version)
            throw new Error(`Version ${versionId} not found`);
        const existing = this.get(skillName);
        if (!existing)
            throw new Error(`Skill ${skillName} not found`);
        const now = new Date().toISOString();
        const rolledBack = {
            ...existing,
            content: version.content,
            description: version.description || existing.description,
            category: version.category || existing.category,
            tags: version.tags.length ? version.tags : existing.tags,
            lines: version.content.split('\n').length,
            updatedAt: now,
            updatedByUserId: changedBy,
        };
        this.upsert(rolledBack, { changedBy, reason: 'rollback' });
        return rolledBack;
    }
    get(name) {
        const row = this.stmts.get.get(name);
        return row ? this.rowToSkill(row) : undefined;
    }
    list(type, category) {
        let rows;
        if (category) {
            rows = this.stmts.listByCategory.all(category);
        }
        else if (type) {
            rows = this.stmts.listByType.all(type);
        }
        else {
            rows = this.stmts.listAll.all();
        }
        return rows.map(this.rowToSkill);
    }
    search(query, limit = 10) {
        const tokens = query
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]/g, ' ')
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 1);
        const ftsQuery = tokens.map((w) => `"${w}"`).join(' OR ');
        try {
            const rows = this.stmts.searchFts.all(ftsQuery, limit);
            return rows.map((r) => ({ skill: this.rowToSkill(r), rank: r.rank }));
        }
        catch {
            return [];
        }
    }
    route(taskDescription, limit = 5) {
        const results = this.search(taskDescription, limit);
        return results.map((r) => r.skill);
    }
    stats() {
        const total = this.stmts.total.get().count;
        const byType = this.stmts.countByType.all()
            .reduce((acc, r) => ({ ...acc, [r.type]: r.count }), {});
        const byCategory = this.stmts.countByCategory.all()
            .reduce((acc, r) => ({ ...acc, [r.category]: r.count }), {});
        return { total, byType, byCategory };
    }
    rowToSkill(row) {
        return {
            name: row.name,
            category: row.category,
            description: row.description,
            content: row.content ?? '',
            type: row.type,
            tags: JSON.parse(row.tags || '[]'),
            lines: row.lines,
            updatedAt: row.updated_at,
            status: row.status ?? 'active',
            createdByUserId: row.created_by_user_id ?? undefined,
            updatedByUserId: row.updated_by_user_id ?? undefined,
        };
    }
    rowToVersion(row) {
        return {
            id: row.id,
            skillName: row.skill_name,
            versionNumber: row.version_number,
            content: row.content,
            description: row.description ?? '',
            category: row.category ?? '',
            tags: JSON.parse(row.tags || '[]'),
            changedBy: row.changed_by ?? null,
            changeReason: row.change_reason ?? 'manual',
            createdAt: row.created_at,
        };
    }
}
export function withSkillsStore(repoPath, fn) {
    const db = openDb(repoPath);
    const store = new SkillsStore(db);
    try {
        return fn(store);
    }
    finally {
        closeDb(db);
    }
}
//# sourceMappingURL=skills-store.js.map