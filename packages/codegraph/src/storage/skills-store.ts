import type Database from 'better-sqlite3'
import { openDb, closeDb } from './db.js'

export type SkillType = 'domain' | 'lifecycle' | 'process' | 'agent' | 'command'

export interface Skill {
  name: string
  category: string
  description: string
  content: string
  type: SkillType
  tags: string[]
  lines: number
  updatedAt: string
  status?: 'active' | 'pending' | 'deprecated'
  createdByUserId?: string
  updatedByUserId?: string
}

export interface SkillVersion {
  id: string
  skillName: string
  versionNumber: number
  content: string
  description: string
  category: string
  tags: string[]
  changedBy: string | null
  changeReason: string
  createdAt: string
}

export interface SkillUpsertOptions {
  changedBy?: string
  reason?: string
  expectedUpdatedAt?: string
}

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConcurrencyError'
  }
}

export interface SkillSearchResult {
  skill: Skill
  rank: number
}

export class SkillsStore {
  private stmts: ReturnType<typeof this.prepareStatements>

  constructor(private db: Database.Database) {
    this.stmts = this.prepareStatements()
  }

  private prepareStatements() {
    return {
      upsert: this.db.prepare(`
        INSERT OR REPLACE INTO skills (name, category, description, content, type, tags, lines, updated_at, status, created_by_user_id, updated_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_by_user_id FROM skills WHERE name = ?), ?), ?)
      `),
      get: this.db.prepare('SELECT * FROM skills WHERE name = ?'),
      getUpdatedAt: this.db.prepare('SELECT updated_at FROM skills WHERE name = ?'),
      listAll: this.db.prepare("SELECT name, category, description, type, tags, lines, status, updated_at, created_by_user_id FROM skills WHERE status = 'active' ORDER BY category, name"),
      listByType: this.db.prepare("SELECT name, category, description, type, tags, lines, status, updated_at, created_by_user_id FROM skills WHERE type = ? AND status = 'active' ORDER BY category, name"),
      listByCategory: this.db.prepare("SELECT name, category, description, type, tags, lines, status, updated_at, created_by_user_id FROM skills WHERE category = ? AND status = 'active' ORDER BY name"),
      searchFts: this.db.prepare(`
        SELECT s.*, fts.rank
        FROM skills_fts fts
        JOIN skills s ON s.rowid = fts.rowid
        WHERE skills_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `),
      countByType: this.db.prepare('SELECT type, COUNT(*) as count FROM skills GROUP BY type'),
      countByCategory: this.db.prepare('SELECT category, COUNT(*) as count FROM skills GROUP BY category ORDER BY count DESC'),
      total: this.db.prepare('SELECT COUNT(*) as count FROM skills'),
      deleteAll: this.db.prepare('DELETE FROM skills'),
    }
  }

  upsert(skill: Skill, options: SkillUpsertOptions = {}): void {
    const { changedBy, reason = 'manual', expectedUpdatedAt } = options

    if (expectedUpdatedAt) {
      const row = this.stmts.getUpdatedAt.get(skill.name) as { updated_at: string } | undefined
      if (row && row.updated_at !== expectedUpdatedAt) {
        throw new ConcurrencyError('Skill modificata da altro utente, ricarica e riprova')
      }
    }

    this.stmts.upsert.run(
      skill.name, skill.category, skill.description, skill.content,
      skill.type, JSON.stringify(skill.tags), skill.lines, skill.updatedAt,
      skill.status ?? 'active',
      skill.name, skill.createdByUserId ?? null,
      changedBy ?? null,
    )

    this.saveVersion(skill, changedBy ?? null, reason)

    // Populate FTS
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO skills_fts(rowid, name, description, content, tags)
        VALUES ((SELECT rowid FROM skills WHERE name = ?), ?, ?, ?, ?)
      `).run(skill.name, skill.name, skill.description, skill.content, skill.tags.join(' '))
    } catch { /* FTS can fail silently */ }
  }

  upsertBatch(skills: Skill[], options: SkillUpsertOptions = {}): void {
    const tx = this.db.transaction((items: Skill[]) => {
      for (const s of items) this.upsert(s, options)
    })
    tx(skills)
  }

  private saveVersion(skill: Skill, changedBy: string | null, reason: string): void {
    try {
      const maxRow = this.db.prepare(
        `SELECT MAX(version_number) as max FROM skill_versions WHERE skill_name = ?`
      ).get(skill.name) as { max: number | null } | undefined
      const nextVersion = (maxRow?.max ?? 0) + 1
      const id = `SV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      this.db.prepare(`
        INSERT INTO skill_versions (id, skill_name, version_number, content, description, category, tags, changed_by, change_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, skill.name, nextVersion, skill.content,
        skill.description, skill.category,
        JSON.stringify(skill.tags ?? []),
        changedBy, reason,
      )
    } catch { /* skill_versions table may not exist yet */ }
  }

  listVersions(skillName: string): SkillVersion[] {
    try {
      const rows = this.db.prepare(
        `SELECT * FROM skill_versions WHERE skill_name = ? ORDER BY version_number DESC`
      ).all(skillName) as any[]
      return rows.map(this.rowToVersion)
    } catch { return [] }
  }

  getVersion(versionId: string): SkillVersion | null {
    try {
      const row = this.db.prepare(`SELECT * FROM skill_versions WHERE id = ?`).get(versionId) as any
      return row ? this.rowToVersion(row) : null
    } catch { return null }
  }

  rollback(skillName: string, versionId: string, changedBy: string): Skill {
    const version = this.getVersion(versionId)
    if (!version) throw new Error(`Version ${versionId} not found`)

    const existing = this.get(skillName)
    if (!existing) throw new Error(`Skill ${skillName} not found`)

    const now = new Date().toISOString()
    const rolledBack: Skill = {
      ...existing,
      content: version.content,
      description: version.description || existing.description,
      category: version.category || existing.category,
      tags: version.tags.length ? version.tags : existing.tags,
      lines: version.content.split('\n').length,
      updatedAt: now,
      updatedByUserId: changedBy,
    }

    this.upsert(rolledBack, { changedBy, reason: 'rollback' })
    return rolledBack
  }

  get(name: string): Skill | undefined {
    const row = this.stmts.get.get(name) as any
    return row ? this.rowToSkill(row) : undefined
  }

  list(type?: SkillType, category?: string): Skill[] {
    let rows: any[]
    if (category) {
      rows = this.stmts.listByCategory.all(category) as any[]
    } else if (type) {
      rows = this.stmts.listByType.all(type) as any[]
    } else {
      rows = this.stmts.listAll.all() as any[]
    }
    return rows.map(this.rowToSkill)
  }

  search(query: string, limit = 10): SkillSearchResult[] {
    const tokens = query
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1)

    const ftsQuery = tokens.map((w) => `"${w}"`).join(' OR ')

    try {
      const rows = this.stmts.searchFts.all(ftsQuery, limit) as any[]
      return rows.map((r) => ({ skill: this.rowToSkill(r), rank: r.rank }))
    } catch {
      return []
    }
  }

  route(taskDescription: string, limit = 5): Skill[] {
    const results = this.search(taskDescription, limit)
    return results.map((r) => r.skill)
  }

  stats() {
    const total = (this.stmts.total.get() as any).count
    const byType = (this.stmts.countByType.all() as any[])
      .reduce((acc, r) => ({ ...acc, [r.type]: r.count }), {} as Record<string, number>)
    const byCategory = (this.stmts.countByCategory.all() as any[])
      .reduce((acc, r) => ({ ...acc, [r.category]: r.count }), {} as Record<string, number>)
    return { total, byType, byCategory }
  }

  private rowToSkill(row: any): Skill {
    return {
      name: row.name,
      category: row.category,
      description: row.description,
      content: row.content ?? '',
      type: row.type,
      tags: JSON.parse(row.tags || '[]'),
      lines: row.lines,
      updatedAt: row.updated_at,
      status: row.status ?? 'active',
      createdByUserId: row.created_by_user_id ?? undefined,
      updatedByUserId: row.updated_by_user_id ?? undefined,
    }
  }

  private rowToVersion(row: any): SkillVersion {
    return {
      id: row.id,
      skillName: row.skill_name,
      versionNumber: row.version_number,
      content: row.content,
      description: row.description ?? '',
      category: row.category ?? '',
      tags: JSON.parse(row.tags || '[]'),
      changedBy: row.changed_by ?? null,
      changeReason: row.change_reason ?? 'manual',
      createdAt: row.created_at,
    }
  }
}

export function withSkillsStore<T>(repoPath: string, fn: (store: SkillsStore) => T): T {
  const db = openDb(repoPath)
  const store = new SkillsStore(db)
  try {
    return fn(store)
  } finally {
    closeDb(db)
  }
}
