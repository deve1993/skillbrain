/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */
import { warn } from './utils/logger.js';
export class GraphStore {
    db;
    stmts;
    constructor(db) {
        this.db = db;
        this.stmts = this.prepareStatements();
    }
    prepareStatements() {
        return {
            insertNode: this.db.prepare(`
        INSERT OR REPLACE INTO nodes (id, label, name, file_path, start_line, end_line, is_exported, properties)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
            insertEdge: this.db.prepare(`
        INSERT OR IGNORE INTO edges (id, source_id, target_id, type, confidence, reason, step)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
            insertFile: this.db.prepare(`
        INSERT OR REPLACE INTO files (path, content_hash, indexed_at, symbol_count)
        VALUES (?, ?, ?, ?)
      `),
            getNode: this.db.prepare('SELECT * FROM nodes WHERE id = ?'),
            getNodeByName: this.db.prepare('SELECT * FROM nodes WHERE name = ? AND label != ?'),
            getNodesByFile: this.db.prepare('SELECT * FROM nodes WHERE file_path = ?'),
            getNodesByLabel: this.db.prepare('SELECT * FROM nodes WHERE label = ?'),
            getEdgesFrom: this.db.prepare('SELECT * FROM edges WHERE source_id = ?'),
            getEdgesTo: this.db.prepare('SELECT * FROM edges WHERE target_id = ?'),
            getEdgesByType: this.db.prepare('SELECT * FROM edges WHERE type = ?'),
            getFile: this.db.prepare('SELECT * FROM files WHERE path = ?'),
            getAllFiles: this.db.prepare('SELECT * FROM files'),
            deleteNodesByFile: this.db.prepare('DELETE FROM nodes WHERE file_path = ?'),
            deleteFileRecord: this.db.prepare('DELETE FROM files WHERE path = ?'),
            countNodes: this.db.prepare('SELECT COUNT(*) as count FROM nodes'),
            countEdges: this.db.prepare('SELECT COUNT(*) as count FROM edges'),
            countFiles: this.db.prepare('SELECT COUNT(*) as count FROM files'),
            countByLabel: this.db.prepare('SELECT COUNT(*) as count FROM nodes WHERE label = ?'),
            searchFts: this.db.prepare(`
        SELECT n.*, fts.rank
        FROM nodes_fts fts
        JOIN nodes n ON n.rowid = fts.rowid
        WHERE nodes_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `),
            getCallers: this.db.prepare(`
        SELECT n.* FROM nodes n
        JOIN edges e ON e.source_id = n.id
        WHERE e.target_id = ? AND e.type = 'CALLS'
      `),
            getCallees: this.db.prepare(`
        SELECT n.* FROM nodes n
        JOIN edges e ON e.target_id = n.id
        WHERE e.source_id = ? AND e.type = 'CALLS'
      `),
            getProcesses: this.db.prepare(`
        SELECT DISTINCT p.* FROM nodes p
        JOIN edges e ON e.target_id = p.id
        WHERE e.source_id = ? AND e.type = 'STEP_IN_PROCESS'
      `),
            getProcessSteps: this.db.prepare(`
        SELECT n.*, e.step FROM nodes n
        JOIN edges e ON e.source_id = n.id
        WHERE e.target_id = ? AND e.type = 'STEP_IN_PROCESS'
        ORDER BY e.step
      `),
            getCommunityMembers: this.db.prepare(`
        SELECT n.* FROM nodes n
        JOIN edges e ON e.source_id = n.id
        WHERE e.target_id = ? AND e.type = 'MEMBER_OF'
      `),
        };
    }
    addNode(node) {
        this.stmts.insertNode.run(node.id, node.label, node.name, node.filePath ?? null, node.startLine ?? null, node.endLine ?? null, node.isExported ? 1 : 0, node.properties ? JSON.stringify(node.properties) : null);
    }
    addEdge(edge) {
        this.stmts.insertEdge.run(edge.id, edge.sourceId, edge.targetId, edge.type, edge.confidence, edge.reason ?? null, edge.step ?? null);
    }
    addFile(file) {
        this.stmts.insertFile.run(file.path, file.contentHash, file.indexedAt, file.symbolCount);
    }
    addNodesBatch(nodes) {
        const insertFts = this.db.prepare(`
      INSERT OR REPLACE INTO nodes_fts(rowid, name, file_path, search_text)
      VALUES ((SELECT rowid FROM nodes WHERE id = ?), ?, ?, ?)
    `);
        const tx = this.db.transaction((items) => {
            for (const n of items) {
                this.addNode(n);
                // Populate FTS with expanded camelCase tokens
                const searchText = expandForSearch(n.name, n.filePath);
                try {
                    insertFts.run(n.id, n.name, n.filePath ?? null, searchText);
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    warn(`FTS insert failed for node "${n.name}" (${n.id}): ${msg}`);
                }
            }
        });
        tx(nodes);
    }
    addEdgesBatch(edges) {
        const tx = this.db.transaction((items) => {
            for (const e of items)
                this.addEdge(e);
        });
        tx(edges);
    }
    getNode(id) {
        const row = this.stmts.getNode.get(id);
        return row ? this.rowToNode(row) : undefined;
    }
    getNodeByName(name) {
        const row = this.stmts.getNodeByName.get(name, 'File');
        return row ? this.rowToNode(row) : undefined;
    }
    getNodesByFile(filePath) {
        return this.stmts.getNodesByFile.all(filePath).map(this.rowToNode);
    }
    getNodesByLabel(label) {
        return this.stmts.getNodesByLabel.all(label).map(this.rowToNode);
    }
    getCallers(nodeId) {
        return this.stmts.getCallers.all(nodeId).map(this.rowToNode);
    }
    getCallees(nodeId) {
        return this.stmts.getCallees.all(nodeId).map(this.rowToNode);
    }
    getProcessesForSymbol(nodeId) {
        const rows = this.stmts.getProcesses.all(nodeId);
        return rows.map((r) => ({ name: r.name, step: 0 }));
    }
    getProcessSteps(processId) {
        return this.stmts.getProcessSteps.all(processId).map((r) => ({
            ...this.rowToNode(r),
            step: r.step,
        }));
    }
    getCommunityMembers(communityId) {
        return this.stmts.getCommunityMembers.all(communityId).map(this.rowToNode);
    }
    getEdgesFrom(nodeId) {
        return this.stmts.getEdgesFrom.all(nodeId).map(this.rowToEdge);
    }
    getEdgesTo(nodeId) {
        return this.stmts.getEdgesTo.all(nodeId).map(this.rowToEdge);
    }
    getFile(filePath) {
        return this.stmts.getFile.get(filePath);
    }
    getAllFiles() {
        return this.stmts.getAllFiles.all();
    }
    deleteByFile(filePath) {
        this.stmts.deleteNodesByFile.run(filePath);
        this.stmts.deleteFileRecord.run(filePath);
    }
    search(query, limit = 10) {
        const expanded = expandSearchTokens(query);
        try {
            const rows = this.stmts.searchFts.all(expanded, limit);
            return rows.map((r) => ({ node: this.rowToNode(r), rank: r.rank }));
        }
        catch {
            return [];
        }
    }
    stats() {
        const nodes = this.stmts.countNodes.get().count;
        const edges = this.stmts.countEdges.get().count;
        const files = this.stmts.countFiles.get().count;
        const communities = this.stmts.countByLabel.get('Community').count;
        const processes = this.stmts.countByLabel.get('Process').count;
        return { nodes, edges, files, communities, processes };
    }
    rawQuery(sql) {
        return this.db.prepare(sql).all();
    }
    exec(sql) {
        this.db.exec(sql);
    }
    rowToNode(row) {
        return {
            id: row.id,
            label: row.label,
            name: row.name,
            filePath: row.file_path ?? undefined,
            startLine: row.start_line ?? undefined,
            endLine: row.end_line ?? undefined,
            isExported: !!row.is_exported,
            properties: row.properties ? JSON.parse(row.properties) : undefined,
        };
    }
    rowToEdge(row) {
        return {
            id: row.id,
            sourceId: row.source_id,
            targetId: row.target_id,
            type: row.type,
            confidence: row.confidence,
            reason: row.reason ?? undefined,
            step: row.step ?? undefined,
        };
    }
}
function expandSearchTokens(query) {
    const words = query
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 1);
    return words.map((w) => `"${w}"`).join(' OR ');
}
function expandForSearch(name, filePath) {
    const parts = [name];
    // camelCase split: CookieConsentBanner → cookie consent banner
    const camelSplit = name
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/[_-]/g, ' ')
        .toLowerCase();
    parts.push(camelSplit);
    // File path parts
    if (filePath) {
        parts.push(filePath);
        const pathParts = filePath
            .replace(/\.[^.]+$/, '')
            .split('/')
            .filter((p) => p.length > 1);
        parts.push(...pathParts);
    }
    return [...new Set(parts)].join(' ');
}
//# sourceMappingURL=graph-store.js.map