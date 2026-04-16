import type Database from 'better-sqlite3'
import { randomId } from '../utils/hash.js'

// ── Session & Notification Types ───────────────────────

export type SessionStatus = 'in-progress' | 'completed' | 'paused' | 'blocked'

export type WorkType = 'feature' | 'fix' | 'setup' | 'deploy' | 'refactor' | 'design' | 'docs' | 'other'

export interface SessionLog {
  id: string
  sessionName: string
  startedAt: string
  endedAt?: string
  summary?: string
  memoriesCreated: number
  memoriesValidated: number
  filesChanged: string[]
  project?: string
  workspacePath?: string
  taskDescription?: string
  status: SessionStatus
  nextSteps?: string
  blockers?: string
  commits: string[]
  branch?: string
  workType?: WorkType
  deliverables?: string
}

export interface Notification {
  id: string
  channel: string
  eventType: string
  payload?: string
  sentAt: string
  success: boolean
  error?: string
  consecutiveFailures: number
}

// ── Types ──────────────────────────────────────────────

export type MemoryType =
  | 'Fact'
  | 'Preference'
  | 'Decision'
  | 'Pattern'
  | 'AntiPattern'
  | 'BugFix'
  | 'Goal'
  | 'Todo'

export type MemoryEdgeType =
  | 'RelatedTo'
  | 'Updates'
  | 'Contradicts'
  | 'CausedBy'
  | 'PartOf'

export type MemoryStatus = 'active' | 'pending-review' | 'deprecated'
export type MemoryScope = 'global' | 'project-specific'

export interface Memory {
  id: string
  type: MemoryType
  status: MemoryStatus
  scope: MemoryScope
  project?: string
  skill?: string
  context: string
  problem: string
  solution: string
  reason: string
  confidence: number
  importance: number
  tags: string[]
  createdAt: string
  updatedAt: string
  lastValidated?: string
  sessionsSinceValidation: number
  validatedBy: string[]
  validUntilVersion?: string
  sourceFile?: string
  sourceSession?: string
  migratedFrom?: string
}

export interface MemoryEdge {
  id: string
  sourceId: string
  targetId: string
  type: MemoryEdgeType
  reason?: string
  createdAt: string
}

export interface MemoryInput {
  type: MemoryType
  scope?: MemoryScope
  project?: string
  skill?: string
  context: string
  problem: string
  solution: string
  reason: string
  confidence?: number
  importance?: number
  tags: string[]
  sourceFile?: string
  sourceSession?: string
  migratedFrom?: string
}

export interface MemoryQuery {
  type?: MemoryType | MemoryType[]
  status?: MemoryStatus
  scope?: MemoryScope
  project?: string
  skill?: string
  minConfidence?: number
  tags?: string[]
  limit?: number
}

export interface MemorySearchResult {
  memory: Memory
  rank: number
  edges: MemoryEdge[]
}

export interface DecayResult {
  reinforced: number
  decayed: number
  pendingReview: number
  deprecated: number
}

// ── Store ──────────────────────────────────────────────

export class MemoryStore {
  private stmts: ReturnType<typeof this.prepareStatements>

  constructor(private db: Database.Database) {
    this.stmts = this.prepareStatements()
  }

  private prepareStatements() {
    return {
      insertMemory: this.db.prepare(`
        INSERT OR REPLACE INTO memories
          (id, type, status, scope, project, skill,
           context, problem, solution, reason,
           confidence, importance, tags,
           created_at, updated_at, last_validated,
           sessions_since_validation, validated_by,
           valid_until_version, source_file, source_session, migrated_from)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      insertEdge: this.db.prepare(`
        INSERT OR IGNORE INTO memory_edges (id, source_id, target_id, type, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      getById: this.db.prepare('SELECT * FROM memories WHERE id = ?'),
      getEdgesFrom: this.db.prepare('SELECT * FROM memory_edges WHERE source_id = ?'),
      getEdgesTo: this.db.prepare('SELECT * FROM memory_edges WHERE target_id = ?'),
      getEdgesBetween: this.db.prepare(`
        SELECT * FROM memory_edges
        WHERE (source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)
      `),
      deleteMemory: this.db.prepare('DELETE FROM memories WHERE id = ?'),
      deleteEdge: this.db.prepare('DELETE FROM memory_edges WHERE id = ?'),
      searchFts: this.db.prepare(`
        SELECT m.*, fts.rank
        FROM memories_fts fts
        JOIN memories m ON m.rowid = fts.rowid
        WHERE memories_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `),
      countByType: this.db.prepare('SELECT type, COUNT(*) as count FROM memories GROUP BY type'),
      countByStatus: this.db.prepare('SELECT status, COUNT(*) as count FROM memories GROUP BY status'),
      allActive: this.db.prepare(`
        SELECT * FROM memories WHERE status = 'active' ORDER BY confidence DESC, updated_at DESC
      `),
      byProject: this.db.prepare(`
        SELECT * FROM memories WHERE (project = ? OR scope = 'global') AND status = 'active'
        ORDER BY confidence DESC LIMIT ?
      `),
      bySkill: this.db.prepare(`
        SELECT * FROM memories WHERE skill = ? AND status = 'active'
        ORDER BY confidence DESC
      `),
      byTags: this.db.prepare(`
        SELECT * FROM memories WHERE status = 'active' AND tags LIKE ?
        ORDER BY confidence DESC LIMIT ?
      `),
      getContradictions: this.db.prepare(`
        SELECT m1.id as id1, m1.context as ctx1, m2.id as id2, m2.context as ctx2,
               e.reason as edge_reason
        FROM memory_edges e
        JOIN memories m1 ON e.source_id = m1.id
        JOIN memories m2 ON e.target_id = m2.id
        WHERE e.type = 'Contradicts'
      `),
      // Decay queries
      reinforceMemory: this.db.prepare(`
        UPDATE memories SET
          confidence = MIN(confidence + 1, 10),
          last_validated = ?,
          sessions_since_validation = 0,
          validated_by = ?,
          updated_at = ?
        WHERE id = ?
      `),
      incrementSessionCount: this.db.prepare(`
        UPDATE memories SET sessions_since_validation = sessions_since_validation + 1
        WHERE id != ? AND status = 'active'
      `),
      applyDecay: this.db.prepare(`
        UPDATE memories SET
          confidence = MAX(confidence - 1, 1),
          updated_at = ?
        WHERE sessions_since_validation >= 5 AND confidence > 1 AND status = 'active'
      `),
      markPendingReview: this.db.prepare(`
        UPDATE memories SET
          status = 'pending-review',
          updated_at = ?
        WHERE sessions_since_validation >= 15 AND status = 'active'
      `),
      markDeprecated: this.db.prepare(`
        UPDATE memories SET
          status = 'deprecated',
          updated_at = ?
        WHERE sessions_since_validation >= 30 AND status = 'pending-review'
      `),
    }
  }

  // ── CRUD ──────────────────────────────────────────

  add(input: MemoryInput): Memory {
    const now = new Date().toISOString()
    const id = `M-${input.type.toLowerCase()}-${randomId()}`
    const memory: Memory = {
      id,
      type: input.type,
      status: 'active',
      scope: input.scope ?? 'global',
      project: input.project,
      skill: input.skill,
      context: input.context,
      problem: input.problem,
      solution: input.solution,
      reason: input.reason,
      confidence: input.confidence ?? 1,
      importance: input.importance ?? 5,
      tags: input.tags,
      createdAt: now,
      updatedAt: now,
      sessionsSinceValidation: 0,
      validatedBy: [],
      sourceFile: input.sourceFile,
      sourceSession: input.sourceSession,
      migratedFrom: input.migratedFrom,
    }

    this.stmts.insertMemory.run(
      memory.id, memory.type, memory.status, memory.scope,
      memory.project ?? null, memory.skill ?? null,
      memory.context, memory.problem, memory.solution, memory.reason,
      memory.confidence, memory.importance, JSON.stringify(memory.tags),
      memory.createdAt, memory.updatedAt, memory.lastValidated ?? null,
      memory.sessionsSinceValidation, JSON.stringify(memory.validatedBy),
      memory.validUntilVersion ?? null, memory.sourceFile ?? null,
      memory.sourceSession ?? null, memory.migratedFrom ?? null,
    )

    // Populate FTS
    this.populateFts(memory)

    return memory
  }

  addEdge(sourceId: string, targetId: string, type: MemoryEdgeType, reason?: string): MemoryEdge {
    const now = new Date().toISOString()
    const id = randomId()
    const edge: MemoryEdge = { id, sourceId, targetId, type, reason, createdAt: now }

    this.stmts.insertEdge.run(id, sourceId, targetId, type, reason ?? null, now)
    return edge
  }

  get(id: string): Memory | undefined {
    const row = this.stmts.getById.get(id) as any
    return row ? this.rowToMemory(row) : undefined
  }

  delete(id: string): void {
    this.stmts.deleteMemory.run(id)
  }

  // ── Query ─────────────────────────────────────────

  query(q: MemoryQuery): Memory[] {
    let sql = 'SELECT * FROM memories WHERE status != \'deprecated\''
    const params: any[] = []

    if (q.status) {
      sql += ' AND status = ?'
      params.push(q.status)
    }

    if (q.type) {
      if (Array.isArray(q.type)) {
        sql += ` AND type IN (${q.type.map(() => '?').join(',')})`
        params.push(...q.type)
      } else {
        sql += ' AND type = ?'
        params.push(q.type)
      }
    }

    if (q.scope) {
      sql += ' AND scope = ?'
      params.push(q.scope)
    }

    if (q.project) {
      sql += ' AND (project = ? OR scope = \'global\')'
      params.push(q.project)
    }

    if (q.skill) {
      sql += ' AND skill = ?'
      params.push(q.skill)
    }

    if (q.minConfidence) {
      sql += ' AND confidence >= ?'
      params.push(q.minConfidence)
    }

    if (q.tags && q.tags.length > 0) {
      for (const tag of q.tags) {
        sql += ' AND tags LIKE ?'
        params.push(`%"${tag}"%`)
      }
    }

    sql += ' ORDER BY confidence DESC, updated_at DESC'

    if (q.limit) {
      sql += ' LIMIT ?'
      params.push(q.limit)
    }

    const rows = this.db.prepare(sql).all(...params) as any[]
    return rows.map(this.rowToMemory)
  }

  search(query: string, limit = 15): MemorySearchResult[] {
    const tokens = query
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1)

    const ftsQuery = tokens.map((w) => `"${w}"`).join(' OR ')

    try {
      const rows = this.stmts.searchFts.all(ftsQuery, limit) as any[]
      return rows.map((r) => {
        const memory = this.rowToMemory(r)
        const edges = this.getEdges(memory.id)
        return { memory, rank: r.rank, edges }
      })
    } catch {
      return []
    }
  }

  getEdges(memoryId: string): MemoryEdge[] {
    const from = (this.stmts.getEdgesFrom.all(memoryId) as any[]).map(this.rowToEdge)
    const to = (this.stmts.getEdgesTo.all(memoryId) as any[]).map(this.rowToEdge)
    return [...from, ...to]
  }

  getContradictions(): { id1: string; ctx1: string; id2: string; ctx2: string; reason?: string }[] {
    return this.stmts.getContradictions.all() as any[]
  }

  // ── Scoring (load-learnings algorithm) ────────────

  scored(project?: string, activeSkills?: string[], limit = 15): MemorySearchResult[] {
    const active = (this.stmts.allActive.all() as any[]).map(this.rowToMemory)

    const scored = active
      .filter((m) => {
        if (m.scope === 'project-specific' && project && m.project !== project) return false
        return true
      })
      .map((m) => {
        let score = m.confidence * 2
        if (m.scope === 'global' || m.project === project) score += 3
        if (m.sessionsSinceValidation <= 5) score += 2
        if (activeSkills?.includes(m.skill ?? '')) score += 2
        score += m.importance * 0.5
        return { memory: m, rank: score, edges: this.getEdges(m.id) }
      })
      .sort((a, b) => b.rank - a.rank)

    return scored.slice(0, limit)
  }

  // ── Decay ─────────────────────────────────────────

  applyDecay(validatedIds: string[], sessionDate: string): DecayResult {
    const now = new Date().toISOString()
    let reinforced = 0

    // Reinforce validated memories
    for (const id of validatedIds) {
      const mem = this.get(id)
      if (!mem) continue
      const newValidatedBy = [...mem.validatedBy, sessionDate]
      this.stmts.reinforceMemory.run(now, JSON.stringify(newValidatedBy), now, id)
      reinforced++
    }

    // Increment session count for all non-validated active memories
    // (we use a placeholder — in practice we'd exclude all validatedIds)
    for (const id of validatedIds) {
      this.stmts.incrementSessionCount.run(id)
    }

    // Apply decay thresholds
    this.stmts.applyDecay.run(now)
    const pendingReview = this.db.prepare(
      `SELECT COUNT(*) as c FROM memories WHERE sessions_since_validation >= 15 AND status = 'active'`
    ).get() as any
    this.stmts.markPendingReview.run(now)

    const deprecatedCount = this.db.prepare(
      `SELECT COUNT(*) as c FROM memories WHERE sessions_since_validation >= 30 AND status = 'pending-review'`
    ).get() as any
    this.stmts.markDeprecated.run(now)

    const decayed = this.db.prepare(
      `SELECT COUNT(*) as c FROM memories WHERE sessions_since_validation >= 5 AND status = 'active'`
    ).get() as any

    return {
      reinforced,
      decayed: decayed?.c ?? 0,
      pendingReview: pendingReview?.c ?? 0,
      deprecated: deprecatedCount?.c ?? 0,
    }
  }

  // ── Contradiction Detection ───────────────────────

  detectContradictions(memory: Memory): Memory[] {
    // Find memories with 2+ overlapping tags
    const candidates = this.query({ status: 'active', tags: memory.tags.slice(0, 2) })
    return candidates.filter((m) => {
      if (m.id === memory.id) return false
      const overlap = m.tags.filter((t) => memory.tags.includes(t))
      return overlap.length >= 2
    })
  }

  // ── Stats ─────────────────────────────────────────

  stats() {
    const byType = (this.stmts.countByType.all() as any[])
      .reduce((acc, r) => ({ ...acc, [r.type]: r.count }), {} as Record<string, number>)
    const byStatus = (this.stmts.countByStatus.all() as any[])
      .reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {} as Record<string, number>)
    const total = (Object.values(byStatus) as number[]).reduce((a, b) => a + b, 0)
    const edgeCount = (this.db.prepare('SELECT COUNT(*) as c FROM memory_edges').get() as any).c

    return { total, byType, byStatus, edges: edgeCount }
  }

  // ── FTS Population ────────────────────────────────

  private populateFts(memory: Memory): void {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO memories_fts(rowid, context, problem, solution, reason, tags)
        VALUES ((SELECT rowid FROM memories WHERE id = ?), ?, ?, ?, ?, ?)
      `).run(
        memory.id,
        memory.context,
        memory.problem,
        memory.solution,
        memory.reason,
        memory.tags.join(' '),
      )
    } catch {
      // FTS insert can fail if memory was just deleted
    }
  }

  // ── Row Mappers ───────────────────────────────────

  private rowToMemory(row: any): Memory {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      scope: row.scope,
      project: row.project ?? undefined,
      skill: row.skill ?? undefined,
      context: row.context,
      problem: row.problem,
      solution: row.solution,
      reason: row.reason,
      confidence: row.confidence,
      importance: row.importance,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastValidated: row.last_validated ?? undefined,
      sessionsSinceValidation: row.sessions_since_validation,
      validatedBy: JSON.parse(row.validated_by || '[]'),
      validUntilVersion: row.valid_until_version ?? undefined,
      sourceFile: row.source_file ?? undefined,
      sourceSession: row.source_session ?? undefined,
      migratedFrom: row.migrated_from ?? undefined,
    }
  }

  private rowToEdge(row: any): MemoryEdge {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      type: row.type,
      reason: row.reason ?? undefined,
      createdAt: row.created_at,
    }
  }

  // ── Session Log ───────────────────────────────────

  startSession(sessionName: string, project?: string, workspacePath?: string, taskDescription?: string, branch?: string): SessionLog {
    const id = `S-${randomId()}`
    const now = new Date().toISOString()
    const session: SessionLog = {
      id, sessionName, startedAt: now, memoriesCreated: 0,
      memoriesValidated: 0, filesChanged: [], project, workspacePath,
      taskDescription, status: 'in-progress', commits: [], branch,
    }
    this.db.prepare(`
      INSERT INTO session_log (id, session_name, started_at, project, workspace_path, task_description, status, branch)
      VALUES (?, ?, ?, ?, ?, ?, 'in-progress', ?)
    `).run(id, sessionName, now, project ?? null, workspacePath ?? null, taskDescription ?? null, branch ?? null)
    return session
  }

  endSession(id: string, summary: string, memoriesCreated: number, memoriesValidated: number, filesChanged: string[], nextSteps?: string, blockers?: string, commits?: string[], status?: SessionStatus, workType?: WorkType, deliverables?: string): void {
    this.db.prepare(`
      UPDATE session_log SET
        ended_at = ?, summary = ?, memories_created = ?, memories_validated = ?,
        files_changed = ?, next_steps = ?, blockers = ?, commits = ?,
        status = ?, work_type = ?, deliverables = ?
      WHERE id = ?
    `).run(
      new Date().toISOString(), summary, memoriesCreated, memoriesValidated,
      JSON.stringify(filesChanged), nextSteps ?? null, blockers ?? null,
      JSON.stringify(commits || []), status || 'completed',
      workType ?? null, deliverables ?? null, id,
    )
  }

  recentSessions(limit = 5): SessionLog[] {
    this.autoCloseStale()
    const rows = this.db.prepare(
      'SELECT * FROM session_log ORDER BY started_at DESC LIMIT ?'
    ).all(limit) as any[]
    return rows.map(this.rowToSession)
  }

  projectSessions(project: string, limit = 10): SessionLog[] {
    this.autoCloseStale()
    const rows = this.db.prepare(
      'SELECT * FROM session_log WHERE project = ? ORDER BY started_at DESC LIMIT ?'
    ).all(project, limit) as any[]
    return rows.map(this.rowToSession)
  }

  lastProjectSession(project: string): SessionLog | undefined {
    this.autoCloseStale()
    const row = this.db.prepare(
      'SELECT * FROM session_log WHERE project = ? ORDER BY started_at DESC LIMIT 1'
    ).get(project) as any
    return row ? this.rowToSession(row) : undefined
  }

  pendingSessions(): SessionLog[] {
    this.autoCloseStale()
    const rows = this.db.prepare(
      "SELECT * FROM session_log WHERE status IN ('in-progress', 'paused', 'blocked') ORDER BY started_at DESC"
    ).all() as any[]
    return rows.map(this.rowToSession)
  }

  // ── Projects (auto-derived from sessions) ──────────

  listProjects(): { name: string; lastSession: any; totalSessions: number; totalMemories: number; memoriesByType: Record<string, number>; lastBranch?: string; blockers?: string }[] {
    // Get all unique projects from sessions
    const sessionStats = this.db.prepare(`
      SELECT project, COUNT(*) as total,
        MAX(started_at) as last_date
      FROM session_log
      WHERE project IS NOT NULL AND project != ''
      GROUP BY project
      ORDER BY last_date DESC
    `).all() as any[]

    return sessionStats.map((ps) => {
      // Last session for this project
      const last = this.db.prepare(
        'SELECT * FROM session_log WHERE project = ? ORDER BY started_at DESC LIMIT 1'
      ).get(ps.project) as any

      // Memory count
      const memCount = this.db.prepare(
        "SELECT COUNT(*) as c FROM memories WHERE project = ? AND status = 'active'"
      ).get(ps.project) as any

      // Memory by type
      const memTypes = this.db.prepare(
        "SELECT type, COUNT(*) as c FROM memories WHERE project = ? AND status = 'active' GROUP BY type"
      ).all(ps.project) as any[]

      return {
        name: ps.project,
        lastSession: last ? {
          date: last.started_at,
          status: last.status || 'completed',
          task: last.task_description,
          nextSteps: last.next_steps,
          summary: last.summary,
        } : null,
        totalSessions: ps.total,
        totalMemories: memCount?.c || 0,
        memoriesByType: memTypes.reduce((acc: any, r: any) => ({ ...acc, [r.type]: r.c }), {}),
        lastBranch: last?.branch ?? undefined,
        blockers: last?.blockers ?? undefined,
      }
    })
  }

  projectDetail(project: string): { name: string; sessions: SessionLog[]; memories: any[]; stats: any } {
    const sessions = this.projectSessions(project, 10)
    const memories = this.query({ project, limit: 20 }).map((m) => ({
      ...m, edges: this.getEdges(m.id),
    }))

    // Also include global memories that mention this project in context
    const searchResults = this.search(project, 10)
    const relatedMemories = searchResults
      .filter((r) => !memories.find((m) => m.id === r.memory.id))
      .map((r) => ({ ...r.memory, edges: r.edges }))

    return {
      name: project,
      sessions,
      memories: [...memories, ...relatedMemories],
      stats: {
        totalSessions: sessions.length,
        totalMemories: memories.length,
        relatedMemories: relatedMemories.length,
      },
    }
  }

  // ── Heartbeat & Auto-Close Stale ──────────────────

  heartbeat(id: string): void {
    this.db.prepare('UPDATE session_log SET last_heartbeat = ? WHERE id = ?')
      .run(new Date().toISOString(), id)
  }

  /**
   * Auto-close sessions with no heartbeat for >staleMinutes.
   * Runs before every session query to keep the data clean.
   */
  autoCloseStale(staleMinutes = 15): number {
    const threshold = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString()
    const now = new Date().toISOString()
    const result = this.db.prepare(`
      UPDATE session_log
      SET status = 'paused',
          ended_at = ?,
          summary = COALESCE(summary, 'Auto-closed (no heartbeat for ' || ? || '+ minutes)')
      WHERE status = 'in-progress'
        AND (last_heartbeat IS NULL OR last_heartbeat < ?)
        AND started_at < ?
    `).run(now, staleMinutes, threshold, threshold)
    return result.changes
  }

  // ── Delete/Update Sessions ────────────────────────

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM session_log WHERE id = ?').run(id)
  }

  updateSession(id: string, fields: Partial<SessionLog>): void {
    const allowed: Record<string, any> = {}
    if (fields.status !== undefined) allowed.status = fields.status
    if (fields.summary !== undefined) allowed.summary = fields.summary
    if (fields.nextSteps !== undefined) allowed.next_steps = fields.nextSteps
    if (fields.blockers !== undefined) allowed.blockers = fields.blockers
    if (fields.deliverables !== undefined) allowed.deliverables = fields.deliverables
    if (fields.workType !== undefined) allowed.work_type = fields.workType
    if (fields.taskDescription !== undefined) allowed.task_description = fields.taskDescription

    const keys = Object.keys(allowed)
    if (keys.length === 0) return

    const setClauses = keys.map((k) => `${k} = ?`).join(', ')
    const values = keys.map((k) => allowed[k])
    this.db.prepare(`UPDATE session_log SET ${setClauses} WHERE id = ?`).run(...values, id)
  }

  // ── Update Memory ─────────────────────────────────

  updateMemory(id: string, fields: { confidence?: number; status?: MemoryStatus; context?: string; problem?: string; solution?: string; reason?: string; tags?: string[] }): void {
    const allowed: Record<string, any> = {}
    if (fields.confidence !== undefined) allowed.confidence = fields.confidence
    if (fields.status !== undefined) allowed.status = fields.status
    if (fields.context !== undefined) allowed.context = fields.context
    if (fields.problem !== undefined) allowed.problem = fields.problem
    if (fields.solution !== undefined) allowed.solution = fields.solution
    if (fields.reason !== undefined) allowed.reason = fields.reason
    if (fields.tags !== undefined) allowed.tags = JSON.stringify(fields.tags)

    const keys = Object.keys(allowed)
    if (keys.length === 0) return

    const setClauses = keys.map((k) => `${k} = ?`).join(', ')
    const values = keys.map((k) => allowed[k])
    this.db.prepare(`UPDATE memories SET ${setClauses}, updated_at = ? WHERE id = ?`).run(
      ...values, new Date().toISOString(), id,
    )

    // Update FTS if content changed
    if (fields.context || fields.problem || fields.solution || fields.reason) {
      const mem = this.get(id)
      if (mem) {
        try {
          this.db.prepare(`
            INSERT OR REPLACE INTO memories_fts(rowid, context, problem, solution, reason, tags)
            VALUES ((SELECT rowid FROM memories WHERE id = ?), ?, ?, ?, ?, ?)
          `).run(id, mem.context, mem.problem, mem.solution, mem.reason, mem.tags.join(' '))
        } catch {}
      }
    }
  }

  workLog(): Record<string, { entries: any[]; totalEntries: number }> {
    const sessions = this.db.prepare(`
      SELECT * FROM session_log
      WHERE project IS NOT NULL AND project != ''
        AND (deliverables IS NOT NULL OR summary IS NOT NULL)
      ORDER BY started_at DESC
    `).all() as any[]

    const byProject: Record<string, any[]> = {}
    for (const s of sessions) {
      const proj = s.project
      if (!byProject[proj]) byProject[proj] = []
      byProject[proj].push({
        date: s.started_at?.split('T')[0] || '',
        type: s.work_type || 'other',
        deliverable: s.deliverables || s.summary || 'No description',
        commits: JSON.parse(s.commits || '[]').length,
        files: JSON.parse(s.files_changed || '[]').length,
        branch: s.branch,
        status: s.status || 'completed',
        nextSteps: s.next_steps,
        sessionName: s.session_name,
      })
    }

    const result: Record<string, { entries: any[]; totalEntries: number }> = {}
    for (const [proj, entries] of Object.entries(byProject)) {
      result[proj] = { entries, totalEntries: entries.length }
    }
    return result
  }

  private rowToSession(r: any): SessionLog {
    return {
      id: r.id, sessionName: r.session_name, startedAt: r.started_at,
      endedAt: r.ended_at ?? undefined, summary: r.summary ?? undefined,
      memoriesCreated: r.memories_created, memoriesValidated: r.memories_validated,
      filesChanged: JSON.parse(r.files_changed || '[]'),
      project: r.project ?? undefined, workspacePath: r.workspace_path ?? undefined,
      taskDescription: r.task_description ?? undefined,
      status: r.status || 'completed',
      nextSteps: r.next_steps ?? undefined,
      blockers: r.blockers ?? undefined,
      commits: JSON.parse(r.commits || '[]'),
      branch: r.branch ?? undefined,
      workType: r.work_type ?? undefined,
      deliverables: r.deliverables ?? undefined,
    }
  }

  // ── Notifications ─────────────────────────────────

  logNotification(channel: string, eventType: string, success: boolean, payload?: string, error?: string): void {
    const id = randomId()
    const now = new Date().toISOString()

    // Get consecutive failures for this channel
    const last = this.db.prepare(
      'SELECT consecutive_failures, success FROM notifications WHERE channel = ? ORDER BY sent_at DESC LIMIT 1'
    ).get(channel) as any

    const failures = success ? 0 : (last?.consecutive_failures ?? 0) + 1

    this.db.prepare(`
      INSERT INTO notifications (id, channel, event_type, payload, sent_at, success, error, consecutive_failures)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, channel, eventType, payload ?? null, now, success ? 1 : 0, error ?? null, failures)
  }

  isChannelCircuitBroken(channel: string): boolean {
    const last = this.db.prepare(
      'SELECT consecutive_failures FROM notifications WHERE channel = ? ORDER BY sent_at DESC LIMIT 1'
    ).get(channel) as any
    return (last?.consecutive_failures ?? 0) >= 3
  }
}
