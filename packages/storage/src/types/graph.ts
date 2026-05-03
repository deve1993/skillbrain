/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 *
 * Graph types used by graph-store.ts. Mirrors a subset of
 * codegraph's core/graph/types.ts so storage stays standalone.
 */

export type NodeLabel = 'File' | 'Function' | 'Class' | 'Method' | 'Interface' | 'Community' | 'Process'

export type EdgeType =
  | 'CALLS'
  | 'IMPORTS'
  | 'EXTENDS'
  | 'IMPLEMENTS'
  | 'HAS_METHOD'
  | 'MEMBER_OF'
  | 'STEP_IN_PROCESS'

export interface GraphNode {
  id: string
  label: NodeLabel
  name: string
  filePath?: string
  startLine?: number
  endLine?: number
  isExported: boolean
  properties?: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  type: EdgeType
  confidence: number
  reason?: string
  step?: number
}

export interface FileRecord {
  path: string
  contentHash: string
  indexedAt: string
  symbolCount: number
}

export interface RepoMeta {
  name: string
  path: string
  lastCommit: string | null
  indexedAt: string
  stats: {
    nodes: number
    edges: number
    files: number
    communities: number
    processes: number
  }
}
