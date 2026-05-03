/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb } from '../src/storage/db.js'
import { runMigrations } from '../src/storage/migrator.js'
import { SkillsStore } from '../src/storage/skills-store.js'

describe('SkillsStore.gcDeadSkills', () => {
  let dir: string
  let db: any
  let store: SkillsStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-gc-'))
    db = openDb(dir)
    runMigrations(db)
    store = new SkillsStore(db)
  })
  afterEach(() => { closeDb(db); rmSync(dir, { recursive: true, force: true }) })

  it('marks skills as deprecated when routed >= threshold but never loaded', () => {
    store.upsert({ name: 'dead-skill', category: 'Other', description: 'd', content: 'c', type: 'process', tags: [], lines: 1, updatedAt: new Date().toISOString() })
    store.upsert({ name: 'live-skill', category: 'Other', description: 'd', content: 'c', type: 'process', tags: [], lines: 1, updatedAt: new Date().toISOString() })

    // dead-skill: 3 routes, no loads
    for (let i = 0; i < 3; i++) {
      db.prepare("INSERT INTO skill_usage (skill_name, action) VALUES (?, 'routed')").run('dead-skill')
    }
    // live-skill: 1 route + 1 load
    db.prepare("INSERT INTO skill_usage (skill_name, action) VALUES (?, 'routed')").run('live-skill')
    db.prepare("INSERT INTO skill_usage (skill_name, action) VALUES (?, 'loaded')").run('live-skill')

    const result = store.gcDeadSkills({ threshold: 3, days: 30, dryRun: false })
    expect(result.deprecated).toContain('dead-skill')
    expect(result.deprecated).not.toContain('live-skill')

    const dead = db.prepare("SELECT status FROM skills WHERE name = 'dead-skill'").get() as any
    expect(dead.status).toBe('deprecated')
    const live = db.prepare("SELECT status FROM skills WHERE name = 'live-skill'").get() as any
    expect(live.status).toBe('active')
  })

  it('dryRun does not mutate', () => {
    store.upsert({ name: 'dead-x', category: 'Other', description: 'd', content: 'c', type: 'process', tags: [], lines: 1, updatedAt: new Date().toISOString() })
    for (let i = 0; i < 3; i++) {
      db.prepare("INSERT INTO skill_usage (skill_name, action) VALUES (?, 'routed')").run('dead-x')
    }

    const result = store.gcDeadSkills({ threshold: 3, days: 30, dryRun: true })
    expect(result.deprecated).toContain('dead-x')
    const dead = db.prepare("SELECT status FROM skills WHERE name = 'dead-x'").get() as any
    expect(dead.status).toBe('active')
  })

  it('respects the days window — old routes are ignored', () => {
    store.upsert({ name: 'old-route-skill', category: 'Other', description: 'd', content: 'c', type: 'process', tags: [], lines: 1, updatedAt: new Date().toISOString() })
    // 3 routes from 60 days ago
    for (let i = 0; i < 3; i++) {
      db.prepare("INSERT INTO skill_usage (skill_name, action, ts) VALUES (?, 'routed', datetime('now', '-60 days'))").run('old-route-skill')
    }

    const result = store.gcDeadSkills({ threshold: 3, days: 30, dryRun: false })
    expect(result.deprecated).not.toContain('old-route-skill')
  })
})
