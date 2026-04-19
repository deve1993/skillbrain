export function analyzeImpact(store, targetName, direction = 'upstream', maxDepth = 3, minConfidence = 0.5) {
    const target = store.getNodeByName(targetName);
    if (!target)
        return null;
    const items = [];
    const visited = new Set([target.id]);
    if (direction === 'upstream' || direction === 'both') {
        bfsImpact(store, target.id, 'upstream', maxDepth, visited, items);
    }
    if (direction === 'downstream' || direction === 'both') {
        bfsImpact(store, target.id, 'downstream', maxDepth, visited, items);
    }
    // Filter by confidence
    const filtered = items.filter((i) => i.confidence >= minConfidence);
    // Get affected processes
    const affectedProcessIds = new Set();
    for (const item of filtered) {
        const processes = store.getProcessesForSymbol(item.id);
        for (const p of processes)
            affectedProcessIds.add(p.name);
    }
    // Also add target's own processes
    const targetProcesses = store.getProcessesForSymbol(target.id);
    for (const p of targetProcesses)
        affectedProcessIds.add(p.name);
    const riskLevel = assessRisk(filtered, affectedProcessIds.size, target);
    return {
        target: targetName,
        direction,
        depth: maxDepth,
        items: filtered,
        riskLevel,
        affectedProcesses: [...affectedProcessIds],
    };
}
function bfsImpact(store, startId, direction, maxDepth, visited, items) {
    const queue = [{ id: startId, depth: 0 }];
    while (queue.length > 0) {
        const { id, depth } = queue.shift();
        if (depth >= maxDepth)
            continue;
        const neighbors = direction === 'upstream'
            ? store.getCallers(id)
            : store.getCallees(id);
        for (const neighbor of neighbors) {
            if (visited.has(neighbor.id))
                continue;
            visited.add(neighbor.id);
            const currentDepth = depth + 1;
            const confidence = depthToConfidence(currentDepth);
            items.push({
                id: neighbor.id,
                name: neighbor.name,
                label: neighbor.label,
                filePath: neighbor.filePath,
                depth: currentDepth,
                confidence,
            });
            queue.push({ id: neighbor.id, depth: currentDepth });
        }
    }
}
function depthToConfidence(depth) {
    switch (depth) {
        case 1: return 0.95; // WILL BREAK
        case 2: return 0.7; // LIKELY AFFECTED
        case 3: return 0.4; // MAY NEED TESTING
        default: return 0.2;
    }
}
function assessRisk(items, processCount, target) {
    const symbolCount = items.length;
    const targetName = target.name.toLowerCase();
    // Critical path keywords
    const criticalPatterns = /auth|payment|stripe|login|session|token|password|secret|crypt/i;
    if (criticalPatterns.test(targetName))
        return 'CRITICAL';
    if (symbolCount > 15 || processCount > 5)
        return 'HIGH';
    if (symbolCount > 5 || processCount > 2)
        return 'MEDIUM';
    return 'LOW';
}
//# sourceMappingURL=impact.js.map