import { getStagedFiles, getChangedFiles, getDiffFiles } from '../../utils/git.js';
import path from 'node:path';
export function detectChanges(store, repoPath, scope = 'all', baseRef) {
    let changedFiles;
    switch (scope) {
        case 'staged':
            changedFiles = getStagedFiles(repoPath);
            break;
        case 'compare':
            changedFiles = getDiffFiles(repoPath, baseRef || 'main');
            break;
        default:
            changedFiles = getChangedFiles(repoPath);
    }
    // Map changed files to affected symbols
    const affectedSymbols = [];
    const affectedProcessNames = new Set();
    for (const file of changedFiles) {
        const relativePath = path.relative(repoPath, path.resolve(repoPath, file));
        const symbols = store.getNodesByFile(relativePath);
        affectedSymbols.push(...symbols.filter((s) => s.label !== 'File'));
        // Find processes these symbols participate in
        for (const sym of symbols) {
            const processes = store.getProcessesForSymbol(sym.id);
            for (const p of processes)
                affectedProcessNames.add(p.name);
        }
    }
    const riskLevel = assessChangeRisk(affectedSymbols, affectedProcessNames.size);
    return {
        changedFiles,
        affectedSymbols,
        affectedProcesses: [...affectedProcessNames],
        riskLevel,
    };
}
function assessChangeRisk(symbols, processCount) {
    if (symbols.length > 20 || processCount > 5)
        return 'HIGH';
    if (symbols.length > 10 || processCount > 2)
        return 'MEDIUM';
    return 'LOW';
}
//# sourceMappingURL=change-detection.js.map