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

export interface ImpactResult {
  target: string
  direction: 'upstream' | 'downstream' | 'both'
  depth: number
  items: ImpactItem[]
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  affectedProcesses: string[]
}

export interface ImpactItem {
  id: string
  name: string
  label: NodeLabel
  filePath?: string
  depth: number
  confidence: number
}

export interface ContextResult {
  symbol: GraphNode
  callers: GraphNode[]
  callees: GraphNode[]
  processes: { name: string; step: number }[]
  community?: string
  file: string
}

export interface SearchResult {
  node: GraphNode
  score: number
  process?: string
}

export interface ChangeDetectionResult {
  changedFiles: string[]
  affectedSymbols: GraphNode[]
  affectedProcesses: string[]
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface RenamePreview {
  changes: RenameChange[]
  totalEdits: number
}

export interface RenameChange {
  filePath: string
  edits: RenameEdit[]
}

export interface RenameEdit {
  line: number
  oldText: string
  newText: string
  confidence: number
  source: 'graph' | 'text_search'
}
