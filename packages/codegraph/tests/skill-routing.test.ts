import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@skillbrain/storage'
import { SkillsStore } from '@skillbrain/storage'

const TEST_KEY = 'b'.repeat(64)

describe('SkillsStore.route() scoring', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    const now = new Date().toISOString()
    for (const name of ['nextjs', 'tailwind', 'payments']) {
      store.upsert({
        name, category: 'Frontend', description: `${name} skill for building apps`,
        content: `Full ${name} guide`, type: 'domain',
        tags: [name], lines: 100, updatedAt: now,
      })
    }
  })

  it('applied actions boost recency higher than loaded actions', () => {
    // Load tailwind 3 times
    for (let i = 0; i < 3; i++) {
      store.recordUsage('tailwind', 'loaded', { sessionId: `s${i}` })
    }
    // Apply nextjs once — should still score higher in recency
    store.recordUsage('nextjs', 'applied', { sessionId: 's0' })

    const results = store.route('building frontend apps', 3)
    const names = results.map((r) => r.name)
    const nextjsIdx = names.indexOf('nextjs')
    const tailwindIdx = names.indexOf('tailwind')
    // nextjs with 1 applied should rank >= tailwind with 3 loaded
    expect(nextjsIdx).toBeLessThanOrEqual(tailwindIdx)
  })

  it('dismissed skills receive a penalty in routing', () => {
    // Record multiple dismissals for tailwind
    store.recordUsage('tailwind', 'dismissed', { sessionId: 's1', task: 'build next app' })
    store.recordUsage('tailwind', 'dismissed', { sessionId: 's2', task: 'build next page' })
    store.recordUsage('tailwind', 'dismissed', { sessionId: 's3', task: 'next frontend' })

    // Both nextjs and tailwind match "building frontend apps"
    const results = store.route('building frontend apps', 3)
    const names = results.map((r) => r.name)

    // tailwind should rank lower due to dismissals
    const nextjsIdx = names.indexOf('nextjs')
    const tailwindIdx = names.indexOf('tailwind')
    expect(nextjsIdx).toBeLessThan(tailwindIdx)
  })

  it('skills in the same category as activeSkills get a boost', () => {
    const now = new Date().toISOString()
    // Add SEO skills
    store.upsert({
      name: 'seo', category: 'SEO', description: 'SEO optimization guide',
      content: 'Full SEO guide for web apps', type: 'domain',
      tags: ['seo'], lines: 200, updatedAt: now,
    })
    store.upsert({
      name: 'seo-technical', category: 'SEO', description: 'Technical SEO for developers',
      content: 'Sitemaps robots crawl budget technical web', type: 'domain',
      tags: ['seo', 'technical'], lines: 150, updatedAt: now,
    })

    // Route with seo as active skill — seo-technical should get category boost
    const results = store.route('improve web performance and crawl', 5, ['seo'])
    const names = results.map((r) => r.name)
    expect(names).toContain('seo-technical')
  })
})

describe('SkillsStore.applyDecay() thresholds', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    const now = new Date().toISOString()
    store.upsert({
      name: 'stale-skill', category: 'Other', description: 'test stale',
      content: '', type: 'domain', tags: [], lines: 0, updatedAt: now,
    })
  })

  it('decays confidence after 5 sessions without validation', () => {
    // Simulate 6 sessions of non-use
    for (let i = 0; i < 6; i++) {
      store.applyDecay([])
    }

    const skill = store.get('stale-skill')
    // Default confidence is 5, after 6 sessions (first decay at session 5):
    // session 1-4: no decay, session 5: -1, session 6: -1 => confidence = 3
    expect(skill!.status).toBe('active')
    // Confidence should have dropped from default 5
    const row = db.prepare('SELECT confidence FROM skills WHERE name = ?').get('stale-skill') as any
    expect(row.confidence).toBeLessThan(5)
  })

  it('deprecates after 20 sessions with low confidence', () => {
    // Lower confidence to 2 first
    db.prepare('UPDATE skills SET confidence = 2 WHERE name = ?').run('stale-skill')

    // Simulate 21 sessions
    for (let i = 0; i < 21; i++) {
      store.applyDecay([])
    }

    const row = db.prepare('SELECT status FROM skills WHERE name = ?').get('stale-skill') as any
    expect(row.status).toBe('deprecated')
  })
})

describe('skill_usage dismissed action persistence', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    store.upsert({
      name: 'test-skill', category: 'Test', description: 'test',
      content: 'test content', type: 'domain',
      tags: ['test'], lines: 1, updatedAt: new Date().toISOString(),
    })
  })

  it('dismissed action is actually persisted in skill_usage table', () => {
    store.recordUsage('test-skill', 'dismissed', { sessionId: 's1' })
    const row = db.prepare("SELECT COUNT(*) as n FROM skill_usage WHERE action = 'dismissed'").get() as { n: number }
    expect(row.n).toBe(1)
  })

  it('applied action is persisted in skill_usage table', () => {
    store.recordUsage('test-skill', 'applied', { sessionId: 's1' })
    const row = db.prepare("SELECT COUNT(*) as n FROM skill_usage WHERE action = 'applied'").get() as { n: number }
    expect(row.n).toBe(1)
  })
})

describe('pending skills excluded from routing', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    const now = new Date().toISOString()
    store.upsert({
      name: 'active-skill', category: 'Frontend', description: 'Active frontend skill',
      content: 'Guide for building frontend apps', type: 'domain',
      tags: ['frontend'], lines: 10, updatedAt: now, status: 'active',
    })
    store.upsert({
      name: 'pending-skill', category: 'Frontend', description: 'Pending frontend skill',
      content: 'Draft guide for building frontend apps', type: 'domain',
      tags: ['frontend'], lines: 10, updatedAt: now, status: 'pending',
    })
  })

  it('route() does not return pending skills', () => {
    const results = store.route('building frontend apps', 10)
    const names = results.map((r) => r.name)
    expect(names).toContain('active-skill')
    expect(names).not.toContain('pending-skill')
  })

  it('search() does not return pending skills', () => {
    const results = store.search('building frontend apps', 10)
    const names = results.map((r) => r.skill.name)
    expect(names).toContain('active-skill')
    expect(names).not.toContain('pending-skill')
  })
})

describe('cooccurrence boosts routing', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    const now = new Date().toISOString()
    store.upsert({
      name: 'react', category: 'Frontend', description: 'generic framework guide for styling component patterns',
      content: 'generic framework guide for styling component patterns', type: 'domain',
      tags: ['react'], lines: 50, updatedAt: now,
    })
    store.upsert({
      name: 'tailwind', category: 'Styling', description: 'generic framework guide for styling component patterns',
      content: 'generic framework guide for styling component patterns', type: 'domain',
      tags: ['tailwind', 'css'], lines: 50, updatedAt: now,
    })
    store.upsert({
      name: 'vue', category: 'Alternatives', description: 'generic framework guide for styling component patterns',
      content: 'generic framework guide for styling component patterns', type: 'domain',
      tags: ['vue'], lines: 50, updatedAt: now,
    })
  })

  it('skills with cooccurrence get a boost when paired skill is active', () => {
    for (let i = 0; i < 50; i++) {
      store.recordCooccurrence('react', 'tailwind')
    }

    const results = store.route('styling components patterns', 5, ['react'])
    const names = results.map((r) => r.name)
    const tailwindIdx = names.indexOf('tailwind')
    const vueIdx = names.indexOf('vue')
    if (tailwindIdx !== -1 && vueIdx !== -1) {
      expect(tailwindIdx).toBeLessThan(vueIdx)
    }
  })
})

describe('project-aware routing', () => {
  let db: Database.Database
  let store: SkillsStore

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    store = new SkillsStore(db)

    const now = new Date().toISOString()
    store.upsert({
      name: 'stripe', category: 'Payments', description: 'Stripe payments integration',
      content: 'Stripe checkout sessions webhooks', type: 'domain',
      tags: ['stripe', 'payments'], lines: 50, updatedAt: now,
    })
    store.upsert({
      name: 'paypal', category: 'Payments', description: 'PayPal payments integration',
      content: 'PayPal checkout sessions webhooks', type: 'domain',
      tags: ['paypal', 'payments'], lines: 50, updatedAt: now,
    })
  })

  it('skills used more in a project rank higher for that project', () => {
    // Simulate stripe being used heavily in webshop project
    for (let i = 0; i < 20; i++) {
      store.recordUsage('stripe', 'applied', { project: 'webshop', sessionId: `s${i}` })
    }

    const results = store.route('payments checkout integration', 5, [], 'webshop')
    const names = results.map((r) => r.name)
    const stripeIdx = names.indexOf('stripe')
    const paypalIdx = names.indexOf('paypal')
    expect(stripeIdx).toBeLessThan(paypalIdx)
  })

  it('project affinity does not affect routing for other projects', () => {
    for (let i = 0; i < 20; i++) {
      store.recordUsage('stripe', 'applied', { project: 'webshop', sessionId: `s${i}` })
    }

    // When routing for a different project, both should be more equal
    const resultsOther = store.route('payments checkout integration', 5, [], 'mobile-app')
    const namesOther = resultsOther.map((r) => r.name)
    // Both should appear (stripe doesn't get project boost for mobile-app)
    expect(namesOther).toContain('stripe')
    expect(namesOther).toContain('paypal')
  })
})
