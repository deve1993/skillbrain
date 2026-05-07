/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type { Project } from 'ts-morph'
import type { GraphNode, GraphEdge, FileRecord } from './types.js'
import { extractSymbols } from '../parser/symbol-extractor.js'
import { extractCalls } from '../parser/call-extractor.js'
import { extractImports } from '../parser/import-extractor.js'
import { extractHeritage } from '../parser/heritage-extractor.js'
import { fileHash, nodeId, edgeId } from '../../utils/hash.js'
import { GraphStore } from '@skillbrain/storage'
import { info, dim } from '../../utils/logger.js'
import type { ImportInfo } from '../parser/import-extractor.js'
import path from 'node:path'

export interface BuildResult {
  nodes: number
  edges: number
  files: number
  skipped: number
}

export function buildGraph(
  project: Project,
  store: GraphStore,
  repoPath: string,
  incremental: boolean,
): BuildResult {
  const sourceFiles = project.getSourceFiles()
  let totalNodes = 0
  let totalEdges = 0
  let filesProcessed = 0
  let filesSkipped = 0

  const allNodes: GraphNode[] = []
  const allEdges: GraphEdge[] = []
  const allImports: ImportInfo[] = []

  for (const sf of sourceFiles) {
    const fullPath = sf.getFilePath()
    const relativePath = path.relative(repoPath, fullPath)

    // Skip files outside repo
    if (relativePath.startsWith('..')) continue

    // Incremental: skip unchanged files
    if (incremental) {
      const existingFile = store.getFile(relativePath)
      const currentHash = fileHash(fullPath)
      if (existingFile && existingFile.contentHash === currentHash) {
        filesSkipped++
        continue
      }
      // File changed — remove old symbols for this file
      store.deleteByFile(relativePath)
    }

    dim(`  parsing ${relativePath}`)

    try {
      // Extract symbols
      const nodes = extractSymbols(sf, relativePath)
      allNodes.push(...nodes)

      // Extract call edges
      const callEdges = extractCalls(sf, relativePath)
      allEdges.push(...callEdges)

      // Extract import edges
      const { edges: importEdges, imports } = extractImports(sf, relativePath)
      allEdges.push(...importEdges)
      allImports.push(...imports)

      // Extract heritage edges (extends, implements, has_method)
      const heritageEdges = extractHeritage(sf, relativePath)
      allEdges.push(...heritageEdges)

      // Record file
      const hash = fileHash(fullPath)
      const fileRecord: FileRecord = {
        path: relativePath,
        contentHash: hash,
        indexedAt: new Date().toISOString(),
        symbolCount: nodes.filter((n) => n.label !== 'File').length,
      }
      store.addFile(fileRecord)

      totalNodes += nodes.length
      totalEdges += callEdges.length + importEdges.length + heritageEdges.length
      filesProcessed++
    } catch (err) {
      // Skip files that fail to parse
      dim(`  skipped ${relativePath} (parse error)`)
    }
  }

  // Batch insert all nodes and edges
  info(`Inserting ${allNodes.length} nodes, ${allEdges.length} edges...`)
  store.addNodesBatch(allNodes)

  // Filter edges to only those with valid source/target nodes
  const validNodeIds = new Set(allNodes.map((n) => n.id))
  // Also include existing nodes from incremental builds
  if (incremental) {
    const existingNodes = store.rawQuery('SELECT id FROM nodes') as { id: string }[]
    for (const n of existingNodes) validNodeIds.add(n.id)
  }

  const validEdges = allEdges.filter(
    (e) => validNodeIds.has(e.sourceId) && validNodeIds.has(e.targetId),
  )

  // --- Cross-file call resolution ---
  // Build a map: symbolName → nodeId (for all non-File nodes)
  const symbolMap = new Map<string, string>()
  for (const node of allNodes) {
    if (node.label !== 'File') {
      symbolMap.set(node.name, node.id)
    }
  }

  // Build a map: file → imported symbol names (from import declarations)
  const fileImportedSymbols = new Map<string, Set<string>>()
  for (const imp of allImports) {
    if (!imp.isRelative) continue
    if (!fileImportedSymbols.has(imp.fromFile)) {
      fileImportedSymbols.set(imp.fromFile, new Set())
    }
    for (const spec of imp.specifiers) {
      fileImportedSymbols.get(imp.fromFile)!.add(spec)
    }
  }

  // For each CALLS edge where target doesn't exist in valid nodes,
  // try to resolve via import map + global symbol lookup
  const crossFileEdges: GraphEdge[] = []
  const invalidCallEdges = allEdges.filter(
    (e) => e.type === 'CALLS' && validNodeIds.has(e.sourceId) && !validNodeIds.has(e.targetId),
  )

  for (const edge of invalidCallEdges) {
    // Find the caller node to get its file
    const callerNode = allNodes.find((n) => n.id === edge.sourceId)
    if (!callerNode?.filePath) continue

    // Extract the called function name from the edge reason
    const calledName = edge.reason?.split(' calls ')[1] || ''
    if (!calledName) continue

    // Check if this name was imported in the caller's file
    const importedSymbols = fileImportedSymbols.get(callerNode.filePath)
    const wasImported = importedSymbols?.has(calledName) || importedSymbols?.has(calledName.split('.')[0])

    // Look up the real node ID for this symbol name
    const realTargetId = symbolMap.get(calledName)
    if (realTargetId && (wasImported || !calledName.includes('.'))) {
      crossFileEdges.push({
        id: edgeId(edge.sourceId, realTargetId, 'CALLS'),
        sourceId: edge.sourceId,
        targetId: realTargetId,
        type: 'CALLS',
        confidence: wasImported ? 0.95 : 0.7,
        reason: edge.reason,
      })
    }
  }

  if (crossFileEdges.length > 0) {
    dim(`  resolved ${crossFileEdges.length} cross-file call edges`)
  }

  store.addEdgesBatch([...validEdges, ...crossFileEdges])

  return {
    nodes: totalNodes,
    edges: validEdges.length + crossFileEdges.length,
    files: filesProcessed,
    skipped: filesSkipped,
  }
}
