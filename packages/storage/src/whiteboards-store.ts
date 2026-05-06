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
import { randomId } from './utils/hash.js'

export type WhiteboardScope = 'team' | 'project'

export interface Whiteboard {
  id: string
  name: string
  scope: WhiteboardScope
  projectName: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  stateJson: string
  stateVersion: number
  thumbnailDataUrl: string | null
  votePool: number
  shareToken: string | null
  pinnedAt: string | null
  lastOpenedAt: string | null
  tags: string[]
  description: string | null
  deletedAt: string | null
}

export interface WhiteboardSummary {
  id: string
  name: string
  scope: WhiteboardScope
  projectName: string | null
  createdBy: string
  updatedAt: string
  thumbnailDataUrl: string | null
  pinnedAt: string | null
  lastOpenedAt: string | null
  tags: string[]
  description: string | null
}

export interface WhiteboardComment {
  id: string
  boardId: string
  nodeId: string
  parentId: string | null
  authorEmail: string
  body: string
  createdAt: string
}

export class WhiteboardConcurrencyError extends Error {
  readonly code = 'whiteboard_version_conflict'
  constructor(readonly currentVersion: number) {
    super(`Whiteboard was updated by someone else (current version: ${currentVersion})`)
  }
}

interface WhiteboardRow {
  id: string
  name: string
  scope: WhiteboardScope
  project_name: string | null
  created_by: string
  created_at: string
  updated_at: string
  state_json: string
  state_version: number
  thumbnail_data_url: string | null
  vote_pool: number
  share_token: string | null
  pinned_at: string | null
  last_opened_at: string | null
  tags: string
  description: string | null
  deleted_at: string | null
}

interface CommentRow {
  id: string
  board_id: string
  node_id: string
  parent_id: string | null
  author_email: string
  body: string
  created_at: string
}

function parseTags(s: string | null): string[] {
  if (!s) return []
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}

function rowToBoard(r: WhiteboardRow): Whiteboard {
  return {
    id: r.id,
    name: r.name,
    scope: r.scope,
    projectName: r.project_name,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    stateJson: r.state_json,
    stateVersion: r.state_version,
    thumbnailDataUrl: r.thumbnail_data_url,
    votePool: r.vote_pool,
    shareToken: r.share_token,
    pinnedAt: r.pinned_at,
    lastOpenedAt: r.last_opened_at,
    tags: parseTags(r.tags),
    description: r.description,
    deletedAt: r.deleted_at,
  }
}

function rowToSummary(r: WhiteboardRow): WhiteboardSummary {
  return {
    id: r.id,
    name: r.name,
    scope: r.scope,
    projectName: r.project_name,
    createdBy: r.created_by,
    updatedAt: r.updated_at,
    thumbnailDataUrl: r.thumbnail_data_url,
    pinnedAt: r.pinned_at,
    lastOpenedAt: r.last_opened_at,
    tags: parseTags(r.tags),
    description: r.description,
  }
}

function rowToComment(r: CommentRow): WhiteboardComment {
  return {
    id: r.id,
    boardId: r.board_id,
    nodeId: r.node_id,
    parentId: r.parent_id,
    authorEmail: r.author_email,
    body: r.body,
    createdAt: r.created_at,
  }
}

export class WhiteboardsStore {
  constructor(private db: Database.Database) {}

  // ── Boards ──

  create(input: {
    name: string
    scope: WhiteboardScope
    projectName?: string | null
    createdBy: string
    stateJson?: string
    votePool?: number
  }): Whiteboard {
    if (input.scope === 'project' && !input.projectName) {
      throw new Error('projectName required when scope=project')
    }
    const id = randomId()
    const now = new Date().toISOString()
    const stateJson = input.stateJson ?? '{"nodes":[],"connectors":[],"viewport":{"x":0,"y":0,"zoom":1}}'
    this.db.prepare(
      `INSERT INTO whiteboards (id, name, scope, project_name, created_by, created_at, updated_at, state_json, state_version, vote_pool)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(
      id,
      input.name,
      input.scope,
      input.scope === 'project' ? input.projectName! : null,
      input.createdBy,
      now,
      now,
      stateJson,
      input.votePool ?? 5,
    )
    return this.get(id)!
  }

  get(id: string): Whiteboard | undefined {
    const row = this.db.prepare(`SELECT * FROM whiteboards WHERE id = ?`).get(id) as WhiteboardRow | undefined
    return row ? rowToBoard(row) : undefined
  }

  list(filter?: {
    scope?: WhiteboardScope
    projectName?: string
    includeTrashed?: boolean
    onlyTrashed?: boolean
    pinned?: boolean
    tag?: string
    search?: string
  }): WhiteboardSummary[] {
    const where: string[] = []
    const params: any[] = []
    if (filter?.onlyTrashed) where.push('deleted_at IS NOT NULL')
    else if (!filter?.includeTrashed) where.push('deleted_at IS NULL')
    if (filter?.scope) { where.push('scope = ?'); params.push(filter.scope) }
    if (filter?.projectName) { where.push('project_name = ?'); params.push(filter.projectName) }
    if (filter?.pinned) where.push('pinned_at IS NOT NULL')
    if (filter?.tag) { where.push("tags LIKE ?"); params.push(`%"${filter.tag}"%`) }
    if (filter?.search) {
      where.push("(LOWER(name) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ?)")
      const q = `%${filter.search.toLowerCase()}%`
      params.push(q, q)
    }
    const sql = `SELECT id, name, scope, project_name, created_by, updated_at, thumbnail_data_url,
                        pinned_at, last_opened_at, tags, description
                 FROM whiteboards ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY pinned_at IS NULL, pinned_at DESC, updated_at DESC`
    const rows = this.db.prepare(sql).all(...params) as WhiteboardRow[]
    return rows.map(rowToSummary)
  }

  /** Most recently opened/edited boards. */
  listRecent(limit = 5): WhiteboardSummary[] {
    const rows = this.db.prepare(
      `SELECT id, name, scope, project_name, created_by, updated_at, thumbnail_data_url,
              pinned_at, last_opened_at, tags, description
       FROM whiteboards
       WHERE deleted_at IS NULL
       ORDER BY COALESCE(last_opened_at, updated_at) DESC
       LIMIT ?`
    ).all(limit) as WhiteboardRow[]
    return rows.map(rowToSummary)
  }

  /** Toggle pin: returns the new pinned_at value (string or null). */
  togglePin(id: string): string | null {
    const row = this.db.prepare(`SELECT pinned_at FROM whiteboards WHERE id = ?`).get(id) as { pinned_at: string | null } | undefined
    if (!row) return null
    const newVal = row.pinned_at ? null : new Date().toISOString()
    this.db.prepare(`UPDATE whiteboards SET pinned_at = ? WHERE id = ?`).run(newVal, id)
    return newVal
  }

  /** Update last_opened_at to now (called when client opens a board). */
  markOpened(id: string): void {
    this.db.prepare(`UPDATE whiteboards SET last_opened_at = ? WHERE id = ?`).run(new Date().toISOString(), id)
  }

  /** Update tags / description (free-form metadata, no version bump). */
  updateMetadata(id: string, patch: { tags?: string[]; description?: string | null }): Whiteboard | undefined {
    const sets: string[] = []
    const params: any[] = []
    if (patch.tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(patch.tags)) }
    if (patch.description !== undefined) { sets.push('description = ?'); params.push(patch.description) }
    if (!sets.length) return this.get(id)
    params.push(id)
    this.db.prepare(`UPDATE whiteboards SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return this.get(id)
  }

  /** All distinct tags across non-deleted boards. */
  allTags(): Array<{ tag: string; count: number }> {
    const rows = this.db.prepare(`SELECT tags FROM whiteboards WHERE deleted_at IS NULL`).all() as Array<{ tags: string }>
    const counts: Record<string, number> = {}
    for (const r of rows) {
      for (const t of parseTags(r.tags)) counts[t] = (counts[t] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }))
  }

  /** Soft delete: set deleted_at instead of removing the row. */
  softDelete(id: string): boolean {
    const r = this.db.prepare(`UPDATE whiteboards SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`)
      .run(new Date().toISOString(), id)
    return r.changes > 0
  }

  /** Restore from trash. */
  restore(id: string): boolean {
    const r = this.db.prepare(`UPDATE whiteboards SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`).run(id)
    return r.changes > 0
  }

  /** Permanently delete trashed boards older than `daysAgo`. */
  purgeTrashOlderThan(daysAgo: number): number {
    const cutoff = new Date(Date.now() - daysAgo * 86400 * 1000).toISOString()
    const r = this.db.prepare(`DELETE FROM whiteboards WHERE deleted_at IS NOT NULL AND deleted_at < ?`).run(cutoff)
    return r.changes
  }

  /** Duplicate a board (state copied, new id, name="X (copy)"). */
  duplicate(id: string, opts?: { newName?: string; newScope?: WhiteboardScope; newProjectName?: string | null; createdBy?: string }): Whiteboard | undefined {
    const orig = this.get(id)
    if (!orig) return undefined
    return this.create({
      name: opts?.newName || `${orig.name} (copy)`,
      scope: opts?.newScope || orig.scope,
      projectName: opts?.newProjectName !== undefined ? opts.newProjectName : orig.projectName,
      createdBy: opts?.createdBy || orig.createdBy,
      stateJson: orig.stateJson,
      votePool: orig.votePool,
    })
  }

  /** Move a board to a different scope/project. */
  move(id: string, target: { scope?: WhiteboardScope; projectName?: string | null }): Whiteboard | undefined {
    const sets: string[] = []
    const params: any[] = []
    if (target.scope) { sets.push('scope = ?'); params.push(target.scope) }
    if (target.projectName !== undefined) { sets.push('project_name = ?'); params.push(target.projectName) }
    if (!sets.length) return this.get(id)
    sets.push('updated_at = ?')
    params.push(new Date().toISOString(), id)
    this.db.prepare(`UPDATE whiteboards SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return this.get(id)
  }

  /**
   * Save the canvas state with optimistic concurrency.
   * `expectedVersion` must match the current `state_version` or the call throws
   * WhiteboardConcurrencyError so the client can prompt the user to reload.
   */
  saveState(input: {
    id: string
    stateJson: string
    expectedVersion: number
    thumbnailDataUrl?: string | null
  }): Whiteboard {
    const tx = this.db.transaction(() => {
      const current = this.db.prepare(`SELECT state_version FROM whiteboards WHERE id = ?`).get(input.id) as { state_version: number } | undefined
      if (!current) throw new Error('Whiteboard not found')
      if (current.state_version !== input.expectedVersion) {
        throw new WhiteboardConcurrencyError(current.state_version)
      }
      const now = new Date().toISOString()
      this.db.prepare(
        `UPDATE whiteboards
         SET state_json = ?, state_version = state_version + 1, updated_at = ?,
             thumbnail_data_url = COALESCE(?, thumbnail_data_url)
         WHERE id = ?`
      ).run(input.stateJson, now, input.thumbnailDataUrl ?? null, input.id)
    })
    tx()
    return this.get(input.id)!
  }

  /** Update name / vote pool — does NOT bump state_version. */
  updateMeta(id: string, patch: { name?: string; votePool?: number }): Whiteboard | undefined {
    const sets: string[] = []
    const params: any[] = []
    if (patch.name !== undefined) { sets.push('name = ?'); params.push(patch.name) }
    if (patch.votePool !== undefined) { sets.push('vote_pool = ?'); params.push(patch.votePool) }
    if (!sets.length) return this.get(id)
    sets.push('updated_at = ?'); params.push(new Date().toISOString())
    params.push(id)
    this.db.prepare(`UPDATE whiteboards SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    return this.get(id)
  }

  delete(id: string): boolean {
    const r = this.db.prepare(`DELETE FROM whiteboards WHERE id = ?`).run(id)
    return r.changes > 0
  }

  /** Generate (or rotate) the share token for a whiteboard. Returns the new token. */
  enableShare(id: string): string {
    const token = randomId() + randomId()  // 24-char unguessable
    this.db.prepare(`UPDATE whiteboards SET share_token = ? WHERE id = ?`).run(token, id)
    return token
  }

  /** Revoke the share token. */
  disableShare(id: string): void {
    this.db.prepare(`UPDATE whiteboards SET share_token = NULL WHERE id = ?`).run(id)
  }

  /** Look up a whiteboard by its share token (for read-only public access). */
  getByShareToken(token: string): Whiteboard | undefined {
    const row = this.db.prepare(`SELECT * FROM whiteboards WHERE share_token = ?`).get(token) as WhiteboardRow | undefined
    return row ? rowToBoard(row) : undefined
  }

  /** Crude global text search across boards' serialized state. */
  searchAll(query: string, limit = 20): WhiteboardSummary[] {
    const like = `%${query}%`
    const rows = this.db.prepare(
      `SELECT id, name, scope, project_name, created_by, updated_at, thumbnail_data_url
       FROM whiteboards
       WHERE name LIKE ? OR state_json LIKE ?
       ORDER BY updated_at DESC
       LIMIT ?`
    ).all(like, like, limit) as WhiteboardRow[]
    return rows.map(rowToSummary)
  }

  // ── Comments ──

  addComment(input: {
    boardId: string
    nodeId: string
    parentId?: string | null
    authorEmail: string
    body: string
  }): WhiteboardComment {
    const id = randomId()
    const now = new Date().toISOString()
    this.db.prepare(
      `INSERT INTO whiteboard_comments (id, board_id, node_id, parent_id, author_email, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.boardId, input.nodeId, input.parentId ?? null, input.authorEmail, input.body, now)
    return rowToComment(
      this.db.prepare(`SELECT * FROM whiteboard_comments WHERE id = ?`).get(id) as CommentRow
    )
  }

  listComments(boardId: string, nodeId?: string): WhiteboardComment[] {
    const sql = nodeId
      ? `SELECT * FROM whiteboard_comments WHERE board_id = ? AND node_id = ? ORDER BY created_at ASC`
      : `SELECT * FROM whiteboard_comments WHERE board_id = ? ORDER BY created_at ASC`
    const rows = nodeId
      ? this.db.prepare(sql).all(boardId, nodeId) as CommentRow[]
      : this.db.prepare(sql).all(boardId) as CommentRow[]
    return rows.map(rowToComment)
  }

  // ── Snapshots ──

  createSnapshot(input: { boardId: string; reason: 'auto' | 'manual' | 'pre-merge' | 'pre-restore'; createdBy?: string }): string {
    const board = this.get(input.boardId)
    if (!board) throw new Error('Board not found')
    const id = randomId()
    this.db.prepare(
      `INSERT INTO whiteboard_snapshots (id, board_id, state_json, state_version, created_at, created_by, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.boardId, board.stateJson, board.stateVersion, new Date().toISOString(), input.createdBy ?? null, input.reason)
    return id
  }

  listSnapshots(boardId: string, limit = 20): Array<{ id: string; createdAt: string; createdBy: string | null; reason: string; stateVersion: number }> {
    return this.db.prepare(
      `SELECT id, created_at as createdAt, created_by as createdBy, reason, state_version as stateVersion
       FROM whiteboard_snapshots WHERE board_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(boardId, limit) as any[]
  }

  getSnapshot(snapshotId: string): { id: string; boardId: string; stateJson: string; stateVersion: number; createdAt: string } | undefined {
    return this.db.prepare(
      `SELECT id, board_id as boardId, state_json as stateJson, state_version as stateVersion, created_at as createdAt
       FROM whiteboard_snapshots WHERE id = ?`
    ).get(snapshotId) as any
  }

  /** Trim old snapshots beyond N per board. */
  pruneSnapshots(boardId: string, keep = 30): number {
    const r = this.db.prepare(
      `DELETE FROM whiteboard_snapshots
       WHERE board_id = ? AND id NOT IN (
         SELECT id FROM whiteboard_snapshots WHERE board_id = ? ORDER BY created_at DESC LIMIT ?
       )`
    ).run(boardId, boardId, keep)
    return r.changes
  }

  // ── Activity log ──

  recordActivity(input: { boardId: string; userEmail: string; action: string; detail?: string }): void {
    this.db.prepare(
      `INSERT INTO whiteboard_activity (id, board_id, user_email, action, detail)
       VALUES (?, ?, ?, ?, ?)`
    ).run(randomId(), input.boardId, input.userEmail, input.action, input.detail ?? null)
  }

  listActivity(boardId: string, limit = 50): Array<{ id: string; userEmail: string; action: string; detail: string | null; createdAt: string }> {
    return this.db.prepare(
      `SELECT id, user_email as userEmail, action, detail, created_at as createdAt
       FROM whiteboard_activity WHERE board_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(boardId, limit) as any[]
  }

  // ── Notifications ──

  addNotification(input: { userEmail: string; type: 'mention' | 'reply' | 'shared'; boardId?: string; nodeId?: string; body?: string }): string {
    const id = randomId()
    this.db.prepare(
      `INSERT INTO whiteboard_notifications (id, user_email, type, board_id, node_id, body)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.userEmail, input.type, input.boardId ?? null, input.nodeId ?? null, input.body ?? null)
    return id
  }

  listNotifications(userEmail: string, opts: { unreadOnly?: boolean; limit?: number } = {}): Array<{ id: string; type: string; boardId: string | null; nodeId: string | null; body: string | null; createdAt: string; readAt: string | null }> {
    const where = opts.unreadOnly ? 'AND read_at IS NULL' : ''
    return this.db.prepare(
      `SELECT id, type, board_id as boardId, node_id as nodeId, body, created_at as createdAt, read_at as readAt
       FROM whiteboard_notifications WHERE user_email = ? ${where}
       ORDER BY created_at DESC LIMIT ?`
    ).all(userEmail, opts.limit ?? 50) as any[]
  }

  markNotificationRead(id: string, userEmail: string): boolean {
    const r = this.db.prepare(`UPDATE whiteboard_notifications SET read_at = ? WHERE id = ? AND user_email = ? AND read_at IS NULL`)
      .run(new Date().toISOString(), id, userEmail)
    return r.changes > 0
  }

  markAllNotificationsRead(userEmail: string): number {
    const r = this.db.prepare(`UPDATE whiteboard_notifications SET read_at = ? WHERE user_email = ? AND read_at IS NULL`)
      .run(new Date().toISOString(), userEmail)
    return r.changes
  }

  unreadNotificationCount(userEmail: string): number {
    const row = this.db.prepare(`SELECT COUNT(*) as n FROM whiteboard_notifications WHERE user_email = ? AND read_at IS NULL`).get(userEmail) as { n: number }
    return row.n
  }

  // ── Presence (heartbeat-based, async-friendly) ──

  recordHeartbeat(boardId: string, userEmail: string): void {
    this.db.prepare(
      `INSERT INTO whiteboard_presence (board_id, user_email, last_seen)
       VALUES (?, ?, ?)
       ON CONFLICT(board_id, user_email) DO UPDATE SET last_seen = excluded.last_seen`
    ).run(boardId, userEmail, new Date().toISOString())
  }

  /** Active editors are those whose heartbeat is within `windowSeconds`. */
  activeEditors(boardId: string, windowSeconds = 90): Array<{ userEmail: string; lastSeen: string }> {
    const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString()
    return this.db.prepare(
      `SELECT user_email as userEmail, last_seen as lastSeen
       FROM whiteboard_presence WHERE board_id = ? AND last_seen >= ?
       ORDER BY last_seen DESC`
    ).all(boardId, cutoff) as any[]
  }

  // ── Comments (existing) ──

  deleteComment(id: string, requireAuthorEmail?: string): boolean {
    if (requireAuthorEmail) {
      const r = this.db.prepare(`DELETE FROM whiteboard_comments WHERE id = ? AND author_email = ?`)
        .run(id, requireAuthorEmail)
      return r.changes > 0
    }
    const r = this.db.prepare(`DELETE FROM whiteboard_comments WHERE id = ?`).run(id)
    return r.changes > 0
  }
}
