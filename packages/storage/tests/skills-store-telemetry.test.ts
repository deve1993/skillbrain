/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runMigrations } from '../src/migrator.js'
import { SkillsStore } from '../src/skills-store.js'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

function resetTelemetryState(): void {
  ;(SkillsStore as any)._telemetryWarned = false
  ;(SkillsStore as any)._telemetryFailures = 0
}

describe('SkillsStore telemetry', () => {
  beforeEach(() => {
    resetTelemetryState()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetTelemetryState()
  })

  it('warns once and increments telemetryFailures when skill_usage insert fails', () => {
    const db = makeDb()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = new SkillsStore(db)

    try {
      db.exec('DROP TABLE skill_usage')

      store.recordUsage('agent:builder', 'loaded', {
        sessionId: 'session-1',
        project: 'project-1',
        task: 'test task',
        userId: 'user-1',
      })

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(String(warnSpy.mock.calls[0]?.[0] ?? '')).toContain('[skill_usage]')
      expect(SkillsStore.telemetryFailures).toBeGreaterThanOrEqual(1)
    } finally {
      db.close()
    }
  })

  it('keeps telemetryFailures at 0 on the happy path', () => {
    const db = makeDb()

    try {
      const store = new SkillsStore(db)
      store.recordUsage('agent:builder', 'loaded', {
        sessionId: 'session-2',
        project: 'project-2',
        task: 'test task',
        userId: 'user-2',
      })

      expect(SkillsStore.telemetryFailures).toBe(0)
    } finally {
      db.close()
    }
  })
})
