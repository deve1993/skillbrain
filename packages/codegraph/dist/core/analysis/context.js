export function getSymbolContext(store, symbolName) {
    const symbol = store.getNodeByName(symbolName);
    if (!symbol)
        return null;
    const callers = store.getCallers(symbol.id);
    const callees = store.getCallees(symbol.id);
    const processes = store.getProcessesForSymbol(symbol.id);
    // Find community
    const edges = store.getEdgesFrom(symbol.id);
    const memberOfEdge = edges.find((e) => e.type === 'MEMBER_OF');
    let community;
    if (memberOfEdge) {
        const comNode = store.getNode(memberOfEdge.targetId);
        if (comNode)
            community = comNode.name;
    }
    return {
        symbol,
        callers,
        callees,
        processes,
        community,
        file: symbol.filePath || 'unknown',
    };
}
//# sourceMappingURL=context.js.map