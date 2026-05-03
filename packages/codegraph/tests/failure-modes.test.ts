/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

/**
 * Phase 3c – Task 4: Failure mode / edge-input robustness tests (D1-D4)
 *
 * These tests focus on:
 *   D1 – tags with special chars (quotes, newlines) round-trip via FTS
 *   D2 – dismissMemory on non-existent memory id (FK constraint)
 *   D3 – gcDeadSkills with threshold=0 catches all unloaded skills
 *   D4 – runMigrations idempotency (no error on fully-migrated DB)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb } from '@skillbrain/storage'
import { runMigrations } from '@skillbrain/storage'
import { MemoryStore } from '@skillbrain/storage'
import { SkillsStore } from '@skillbrain/storage'

describe('Failure modes – robustness / edge inputs', () => {
  let dir: string
  let db: ReturnType<typeof openDb>
  let store: MemoryStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-failure-'))
    db = openDb(dir)
    runMigrations(db)
    store = new MemoryStore(db)
  })

  afterEach(() => {
    closeDb(db)
    rmSync(dir, { recursive: true, force: true })
  })

  // D1: tags with special chars round-trip and do not break FTS search
  it('D1: tags with special chars round-trip and do not break search', () => {
    const m = store.add({
      type: 'Pattern',
      context: 'edge case test',
      problem: '',
      solution: 's',
      reason: '',
      tags: ["it's", 'with\nnewline', 'with"quotes'],
    })

    // Tags must survive the JSON round-trip through SQLite
    const got = store.get(m.id)
    expect(got?.tags).toEqual(["it's", 'with\nnewline', 'with"quotes'])

    // FTS search must not throw on queries against a DB containing these tags
    expect(() => store.search('edge case', 5)).not.toThrow()
  })

  // D2: dismissMemory on non-existent id must not throw (graceful no-op)
  //
  // Bug found: memory_dismissals has FOREIGN KEY (memory_id) REFERENCES memories(id)
  // and db.ts enables PRAGMA foreign_keys = ON, so inserting a non-existent memory_id
  // would throw SQLITE_CONSTRAINT_FOREIGNKEY.
  // Fix applied: dismissMemory() now checks existence first and no-ops if not found.
  it('D2: dismissMemory on non-existent id does not throw', () => {
    // This memory id does not exist in the DB
    expect(() => store.dismissMemory('M-nonexistent-12345')).not.toThrow()
    // No dismissal row should be recorded
    expect(store.dismissalCount('M-nonexistent-12345')).toBe(0)
  })

  // D3: gcDeadSkills with threshold=0 returns all skills with loaded_count=0
  it('D3: gcDeadSkills with threshold=0 returns all skills with loaded_count=0', () => {
    const skillStore = new SkillsStore(db)
    const now = new Date().toISOString()

    // Seed 3 skills — none have any usage yet
    skillStore.upsert({ name: 's1', category: 'Other', description: '', content: '', type: 'process', tags: [], lines: 1, updatedAt: now })
    skillStore.upsert({ name: 's2', category: 'Other', description: '', content: '', type: 'process', tags: [], lines: 1, updatedAt: now })
    skillStore.upsert({ name: 's3', category: 'Other', description: '', content: '', type: 'process', tags: [], lines: 1, updatedAt: now })

    // s2 has been loaded — s1 and s3 are "dead"
    db.prepare("INSERT INTO skill_usage (skill_name, action) VALUES ('s2', 'loaded')").run()

    // threshold=0 means routed_count >= 0 (always true) AND loaded_count = 0
    // so s1 and s3 (no loads) should appear; s2 (has a load) should not
    const r = skillStore.gcDeadSkills({ threshold: 0, days: 30, dryRun: true })
    expect(r.deprecated).toContain('s1')
    expect(r.deprecated).toContain('s3')
    expect(r.deprecated).not.toContain('s2')
  })

  // D4: runMigrations is idempotent on a fully-migrated DB
  //
  // The migrator tracks applied migrations in schema_migrations table.
  // After all migrations are applied, re-running should be a no-op (no error).
  // We also verify the SQL-level idempotency: DROP memory_dismissals + re-run
  // won't recreate the table (migrator skips already-applied) but also won't error.
  // The CREATE TABLE IF NOT EXISTS clause in 021 makes the SQL itself idempotent
  // if the migrator were to re-run it — but since schema_migrations prevents re-runs,
  // the real guarantee is: calling runMigrations twice never throws.
  it('D4: runMigrations is idempotent — calling it twice does not throw', () => {
    // Should already be fully migrated from beforeEach
    expect(() => runMigrations(db)).not.toThrow()
    // And a third time for good measure
    expect(() => runMigrations(db)).not.toThrow()
  })

  it('D4b: DROP memory_dismissals + runMigrations does not throw (migrator skips already-applied)', () => {
    // Drop the table to simulate partial DB corruption
    db.prepare('DROP TABLE memory_dismissals').run()

    // runMigrations sees 021 as already applied in schema_migrations — skips it.
    // So memory_dismissals won't be recreated, but no error is thrown.
    expect(() => runMigrations(db)).not.toThrow()

    // If we clear the schema_migrations entry and re-run, the table IS recreated.
    db.prepare("DELETE FROM schema_migrations WHERE name = '021_memory_dismissals'").run()
    expect(() => runMigrations(db)).not.toThrow()

    // Now the table should exist again (021 was re-applied)
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='memory_dismissals'"
    ).get()
    expect(tableExists).toBeTruthy()
  })
})
