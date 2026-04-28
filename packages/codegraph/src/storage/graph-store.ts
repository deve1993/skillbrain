/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type Database from 'better-sqlite3'
import type { GraphNode, GraphEdge, FileRecord } from '../core/graph/types.js'
import { randomId } from '../utils/hash.js'
import { warn } from '../utils/logger.js'

export class GraphStore {
  private stmts: ReturnType<typeof this.prepareStatements>

  constructor(private db: Database.Database) {
    this.stmts = this.prepareStatements()
  }

  private prepareStatements() {
    return {
      insertNode: this.db.prepare(`
        INSERT OR REPLACE INTO nodes (id, label, name, file_path, start_line, end_line, is_exported, properties)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),
      insertEdge: this.db.prepare(`
        INSERT OR IGNORE INTO edges (id, source_id, target_id, type, confidence, reason, step)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      insertFile: this.db.prepare(`
        INSERT OR REPLACE INTO files (path, content_hash, indexed_at, symbol_count)
        VALUES (?, ?, ?, ?)
      `),
      getNode: this.db.prepare('SELECT * FROM nodes WHERE id = ?'),
      getNodeByName: this.db.prepare('SELECT * FROM nodes WHERE name = ? AND label != ?'),
      getNodesByFile: this.db.prepare('SELECT * FROM nodes WHERE file_path = ?'),
      getNodesByLabel: this.db.prepare('SELECT * FROM nodes WHERE label = ?'),
      getEdgesFrom: this.db.prepare('SELECT * FROM edges WHERE source_id = ?'),
      getEdgesTo: this.db.prepare('SELECT * FROM edges WHERE target_id = ?'),
      getEdgesByType: this.db.prepare('SELECT * FROM edges WHERE type = ?'),
      getFile: this.db.prepare('SELECT * FROM files WHERE path = ?'),
      getAllFiles: this.db.prepare('SELECT * FROM files'),
      deleteNodesByFile: this.db.prepare('DELETE FROM nodes WHERE file_path = ?'),
      deleteFileRecord: this.db.prepare('DELETE FROM files WHERE path = ?'),
      countNodes: this.db.prepare('SELECT COUNT(*) as count FROM nodes'),
      countEdges: this.db.prepare('SELECT COUNT(*) as count FROM edges'),
      countFiles: this.db.prepare('SELECT COUNT(*) as count FROM files'),
      countByLabel: this.db.prepare('SELECT COUNT(*) as count FROM nodes WHERE label = ?'),
      searchFts: this.db.prepare(`
        SELECT n.*, fts.rank
        FROM nodes_fts fts
        JOIN nodes n ON n.rowid = fts.rowid
        WHERE nodes_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `),
      getCallers: this.db.prepare(`
        SELECT n.* FROM nodes n
        JOIN edges e ON e.source_id = n.id
        WHERE e.target_id = ? AND e.type = 'CALLS'
      `),
      getCallees: this.db.prepare(`
        SELECT n.* FROM nodes n
        JOIN edges e ON e.target_id = n.id
        WHERE e.source_id = ? AND e.type = 'CALLS'
      `),
      getProcesses: this.db.prepare(`
        SELECT DISTINCT p.* FROM nodes p
        JOIN edges e ON e.target_id = p.id
        WHERE e.source_id = ? AND e.type = 'STEP_IN_PROCESS'
      `),
      getProcessSteps: this.db.prepare(`
        SELECT n.*, e.step FROM nodes n
        JOIN edges e ON e.source_id = n.id
        WHERE e.target_id = ? AND e.type = 'STEP_IN_PROCESS'
        ORDER BY e.step
      `),
      getCommunityMembers: this.db.prepare(`
        SELECT n.* FROM nodes n
        JOIN edges e ON e.source_id = n.id
        WHERE e.target_id = ? AND e.type = 'MEMBER_OF'
      `),
    }
  }

  addNode(node: GraphNode): void {
    this.stmts.insertNode.run(
      node.id,
      node.label,
      node.name,
      node.filePath ?? null,
      node.startLine ?? null,
      node.endLine ?? null,
      node.isExported ? 1 : 0,
      node.properties ? JSON.stringify(node.properties) : null,
    )
  }

  addEdge(edge: GraphEdge): void {
    this.stmts.insertEdge.run(
      edge.id,
      edge.sourceId,
      edge.targetId,
      edge.type,
      edge.confidence,
      edge.reason ?? null,
      edge.step ?? null,
    )
  }

  addFile(file: FileRecord): void {
    this.stmts.insertFile.run(file.path, file.contentHash, file.indexedAt, file.symbolCount)
  }

  addNodesBatch(nodes: GraphNode[]): void {
    const insertFts = this.db.prepare(`
      INSERT OR REPLACE INTO nodes_fts(rowid, name, file_path, search_text)
      VALUES ((SELECT rowid FROM nodes WHERE id = ?), ?, ?, ?)
    `)

    const tx = this.db.transaction((items: GraphNode[]) => {
      for (const n of items) {
        this.addNode(n)
        // Populate FTS with expanded camelCase tokens
        const searchText = expandForSearch(n.name, n.filePath)
        try {
          insertFts.run(n.id, n.name, n.filePath ?? null, searchText)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          warn(`FTS insert failed for node "${n.name}" (${n.id}): ${msg}`)
        }
      }
    })
    tx(nodes)
  }

  addEdgesBatch(edges: GraphEdge[]): void {
    const tx = this.db.transaction((items: GraphEdge[]) => {
      for (const e of items) this.addEdge(e)
    })
    tx(edges)
  }

  getNode(id: string): GraphNode | undefined {
    const row = this.stmts.getNode.get(id) as any
    return row ? this.rowToNode(row) : undefined
  }

  getNodeByName(name: string): GraphNode | undefined {
    const row = this.stmts.getNodeByName.get(name, 'File') as any
    return row ? this.rowToNode(row) : undefined
  }

  getNodesByFile(filePath: string): GraphNode[] {
    return (this.stmts.getNodesByFile.all(filePath) as any[]).map(this.rowToNode)
  }

  getNodesByLabel(label: string): GraphNode[] {
    return (this.stmts.getNodesByLabel.all(label) as any[]).map(this.rowToNode)
  }

  getCallers(nodeId: string): GraphNode[] {
    return (this.stmts.getCallers.all(nodeId) as any[]).map(this.rowToNode)
  }

  getCallees(nodeId: string): GraphNode[] {
    return (this.stmts.getCallees.all(nodeId) as any[]).map(this.rowToNode)
  }

  getProcessesForSymbol(nodeId: string): { name: string; step: number }[] {
    const rows = this.stmts.getProcesses.all(nodeId) as any[]
    return rows.map((r) => ({ name: r.name, step: 0 }))
  }

  getProcessSteps(processId: string): (GraphNode & { step: number })[] {
    return (this.stmts.getProcessSteps.all(processId) as any[]).map((r) => ({
      ...this.rowToNode(r),
      step: r.step,
    }))
  }

  getCommunityMembers(communityId: string): GraphNode[] {
    return (this.stmts.getCommunityMembers.all(communityId) as any[]).map(this.rowToNode)
  }

  getEdgesFrom(nodeId: string): GraphEdge[] {
    return (this.stmts.getEdgesFrom.all(nodeId) as any[]).map(this.rowToEdge)
  }

  getEdgesTo(nodeId: string): GraphEdge[] {
    return (this.stmts.getEdgesTo.all(nodeId) as any[]).map(this.rowToEdge)
  }

  getFile(filePath: string): FileRecord | undefined {
    return this.stmts.getFile.get(filePath) as FileRecord | undefined
  }

  getAllFiles(): FileRecord[] {
    return this.stmts.getAllFiles.all() as FileRecord[]
  }

  deleteByFile(filePath: string): void {
    this.stmts.deleteNodesByFile.run(filePath)
    this.stmts.deleteFileRecord.run(filePath)
  }

  search(query: string, limit = 10): { node: GraphNode; rank: number }[] {
    const expanded = expandSearchTokens(query)
    try {
      const rows = this.stmts.searchFts.all(expanded, limit) as any[]
      return rows.map((r) => ({ node: this.rowToNode(r), rank: r.rank }))
    } catch {
      return []
    }
  }

  stats() {
    const nodes = (this.stmts.countNodes.get() as any).count
    const edges = (this.stmts.countEdges.get() as any).count
    const files = (this.stmts.countFiles.get() as any).count
    const communities = (this.stmts.countByLabel.get('Community') as any).count
    const processes = (this.stmts.countByLabel.get('Process') as any).count
    return { nodes, edges, files, communities, processes }
  }

  rawQuery(sql: string): unknown[] {
    return this.db.prepare(sql).all()
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  private rowToNode(row: any): GraphNode {
    return {
      id: row.id,
      label: row.label,
      name: row.name,
      filePath: row.file_path ?? undefined,
      startLine: row.start_line ?? undefined,
      endLine: row.end_line ?? undefined,
      isExported: !!row.is_exported,
      properties: row.properties ? JSON.parse(row.properties) : undefined,
    }
  }

  private rowToEdge(row: any): GraphEdge {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      type: row.type,
      confidence: row.confidence,
      reason: row.reason ?? undefined,
      step: row.step ?? undefined,
    }
  }
}

function expandSearchTokens(query: string): string {
  const words = query
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1)

  return words.map((w) => `"${w}"`).join(' OR ')
}

function expandForSearch(name: string, filePath?: string): string {
  const parts: string[] = [name]

  // camelCase split: CookieConsentBanner → cookie consent banner
  const camelSplit = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .toLowerCase()
  parts.push(camelSplit)

  // File path parts
  if (filePath) {
    parts.push(filePath)
    const pathParts = filePath
      .replace(/\.[^.]+$/, '')
      .split('/')
      .filter((p) => p.length > 1)
    parts.push(...pathParts)
  }

  return [...new Set(parts)].join(' ')
}
