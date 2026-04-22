import { randomId } from '../utils/hash.js';
// ── Store ──────────────────────────────────────────────
export class ComponentsStore {
    db;
    constructor(db) {
        this.db = db;
    }
    // ── UI Components CRUD ────────────────────────────
    addComponent(input) {
        const now = new Date().toISOString();
        const id = `UC-${randomId()}`;
        const component = {
            id,
            project: input.project,
            name: input.name,
            sectionType: input.sectionType,
            description: input.description,
            filePath: input.filePath,
            tags: input.tags ?? [],
            propsSchema: input.propsSchema ?? {},
            codeSnippet: input.codeSnippet,
            designTokens: input.designTokens ?? {},
            createdAt: now,
            updatedAt: now,
        };
        this.db.prepare(`
      INSERT INTO ui_components
        (id, project, name, section_type, description, file_path, tags, props_schema, code_snippet, design_tokens, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(component.id, component.project, component.name, component.sectionType, component.description ?? null, component.filePath ?? null, JSON.stringify(component.tags), JSON.stringify(component.propsSchema), component.codeSnippet ?? null, JSON.stringify(component.designTokens), component.createdAt, component.updatedAt);
        this.populateFts(component);
        return component;
    }
    getComponent(id) {
        const row = this.db.prepare('SELECT * FROM ui_components WHERE id = ?').get(id);
        return row ? this.rowToComponent(row) : undefined;
    }
    listComponents(filters = {}) {
        let sql = 'SELECT * FROM ui_components WHERE 1=1';
        const params = [];
        if (filters.project) {
            sql += ' AND project = ?';
            params.push(filters.project);
        }
        if (filters.sectionType) {
            sql += ' AND section_type = ?';
            params.push(filters.sectionType);
        }
        if (filters.tag) {
            sql += ' AND tags LIKE ?';
            params.push(`%"${filters.tag}"%`);
        }
        sql += ' ORDER BY project, section_type, name';
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }
        return this.db.prepare(sql).all(...params).map(this.rowToComponent);
    }
    searchComponents(query, limit = 20) {
        const tokens = query
            .replace(/[_-]/g, ' ')
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 1);
        if (tokens.length === 0)
            return [];
        const ftsQuery = tokens.map((w) => `"${w}"`).join(' OR ');
        try {
            const rows = this.db.prepare(`
        SELECT uc.*, fts.rank
        FROM ui_components_fts fts
        JOIN ui_components uc ON uc.rowid = fts.rowid
        WHERE ui_components_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `).all(ftsQuery, limit);
            return rows.map((r) => ({
                component: this.rowToComponent(r),
                rank: r.rank,
            }));
        }
        catch {
            return [];
        }
    }
    deleteComponent(id) {
        this.db.prepare('DELETE FROM ui_components WHERE id = ?').run(id);
    }
    componentStats() {
        const total = this.db.prepare('SELECT COUNT(*) as c FROM ui_components').get().c;
        const byProject = this.db.prepare('SELECT project, COUNT(*) as c FROM ui_components GROUP BY project').all()
            .reduce((acc, r) => ({ ...acc, [r.project]: r.c }), {});
        const bySectionType = this.db.prepare('SELECT section_type, COUNT(*) as c FROM ui_components GROUP BY section_type').all()
            .reduce((acc, r) => ({ ...acc, [r.section_type]: r.c }), {});
        return { total, byProject, bySectionType };
    }
    // ── Design Systems CRUD ───────────────────────────
    upsertDesignSystem(input) {
        const now = new Date().toISOString();
        const existing = this.getDesignSystem(input.project);
        if (existing) {
            const updated = {
                ...existing,
                clientName: input.clientName ?? existing.clientName,
                colors: input.colors ?? existing.colors,
                fonts: input.fonts ?? existing.fonts,
                spacing: input.spacing ?? existing.spacing,
                radius: input.radius ?? existing.radius,
                animations: input.animations ?? existing.animations,
                darkMode: input.darkMode ?? existing.darkMode,
                colorFormat: input.colorFormat ?? existing.colorFormat,
                tailwindConfig: input.tailwindConfig ?? existing.tailwindConfig,
                notes: input.notes ?? existing.notes,
                updatedAt: now,
            };
            this.db.prepare(`
        UPDATE design_systems SET
          client_name = ?, colors = ?, fonts = ?, spacing = ?, radius = ?,
          animations = ?, dark_mode = ?, color_format = ?, tailwind_config = ?,
          notes = ?, updated_at = ?
        WHERE project = ?
      `).run(updated.clientName ?? null, JSON.stringify(updated.colors), JSON.stringify(updated.fonts), JSON.stringify(updated.spacing), JSON.stringify(updated.radius), JSON.stringify(updated.animations), updated.darkMode ? 1 : 0, updated.colorFormat, updated.tailwindConfig ?? null, updated.notes ?? null, updated.updatedAt, updated.project);
            return updated;
        }
        const ds = {
            id: `DS-${input.project}`,
            project: input.project,
            clientName: input.clientName,
            colors: input.colors ?? {},
            fonts: input.fonts ?? {},
            spacing: input.spacing ?? {},
            radius: input.radius ?? {},
            animations: input.animations ?? [],
            darkMode: input.darkMode ?? false,
            colorFormat: input.colorFormat ?? 'hex',
            tailwindConfig: input.tailwindConfig,
            notes: input.notes,
            createdAt: now,
            updatedAt: now,
        };
        this.db.prepare(`
      INSERT INTO design_systems
        (id, project, client_name, colors, fonts, spacing, radius, animations, dark_mode, color_format, tailwind_config, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ds.id, ds.project, ds.clientName ?? null, JSON.stringify(ds.colors), JSON.stringify(ds.fonts), JSON.stringify(ds.spacing), JSON.stringify(ds.radius), JSON.stringify(ds.animations), ds.darkMode ? 1 : 0, ds.colorFormat, ds.tailwindConfig ?? null, ds.notes ?? null, ds.createdAt, ds.updatedAt);
        return ds;
    }
    getDesignSystem(project) {
        const row = this.db.prepare('SELECT * FROM design_systems WHERE project = ?').get(project);
        return row ? this.rowToDesignSystem(row) : undefined;
    }
    listDesignSystems() {
        return this.db.prepare('SELECT * FROM design_systems ORDER BY project').all()
            .map(this.rowToDesignSystem);
    }
    // ── Design System Scans ───────────────────────────
    addDesignSystemScan(scan) {
        const now = new Date().toISOString();
        const id = `DSS-${randomId()}`;
        this.db.prepare(`
      INSERT INTO design_system_scans (id, project, scanned_at, sources, merged, conflicts, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(id, scan.project, now, JSON.stringify(scan.sources), JSON.stringify(scan.merged), JSON.stringify(scan.conflicts));
        return { id, scannedAt: now, status: 'pending', ...scan };
    }
    getPendingScans(project) {
        const sql = project
            ? `SELECT * FROM design_system_scans WHERE status = 'pending' AND project = ? ORDER BY scanned_at DESC`
            : `SELECT * FROM design_system_scans WHERE status = 'pending' ORDER BY scanned_at DESC`;
        const rows = project
            ? this.db.prepare(sql).all(project)
            : this.db.prepare(sql).all();
        return rows.map(this.rowToScan);
    }
    applyDesignSystemScan(scanId, resolved) {
        const row = this.db.prepare('SELECT * FROM design_system_scans WHERE id = ?').get(scanId);
        if (!row)
            throw new Error(`Scan ${scanId} not found`);
        const ds = this.upsertDesignSystem({ project: row.project, ...resolved });
        this.db.prepare(`UPDATE design_system_scans SET status = 'applied' WHERE id = ?`).run(scanId);
        return ds;
    }
    dismissDesignSystemScan(scanId) {
        this.db.prepare(`UPDATE design_system_scans SET status = 'dismissed' WHERE id = ?`).run(scanId);
    }
    mergeDesignSystems(primary, alias) {
        const pri = this.getDesignSystem(primary);
        const ali = this.getDesignSystem(alias);
        if (!pri)
            throw new Error(`Primary design system '${primary}' not found`);
        if (!ali)
            throw new Error(`Alias design system '${alias}' not found`);
        // Merge tokens: alias provides base, primary overrides (primary wins on conflict)
        const merged = {
            project: primary,
            clientName: pri.clientName ?? ali.clientName,
            colors: { ...ali.colors, ...pri.colors },
            fonts: { ...ali.fonts, ...pri.fonts },
            spacing: { ...ali.spacing, ...pri.spacing },
            radius: { ...ali.radius, ...pri.radius },
            animations: pri.animations.length ? pri.animations : ali.animations,
            darkMode: pri.darkMode || ali.darkMode,
            colorFormat: pri.colorFormat,
            tailwindConfig: pri.tailwindConfig ?? ali.tailwindConfig,
            notes: [pri.notes, ali.notes].filter(Boolean).join('\n\n') || undefined,
        };
        const result = this.upsertDesignSystem(merged);
        this.db.prepare('DELETE FROM design_systems WHERE project = ?').run(alias);
        return result;
    }
    rowToScan(row) {
        return {
            id: row.id,
            project: row.project,
            scannedAt: row.scanned_at,
            sources: JSON.parse(row.sources || '[]'),
            merged: JSON.parse(row.merged || '{}'),
            conflicts: JSON.parse(row.conflicts || '[]'),
            status: row.status,
        };
    }
    // ── FTS Population ────────────────────────────────
    populateFts(component) {
        try {
            this.db.prepare(`
        INSERT OR REPLACE INTO ui_components_fts(rowid, name, description, tags, section_type)
        VALUES ((SELECT rowid FROM ui_components WHERE id = ?), ?, ?, ?, ?)
      `).run(component.id, component.name, component.description ?? '', component.tags.join(' '), component.sectionType);
        }
        catch { }
    }
    // ── Row Mappers ───────────────────────────────────
    rowToComponent(row) {
        return {
            id: row.id,
            project: row.project,
            name: row.name,
            sectionType: row.section_type,
            description: row.description ?? undefined,
            filePath: row.file_path ?? undefined,
            tags: JSON.parse(row.tags || '[]'),
            propsSchema: JSON.parse(row.props_schema || '{}'),
            codeSnippet: row.code_snippet ?? undefined,
            designTokens: JSON.parse(row.design_tokens || '{}'),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    rowToDesignSystem(row) {
        return {
            id: row.id,
            project: row.project,
            clientName: row.client_name ?? undefined,
            colors: JSON.parse(row.colors || '{}'),
            fonts: JSON.parse(row.fonts || '{}'),
            spacing: JSON.parse(row.spacing || '{}'),
            radius: JSON.parse(row.radius || '{}'),
            animations: JSON.parse(row.animations || '[]'),
            darkMode: row.dark_mode === 1,
            colorFormat: row.color_format,
            tailwindConfig: row.tailwind_config ?? undefined,
            notes: row.notes ?? undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
//# sourceMappingURL=components-store.js.map