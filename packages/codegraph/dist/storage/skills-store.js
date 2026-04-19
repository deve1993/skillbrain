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
        INSERT OR REPLACE INTO skills (name, category, description, content, type, tags, lines, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
            get: this.db.prepare('SELECT * FROM skills WHERE name = ?'),
            listAll: this.db.prepare('SELECT name, category, description, type, tags, lines FROM skills ORDER BY category, name'),
            listByType: this.db.prepare('SELECT name, category, description, type, tags, lines FROM skills WHERE type = ? ORDER BY category, name'),
            listByCategory: this.db.prepare('SELECT name, category, description, type, tags, lines FROM skills WHERE category = ? ORDER BY name'),
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
    upsert(skill) {
        this.stmts.upsert.run(skill.name, skill.category, skill.description, skill.content, skill.type, JSON.stringify(skill.tags), skill.lines, skill.updatedAt);
        // Populate FTS
        try {
            this.db.prepare(`
        INSERT OR REPLACE INTO skills_fts(rowid, name, description, content, tags)
        VALUES ((SELECT rowid FROM skills WHERE name = ?), ?, ?, ?, ?)
      `).run(skill.name, skill.name, skill.description, skill.content, skill.tags.join(' '));
        }
        catch { /* FTS can fail silently */ }
    }
    upsertBatch(skills) {
        const tx = this.db.transaction((items) => {
            for (const s of items)
                this.upsert(s);
        });
        tx(skills);
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
        };
    }
}
//# sourceMappingURL=skills-store.js.map