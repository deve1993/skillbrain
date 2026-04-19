import fs from 'node:fs';
import path from 'node:path';
export function previewRename(store, repoPath, symbolName, newName) {
    const changes = [];
    const symbol = store.getNodeByName(symbolName);
    if (!symbol)
        return { changes: [], totalEdits: 0 };
    // 1. Graph-based: find all references via callers and edges
    const callers = store.getCallers(symbol.id);
    const filesToScan = new Set();
    // Add the definition file
    if (symbol.filePath)
        filesToScan.add(symbol.filePath);
    // Add all caller files
    for (const caller of callers) {
        if (caller.filePath)
            filesToScan.add(caller.filePath);
    }
    // 2. Text search: also scan files that import the symbol's file
    const importEdges = store.rawQuery(`SELECT DISTINCT n.file_path FROM nodes n JOIN edges e ON e.source_id = n.id WHERE e.type = 'IMPORTS' AND n.file_path IS NOT NULL`);
    for (const row of importEdges) {
        filesToScan.add(row.file_path);
    }
    // 3. Scan each file for occurrences
    for (const relativePath of filesToScan) {
        const fullPath = path.join(repoPath, relativePath);
        if (!fs.existsSync(fullPath))
            continue;
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        const edits = [];
        // Create regex that matches the symbol name as a whole word
        const regex = new RegExp(`\\b${escapeRegex(symbolName)}\\b`, 'g');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            regex.lastIndex = 0;
            if (regex.test(line)) {
                regex.lastIndex = 0;
                const isGraphRef = callers.some((c) => c.filePath === relativePath) ||
                    symbol.filePath === relativePath;
                edits.push({
                    line: i + 1,
                    oldText: line.trim(),
                    newText: line.replace(regex, newName).trim(),
                    confidence: isGraphRef ? 0.95 : 0.7,
                    source: isGraphRef ? 'graph' : 'text_search',
                });
            }
        }
        if (edits.length > 0) {
            changes.push({ filePath: relativePath, edits });
        }
    }
    return {
        changes,
        totalEdits: changes.reduce((sum, c) => sum + c.edits.length, 0),
    };
}
export function executeRename(repoPath, preview, symbolName, newName) {
    let totalApplied = 0;
    const regex = new RegExp(`\\b${escapeRegex(symbolName)}\\b`, 'g');
    for (const change of preview.changes) {
        const fullPath = path.join(repoPath, change.filePath);
        if (!fs.existsSync(fullPath))
            continue;
        let content = fs.readFileSync(fullPath, 'utf-8');
        const newContent = content.replace(regex, newName);
        if (newContent !== content) {
            fs.writeFileSync(fullPath, newContent, 'utf-8');
            totalApplied += change.edits.length;
        }
    }
    return totalApplied;
}
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=rename.js.map