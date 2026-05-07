/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type { ContextResult } from '../graph/types.js'
import { GraphStore } from '@skillbrain/storage'

export function getSymbolContext(store: GraphStore, symbolName: string): ContextResult | null {
  const symbol = store.getNodeByName(symbolName)
  if (!symbol) return null

  const callers = store.getCallers(symbol.id)
  const callees = store.getCallees(symbol.id)
  const processes = store.getProcessesForSymbol(symbol.id)

  // Find community
  const edges = store.getEdgesFrom(symbol.id)
  const memberOfEdge = edges.find((e) => e.type === 'MEMBER_OF')
  let community: string | undefined
  if (memberOfEdge) {
    const comNode = store.getNode(memberOfEdge.targetId)
    if (comNode) community = comNode.name
  }

  return {
    symbol,
    callers,
    callees,
    processes,
    community,
    file: symbol.filePath || 'unknown',
  }
}
