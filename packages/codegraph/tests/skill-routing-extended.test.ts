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
 * Skill Routing Scoring Matrix — Extended Tests (A1–A6)
 *
 * Covers the scoring formula:
 *   score = 0.38*bm25Norm + 0.15*confidence + 0.12*recencyBoost
 *           + 0.10*coocBoost + 0.10*projectAffinity
 *           + categoryBoost - dismissalPenalty
 *
 * Each test isolates one signal to verify it works as expected,
 * while keeping all other signals equal between the two competing skills.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@skillbrain/storage'
import { SkillsStore } from '@skillbrain/storage'

const TEST_KEY = 'b'.repeat(64)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal active skill with identical text corpus for BM25 parity.
 * Both skills must be lexically indistinguishable so BM25 doesn't favor either.
 */
function makeSkill(name: string, category: string, overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString()
  return {
    name,
    category,
    // Identical description and content so BM25 rank is equal for both skills
    description: 'generic skill for building web applications and services',
    content: 'Guide for building web applications and services with modern tooling',
    type: 'domain' as const,
    tags: ['web'],
    lines: 100,
    updatedAt: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// A1: applied × 3 in recency boosts skill above peer with only loaded actions
// ---------------------------------------------------------------------------

describe('A1: recency signal — applied × 3 boosts skill above peer with only loaded', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    store.upsert(makeSkill('skill-x', 'Web'))
    store.upsert(makeSkill('skill-y', 'Web'))
  })

  it('applied × 3 boosts skill above peer with only loaded actions', () => {
    // skill-x: 5 applied actions — each counts × 3 in the recency formula
    for (let i = 0; i < 5; i++) {
      store.recordUsage('skill-x', 'applied', { sessionId: `sx-${i}` })
    }
    // skill-y: 5 loaded actions — counts × 1 in the recency formula
    for (let i = 0; i < 5; i++) {
      store.recordUsage('skill-y', 'loaded', { sessionId: `sy-${i}` })
    }

    // Both skills have identical BM25 to this query (same corpus).
    // Only recency differs: skill-x has applied, skill-y has loaded only.
    const results = store.route('building web applications', 5)
    const names = results.map((r) => r.name)

    expect(names).toContain('skill-x')
    expect(names).toContain('skill-y')

    const xIdx = names.indexOf('skill-x')
    const yIdx = names.indexOf('skill-y')
    // skill-x recency = log1p(0 + 5*3) = log1p(15) ≈ 2.77
    // skill-y recency = log1p(5 + 0) = log1p(5) ≈ 1.79
    // skill-x should rank above skill-y
    expect(xIdx).toBeLessThan(yIdx)
  })
})

// ---------------------------------------------------------------------------
// A2: categoryBoost +0.15 favors skills in active-skill category cluster
// ---------------------------------------------------------------------------

describe('A2: categoryBoost — favors skills in active-skill category cluster', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    // frontend-x is in the Frontend category
    store.upsert(makeSkill('frontend-x', 'Frontend', {
      description: 'generic skill for building web applications and services',
      content: 'Guide for building web applications and services with modern tooling',
    }))
    // backend-x is in the Backend category
    store.upsert(makeSkill('backend-x', 'Backend', {
      description: 'generic skill for building web applications and services',
      content: 'Guide for building web applications and services with modern tooling',
    }))
    // The active skill that establishes the Frontend category cluster
    store.upsert(makeSkill('active-frontend', 'Frontend', {
      description: 'active frontend skill web applications services',
      content: 'Active frontend guide for web applications and services',
    }))
  })

  it('categoryBoost favors skills in active-skill category cluster', () => {
    // Route with 'active-frontend' as the active skill.
    // active-frontend is in the Frontend category, so frontend-x gets +0.15 categoryBoost.
    // backend-x gets 0 categoryBoost.
    // All other signals are equal (identical corpus, no usage, no project).
    const results = store.route('building web applications and services', 5, ['active-frontend'])
    const names = results.map((r) => r.name)

    expect(names).toContain('frontend-x')
    expect(names).toContain('backend-x')

    const frontendIdx = names.indexOf('frontend-x')
    const backendIdx = names.indexOf('backend-x')
    // frontend-x should rank above backend-x due to +0.15 categoryBoost
    expect(frontendIdx).toBeLessThan(backendIdx)
  })
})

// ---------------------------------------------------------------------------
// A3: dismissalPenalty saturates at cap (0.20)
// ---------------------------------------------------------------------------

describe('A3: dismissalPenalty — saturates at the 0.20 cap', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    store.upsert(makeSkill('skill-x', 'Web'))
    store.upsert(makeSkill('skill-y', 'Web'))
    // skill-z has no dismissals — control to confirm capped skills sink equally
    store.upsert(makeSkill('skill-z', 'Web'))
  })

  it('dismissalPenalty saturates at the 0.20 cap', () => {
    // skill-x: 4 dismissals → penalty = 4 × 0.05 = 0.20 (at cap)
    for (let i = 0; i < 4; i++) {
      store.recordUsage('skill-x', 'dismissed', { sessionId: `dx-${i}` })
    }
    // skill-y: 10 dismissals → penalty = min(10 × 0.05, 0.20) = 0.20 (also at cap)
    for (let i = 0; i < 10; i++) {
      store.recordUsage('skill-y', 'dismissed', { sessionId: `dy-${i}` })
    }
    // skill-z: 0 dismissals — should rank above both x and y

    const results = store.route('building web applications', 5)
    const names = results.map((r) => r.name)

    expect(names).toContain('skill-x')
    expect(names).toContain('skill-y')
    expect(names).toContain('skill-z')

    // Both x and y are at the dismissal cap (0.20), so they share the same
    // dismissalPenalty contribution. Their relative order should NOT change
    // based on dismissals alone — i.e., skill-y (10 dismissals) should NOT
    // sink further below skill-x (4 dismissals).
    const xIdx = names.indexOf('skill-x')
    const yIdx = names.indexOf('skill-y')
    // The absolute rank difference between x and y should be at most 1
    // (any tie-breaking is BM25 noise, not dismissal-driven sinking of y)
    expect(Math.abs(xIdx - yIdx)).toBeLessThanOrEqual(1)

    // skill-z (0 dismissals) should rank above both capped skills
    const zIdx = names.indexOf('skill-z')
    expect(zIdx).toBeLessThan(Math.max(xIdx, yIdx))
  })
})

// ---------------------------------------------------------------------------
// A4: projectAffinity boosts same-project skills
// ---------------------------------------------------------------------------

describe('A4: projectAffinity — boosts same-project skills', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    store.upsert(makeSkill('skill-x', 'Web'))
    store.upsert(makeSkill('skill-y', 'Web'))
  })

  it('projectAffinity boosts same-project skills', () => {
    // skill-x: used 5× in project 'P' (loaded/applied count for affinity)
    for (let i = 0; i < 5; i++) {
      store.recordUsage('skill-x', 'applied', { project: 'P', sessionId: `px-${i}` })
    }
    // skill-y: used 5× in project 'Q' — NOT in project 'P'
    for (let i = 0; i < 5; i++) {
      store.recordUsage('skill-y', 'applied', { project: 'Q', sessionId: `py-${i}` })
    }

    // Route for project 'P': skill-x should get projectAffinity boost
    // Note: both skills have applied actions so recency is equal
    // The tiebreaker is projectAffinity: skill-x scores higher for project 'P'
    const results = store.route('building web applications', 5, [], 'P')
    const names = results.map((r) => r.name)

    expect(names).toContain('skill-x')
    expect(names).toContain('skill-y')

    const xIdx = names.indexOf('skill-x')
    const yIdx = names.indexOf('skill-y')
    // skill-x should rank above skill-y when routing for project 'P'
    expect(xIdx).toBeLessThan(yIdx)
  })
})

// ---------------------------------------------------------------------------
// A5: All skills dismissed → route still returns results (no crash)
// ---------------------------------------------------------------------------

describe('A5: all skills dismissed — stable result without crash', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    // Three skills with slightly different descriptions so FTS can distinguish them
    store.upsert({
      name: 'skill-alpha',
      category: 'Web',
      description: 'alpha skill for building web applications and services',
      content: 'Comprehensive alpha guide for web application development and services',
      type: 'domain',
      tags: ['alpha', 'web'],
      lines: 100,
      updatedAt: new Date().toISOString(),
    })
    store.upsert({
      name: 'skill-beta',
      category: 'Web',
      description: 'beta skill for building web applications and services',
      content: 'Comprehensive beta guide for web application development and services',
      type: 'domain',
      tags: ['beta', 'web'],
      lines: 100,
      updatedAt: new Date().toISOString(),
    })
    store.upsert({
      name: 'skill-gamma',
      category: 'Web',
      description: 'gamma skill for building web applications and services',
      content: 'Comprehensive gamma guide for web application development and services',
      type: 'domain',
      tags: ['gamma', 'web'],
      lines: 100,
      updatedAt: new Date().toISOString(),
    })
  })

  it('all skills dismissed: route returns ordered results without crashing', () => {
    // Dismiss each skill 4+ times (reaches the 0.20 penalty cap)
    for (const name of ['skill-alpha', 'skill-beta', 'skill-gamma']) {
      for (let i = 0; i < 5; i++) {
        store.recordUsage(name, 'dismissed', { sessionId: `d-${name}-${i}` })
      }
    }

    // route() must not throw and must return at least some results
    let results: ReturnType<typeof store.route>
    expect(() => {
      results = store.route('building web application alpha beta gamma', 5)
    }).not.toThrow()

    // @ts-ignore — assigned inside expect callback
    expect(results!.length).toBeGreaterThan(0)

    // All three skills should still appear (dismissal penalty is capped,
    // not a total exclusion — only pending/deprecated are excluded)
    // @ts-ignore
    const names = results!.map((r: { name: string }) => r.name)
    expect(names).toContain('skill-alpha')
    expect(names).toContain('skill-beta')
    expect(names).toContain('skill-gamma')
  })
})

// ---------------------------------------------------------------------------
// A6: activeSkills=[] does not break category boost path
// ---------------------------------------------------------------------------

describe('A6: activeSkills=[] does not crash route()', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    store.upsert(makeSkill('some-skill', 'Web'))
    store.upsert(makeSkill('another-skill', 'Backend'))
  })

  it('activeSkills=[] does not crash route()', () => {
    // The categoryBoost path has an early return when activeSkills is empty.
    // This test ensures the guard works and the result is valid.
    let results: ReturnType<typeof store.route>

    expect(() => {
      results = store.route('building web applications', 5, [])
    }).not.toThrow()

    // @ts-ignore — assigned inside expect callback
    expect(Array.isArray(results!)).toBe(true)
    // @ts-ignore
    expect(results!.length).toBeGreaterThanOrEqual(1)
  })

  it('activeSkills=[] with no project does not crash route()', () => {
    // Explicitly pass undefined project — no affinity signal, no category signal
    let results: ReturnType<typeof store.route>

    expect(() => {
      results = store.route('building web applications', 5, [], undefined)
    }).not.toThrow()

    // @ts-ignore
    expect(Array.isArray(results!)).toBe(true)
  })
})
