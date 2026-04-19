import { edgeId } from '../../utils/hash.js';
import path from 'node:path';
/**
 * Simplified Louvain community detection.
 * Groups symbols into communities based on CALLS and IMPORTS edges.
 */
export function detectCommunities(store) {
    // Get all function/class/method nodes
    const symbolNodes = [
        ...store.getNodesByLabel('Function'),
        ...store.getNodesByLabel('Class'),
        ...store.getNodesByLabel('Method'),
    ];
    if (symbolNodes.length === 0)
        return 0;
    // Build adjacency from edges
    const adj = new Map();
    for (const node of symbolNodes) {
        adj.set(node.id, new Map());
    }
    // Add CALLS edges as connections
    const allEdges = store.rawQuery("SELECT source_id, target_id FROM edges WHERE type IN ('CALLS', 'IMPORTS')");
    const nodeIdSet = new Set(symbolNodes.map((n) => n.id));
    for (const e of allEdges) {
        if (!nodeIdSet.has(e.source_id) || !nodeIdSet.has(e.target_id))
            continue;
        const srcAdj = adj.get(e.source_id);
        if (srcAdj)
            srcAdj.set(e.target_id, (srcAdj.get(e.target_id) || 0) + 1);
        const tgtAdj = adj.get(e.target_id);
        if (tgtAdj)
            tgtAdj.set(e.source_id, (tgtAdj.get(e.source_id) || 0) + 1);
    }
    // Initialize: each node in its own community
    const community = new Map();
    symbolNodes.forEach((n, i) => community.set(n.id, i));
    // Total edge weight
    const totalWeight = allEdges.length || 1;
    // Iterative optimization (simplified Louvain)
    let improved = true;
    let iterations = 0;
    const maxIterations = 20;
    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;
        for (const node of symbolNodes) {
            const currentCom = community.get(node.id);
            const neighbors = adj.get(node.id) || new Map();
            // Calculate modularity gain for each neighbor community
            const communityWeights = new Map();
            for (const [neighborId, weight] of neighbors) {
                const neighborCom = community.get(neighborId);
                if (neighborCom !== undefined) {
                    communityWeights.set(neighborCom, (communityWeights.get(neighborCom) || 0) + weight);
                }
            }
            // Find best community
            let bestCom = currentCom;
            let bestGain = 0;
            for (const [com, weight] of communityWeights) {
                if (com === currentCom)
                    continue;
                const gain = weight / totalWeight;
                if (gain > bestGain) {
                    bestGain = gain;
                    bestCom = com;
                }
            }
            if (bestCom !== currentCom && bestGain > 0.001) {
                community.set(node.id, bestCom);
                improved = true;
            }
        }
    }
    // Collect communities and create Community nodes
    const communityMembers = new Map();
    for (const node of symbolNodes) {
        const com = community.get(node.id);
        if (!communityMembers.has(com))
            communityMembers.set(com, []);
        communityMembers.get(com).push(node);
    }
    // Only create communities with 2+ members
    const communityNodes = [];
    const memberEdges = [];
    let count = 0;
    for (const [comId, members] of communityMembers) {
        if (members.length < 2)
            continue;
        // Heuristic label based on common directory
        const label = heuristicLabel(members);
        const id = `community_${count}`;
        communityNodes.push({
            id,
            label: 'Community',
            name: label,
            isExported: false,
            properties: { memberCount: members.length },
        });
        for (const member of members) {
            memberEdges.push({
                id: edgeId(member.id, id, 'MEMBER_OF'),
                sourceId: member.id,
                targetId: id,
                type: 'MEMBER_OF',
                confidence: 1.0,
            });
        }
        count++;
    }
    store.addNodesBatch(communityNodes);
    store.addEdgesBatch(memberEdges);
    return count;
}
function heuristicLabel(members) {
    // Find most common directory
    const dirs = new Map();
    for (const m of members) {
        if (m.filePath) {
            const dir = path.dirname(m.filePath);
            dirs.set(dir, (dirs.get(dir) || 0) + 1);
        }
    }
    let bestDir = '';
    let bestCount = 0;
    for (const [dir, count] of dirs) {
        if (count > bestCount) {
            bestDir = dir;
            bestCount = count;
        }
    }
    if (bestDir) {
        const parts = bestDir.split('/');
        return parts.slice(-2).join('/') || bestDir;
    }
    return members[0]?.name || 'unknown';
}
//# sourceMappingURL=community.js.map