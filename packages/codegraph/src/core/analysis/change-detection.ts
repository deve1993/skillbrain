/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type { ChangeDetectionResult, GraphNode } from '../graph/types.js'
import { GraphStore } from '@skillbrain/storage'
import { getStagedFiles, getChangedFiles, getDiffFiles } from '../../utils/git.js'
import path from 'node:path'

export function detectChanges(
  store: GraphStore,
  repoPath: string,
  scope: 'staged' | 'all' | 'compare' = 'all',
  baseRef?: string,
): ChangeDetectionResult {
  let changedFiles: string[]

  switch (scope) {
    case 'staged':
      changedFiles = getStagedFiles(repoPath)
      break
    case 'compare':
      changedFiles = getDiffFiles(repoPath, baseRef || 'main')
      break
    default:
      changedFiles = getChangedFiles(repoPath)
  }

  // Map changed files to affected symbols
  const affectedSymbols: GraphNode[] = []
  const affectedProcessNames = new Set<string>()

  for (const file of changedFiles) {
    const relativePath = path.relative(repoPath, path.resolve(repoPath, file))
    const symbols = store.getNodesByFile(relativePath)
    affectedSymbols.push(...symbols.filter((s) => s.label !== 'File'))

    // Find processes these symbols participate in
    for (const sym of symbols) {
      const processes = store.getProcessesForSymbol(sym.id)
      for (const p of processes) affectedProcessNames.add(p.name)
    }
  }

  const riskLevel = assessChangeRisk(affectedSymbols, affectedProcessNames.size)

  return {
    changedFiles,
    affectedSymbols,
    affectedProcesses: [...affectedProcessNames],
    riskLevel,
  }
}

function assessChangeRisk(
  symbols: GraphNode[],
  processCount: number,
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (symbols.length > 20 || processCount > 5) return 'HIGH'
  if (symbols.length > 10 || processCount > 2) return 'MEDIUM'
  return 'LOW'
}
