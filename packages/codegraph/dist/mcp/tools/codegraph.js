import { z } from 'zod';
import { openDb, closeDb } from '../../storage/db.js';
import { GraphStore } from '../../storage/graph-store.js';
import { getRegistryEntry, loadRegistry } from '../../storage/registry.js';
import { analyzeImpact } from '../../core/analysis/impact.js';
import { getSymbolContext } from '../../core/analysis/context.js';
import { detectChanges } from '../../core/analysis/change-detection.js';
import { previewRename, executeRename } from '../../core/analysis/rename.js';
function resolveRepo(nameOrPath) {
    if (nameOrPath) {
        const entry = getRegistryEntry(nameOrPath);
        if (entry)
            return { path: entry.path, name: entry.name };
    }
    const entries = loadRegistry();
    if (entries.length === 1)
        return { path: entries[0].path, name: entries[0].name };
    return null;
}
function withStore(repoPath, fn) {
    const db = openDb(repoPath);
    const store = new GraphStore(db);
    try {
        return fn(store);
    }
    finally {
        closeDb(db);
    }
}
export function registerCodegraphTools(server, _ctx) {
    // --- Tool: list_repos ---
    server.tool('codegraph_list_repos', 'List all indexed repositories', {}, async () => {
        const entries = loadRegistry();
        return {
            content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }],
        };
    });
    // --- Tool: query ---
    server.tool('codegraph_query', 'Search the code graph by concept, symptom, or keyword', {
        query: z.string().describe('Search query (concept, function name, error symptom)'),
        repo: z.string().optional().describe('Repository name or path'),
        limit: z.number().optional().default(10).describe('Max results'),
    }, async ({ query, repo, limit }) => {
        const resolved = resolveRepo(repo);
        if (!resolved)
            return { content: [{ type: 'text', text: 'Repository not found. Run codegraph_list_repos to see available repos.' }] };
        const results = withStore(resolved.path, (store) => store.search(query, limit));
        const formatted = results.map((r) => ({
            name: r.node.name,
            label: r.node.label,
            file: r.node.filePath,
            line: r.node.startLine,
            score: Math.abs(r.rank),
        }));
        return {
            content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
        };
    });
    // --- Tool: context ---
    server.tool('codegraph_context', '360-degree view of a symbol: callers, callees, processes, community', {
        name: z.string().describe('Symbol name to analyze'),
        repo: z.string().optional().describe('Repository name or path'),
    }, async ({ name, repo }) => {
        const resolved = resolveRepo(repo);
        if (!resolved)
            return { content: [{ type: 'text', text: 'Repository not found.' }] };
        const result = withStore(resolved.path, (store) => getSymbolContext(store, name));
        if (!result)
            return { content: [{ type: 'text', text: `Symbol "${name}" not found.` }] };
        const formatted = {
            symbol: { name: result.symbol.name, label: result.symbol.label, file: result.symbol.filePath, line: result.symbol.startLine },
            callers: result.callers.map((c) => ({ name: c.name, file: c.filePath })),
            callees: result.callees.map((c) => ({ name: c.name, file: c.filePath })),
            processes: result.processes,
            community: result.community,
        };
        return {
            content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
        };
    });
    // --- Tool: impact ---
    server.tool('codegraph_impact', 'Blast radius analysis: what breaks if you change this symbol', {
        target: z.string().describe('Symbol name to analyze'),
        direction: z.enum(['upstream', 'downstream', 'both']).optional().default('upstream'),
        maxDepth: z.number().optional().default(3),
        minConfidence: z.number().optional().default(0.5),
        repo: z.string().optional(),
    }, async ({ target, direction, maxDepth, minConfidence, repo }) => {
        const resolved = resolveRepo(repo);
        if (!resolved)
            return { content: [{ type: 'text', text: 'Repository not found.' }] };
        const result = withStore(resolved.path, (store) => analyzeImpact(store, target, direction, maxDepth, minConfidence));
        if (!result)
            return { content: [{ type: 'text', text: `Symbol "${target}" not found.` }] };
        const grouped = {};
        for (const item of result.items) {
            const key = `d=${item.depth}`;
            if (!grouped[key])
                grouped[key] = [];
            grouped[key].push({
                name: item.name,
                label: item.label,
                file: item.filePath,
                confidence: item.confidence,
            });
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        target: result.target,
                        riskLevel: result.riskLevel,
                        totalAffected: result.items.length,
                        affectedProcesses: result.affectedProcesses,
                        byDepth: grouped,
                    }, null, 2),
                }],
        };
    });
    // --- Tool: detect_changes ---
    server.tool('codegraph_detect_changes', 'Map git changes to affected symbols and processes', {
        scope: z.enum(['staged', 'all', 'compare']).optional().default('all'),
        baseRef: z.string().optional().default('main'),
        repo: z.string().optional(),
    }, async ({ scope, baseRef, repo }) => {
        const resolved = resolveRepo(repo);
        if (!resolved)
            return { content: [{ type: 'text', text: 'Repository not found.' }] };
        const result = withStore(resolved.path, (store) => detectChanges(store, resolved.path, scope, baseRef));
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        changedFiles: result.changedFiles.length,
                        affectedSymbols: result.affectedSymbols.map((s) => ({ name: s.name, label: s.label, file: s.filePath })),
                        affectedProcesses: result.affectedProcesses,
                        riskLevel: result.riskLevel,
                    }, null, 2),
                }],
        };
    });
    // --- Tool: rename ---
    server.tool('codegraph_rename', 'Rename a symbol across all files using graph knowledge', {
        symbolName: z.string().describe('Current symbol name'),
        newName: z.string().describe('New symbol name'),
        dryRun: z.boolean().optional().default(true).describe('Preview only (true) or apply (false)'),
        repo: z.string().optional(),
    }, async ({ symbolName, newName, dryRun, repo }) => {
        const resolved = resolveRepo(repo);
        if (!resolved)
            return { content: [{ type: 'text', text: 'Repository not found.' }] };
        const preview = withStore(resolved.path, (store) => previewRename(store, resolved.path, symbolName, newName));
        if (!dryRun) {
            const applied = executeRename(resolved.path, preview, symbolName, newName);
            return {
                content: [{ type: 'text', text: JSON.stringify({ applied, files: preview.changes.length }, null, 2) }],
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        totalEdits: preview.totalEdits,
                        files: preview.changes.map((c) => ({
                            file: c.filePath,
                            edits: c.edits.map((e) => ({
                                line: e.line,
                                old: e.oldText,
                                new: e.newText,
                                confidence: e.confidence,
                                source: e.source,
                            })),
                        })),
                    }, null, 2),
                }],
        };
    });
    // --- Tool: cypher (SQL translation) ---
    server.tool('codegraph_cypher', 'Run a raw SQL query against the graph database', {
        query: z.string().describe('SQL query (tables: nodes, edges, files)'),
        repo: z.string().optional(),
    }, async ({ query: sql, repo }) => {
        const resolved = resolveRepo(repo);
        if (!resolved)
            return { content: [{ type: 'text', text: 'Repository not found.' }] };
        try {
            const results = withStore(resolved.path, (store) => {
                // Enforce read-only mode to prevent DROP/DELETE/UPDATE via user queries
                store.exec('PRAGMA query_only = ON');
                try {
                    return store.rawQuery(sql);
                }
                finally {
                    store.exec('PRAGMA query_only = OFF');
                }
            });
            return {
                content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
            };
        }
        catch (err) {
            return {
                content: [{ type: 'text', text: `Query error: ${err.message}` }],
            };
        }
    });
}
//# sourceMappingURL=codegraph.js.map