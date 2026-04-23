import type Database from 'better-sqlite3'

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
        INSERT OR REPLACE INTO skills (name, category, description, content, type, tags, lines, updated_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      get: this.db.prepare('SELECT * FROM skills WHERE name = ?'),
      listAll: this.db.prepare("SELECT name, category, description, type, tags, lines, status FROM skills WHERE status = 'active' ORDER BY category, name"),
      listByType: this.db.prepare("SELECT name, category, description, type, tags, lines, status FROM skills WHERE type = ? AND status = 'active' ORDER BY category, name"),
      listByCategory: this.db.prepare("SELECT name, category, description, type, tags, lines, status FROM skills WHERE category = ? AND status = 'active' ORDER BY name"),
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

  upsert(skill: Skill): void {
    this.stmts.upsert.run(
      skill.name, skill.category, skill.description, skill.content,
      skill.type, JSON.stringify(skill.tags), skill.lines, skill.updatedAt,
      skill.status ?? 'active',
    )
    // Populate FTS
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO skills_fts(rowid, name, description, content, tags)
        VALUES ((SELECT rowid FROM skills WHERE name = ?), ?, ?, ?, ?)
      `).run(skill.name, skill.name, skill.description, skill.content, skill.tags.join(' '))
    } catch { /* FTS can fail silently */ }
  }

  upsertBatch(skills: Skill[]): void {
    const tx = this.db.transaction((items: Skill[]) => {
      for (const s of items) this.upsert(s)
    })
    tx(skills)
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
    }
  }
}
