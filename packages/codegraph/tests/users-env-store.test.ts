import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@skillbrain/storage'
import { UsersEnvStore } from '@skillbrain/storage'

const TEST_KEY = 'c'.repeat(64)

function createTestUser(db: Database.Database, id = 'user-1', name = 'Alice') {
  db.prepare('INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)').run(id, name, `${id}@test.com`, 'member')
}

describe('UsersEnvStore — basic CRUD', () => {
  let db: Database.Database
  let store: UsersEnvStore
  const origKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new UsersEnvStore(db)
  })

  afterEach(() => {
    process.env.ENCRYPTION_KEY = origKey
  })

  it('setEnv + getEnv roundtrips a value through encryption', () => {
    store.setEnv('user-1', 'STRIPE_KEY', 'sk_test_abc123')
    const value = store.getEnv('user-1', 'STRIPE_KEY')
    expect(value).toBe('sk_test_abc123')
  })

  it('setEnv returns metadata with correct fields', () => {
    const meta = store.setEnv('user-1', 'MY_VAR', 'value', {
      category: 'integration',
      service: 'github',
      description: 'GitHub token',
    })
    expect(meta.userId).toBe('user-1')
    expect(meta.varName).toBe('MY_VAR')
    expect(meta.category).toBe('integration')
    expect(meta.service).toBe('github')
    expect(meta.description).toBe('GitHub token')
    expect(meta.source).toBe('manual')
    expect(meta.createdAt).toBeTruthy()
  })

  it('setEnv upserts — second call updates value', () => {
    store.setEnv('user-1', 'KEY', 'v1')
    store.setEnv('user-1', 'KEY', 'v2')
    expect(store.getEnv('user-1', 'KEY')).toBe('v2')
  })

  it('setEnv upsert preserves original id', () => {
    const first = store.setEnv('user-1', 'KEY', 'v1')
    const second = store.setEnv('user-1', 'KEY', 'v2')
    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(first.createdAt)
  })

  it('getEnv returns undefined for non-existent var', () => {
    expect(store.getEnv('user-1', 'NONEXISTENT')).toBeUndefined()
  })

  it('getEnv bumps last_used_at', () => {
    store.setEnv('user-1', 'KEY', 'val')
    store.getEnv('user-1', 'KEY')
    const row = db.prepare('SELECT last_used_at FROM user_env_vars WHERE var_name = ?').get('KEY') as any
    expect(row.last_used_at).toBeTruthy()
  })

  it('deleteEnv removes the var', () => {
    store.setEnv('user-1', 'KEY', 'val')
    expect(store.deleteEnv('user-1', 'KEY')).toBe(true)
    expect(store.getEnv('user-1', 'KEY')).toBeUndefined()
  })

  it('deleteEnv returns false for non-existent var', () => {
    expect(store.deleteEnv('user-1', 'NONEXISTENT')).toBe(false)
  })

  it('hasEnv detects presence', () => {
    store.setEnv('user-1', 'KEY', 'val')
    expect(store.hasEnv('user-1', 'KEY')).toBe(true)
    expect(store.hasEnv('user-1', 'OTHER')).toBe(false)
  })
})

describe('UsersEnvStore — isSecret auto-detection', () => {
  let db: Database.Database
  let store: UsersEnvStore
  const origKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new UsersEnvStore(db)
  })

  afterEach(() => {
    process.env.ENCRYPTION_KEY = origKey
  })

  it('vars starting with NEXT_PUBLIC_ are not secret by default', () => {
    const meta = store.setEnv('user-1', 'NEXT_PUBLIC_SITE_URL', 'https://example.com')
    expect(meta.isSecret).toBe(false)
  })

  it('vars starting with PUBLIC_ are not secret by default', () => {
    const meta = store.setEnv('user-1', 'PUBLIC_API_URL', 'https://api.example.com')
    expect(meta.isSecret).toBe(false)
  })

  it('other vars are secret by default', () => {
    const meta = store.setEnv('user-1', 'STRIPE_SECRET_KEY', 'sk_test_xxx')
    expect(meta.isSecret).toBe(true)
  })

  it('explicit isSecret overrides auto-detection', () => {
    const meta = store.setEnv('user-1', 'NEXT_PUBLIC_THING', 'val', { isSecret: true })
    expect(meta.isSecret).toBe(true)
  })
})

describe('UsersEnvStore — listEnv with filtering', () => {
  let db: Database.Database
  let store: UsersEnvStore
  const origKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    createTestUser(db, 'user-2', 'Bob')
    store = new UsersEnvStore(db)

    store.setEnv('user-1', 'STRIPE_KEY', 'sk_1', { category: 'api_key', service: 'stripe' })
    store.setEnv('user-1', 'GH_TOKEN', 'ghp_1', { category: 'api_key', service: 'github' })
    store.setEnv('user-1', 'THEME', 'dark', { category: 'preference' })
    store.setEnv('user-2', 'STRIPE_KEY', 'sk_2', { category: 'api_key', service: 'stripe' })
  })

  afterEach(() => {
    process.env.ENCRYPTION_KEY = origKey
  })

  it('lists all vars for a user', () => {
    const vars = store.listEnv('user-1')
    expect(vars).toHaveLength(3)
    expect(vars.map(v => v.varName).sort()).toEqual(['GH_TOKEN', 'STRIPE_KEY', 'THEME'])
  })

  it('does not return other users vars', () => {
    const vars = store.listEnv('user-2')
    expect(vars).toHaveLength(1)
    expect(vars[0].varName).toBe('STRIPE_KEY')
  })

  it('filters by category', () => {
    const vars = store.listEnv('user-1', { category: 'preference' })
    expect(vars).toHaveLength(1)
    expect(vars[0].varName).toBe('THEME')
  })

  it('filters by service', () => {
    const vars = store.listEnv('user-1', { service: 'stripe' })
    expect(vars).toHaveLength(1)
    expect(vars[0].varName).toBe('STRIPE_KEY')
  })

  it('listEnv does not expose encrypted values', () => {
    const vars = store.listEnv('user-1')
    for (const v of vars) {
      expect((v as any).encrypted_value).toBeUndefined()
      expect((v as any).iv).toBeUndefined()
      expect((v as any).auth_tag).toBeUndefined()
    }
  })
})

describe('UsersEnvStore — getAllEnv', () => {
  let db: Database.Database
  let store: UsersEnvStore
  const origKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new UsersEnvStore(db)
  })

  afterEach(() => {
    process.env.ENCRYPTION_KEY = origKey
  })

  it('returns decrypted key-value pairs', () => {
    store.setEnv('user-1', 'A', 'val_a')
    store.setEnv('user-1', 'B', 'val_b')
    const all = store.getAllEnv('user-1')
    expect(all).toEqual({ A: 'val_a', B: 'val_b' })
  })

  it('does not bump last_used_at', () => {
    store.setEnv('user-1', 'KEY', 'val')
    store.getAllEnv('user-1')
    const row = db.prepare('SELECT last_used_at FROM user_env_vars WHERE var_name = ?').get('KEY') as any
    expect(row.last_used_at).toBeNull()
  })
})

describe('UsersEnvStore — capability profile', () => {
  let db: Database.Database
  let store: UsersEnvStore
  const origKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new UsersEnvStore(db)
  })

  afterEach(() => {
    process.env.ENCRYPTION_KEY = origKey
  })

  it('reports services and categories', () => {
    store.setEnv('user-1', 'KEY1', 'v', { category: 'api_key', service: 'stripe' })
    store.setEnv('user-1', 'KEY2', 'v', { category: 'api_key', service: 'github' })
    store.setEnv('user-1', 'KEY3', 'v', { category: 'integration', service: 'stripe' })

    const cap = store.capability('user-1')
    expect(cap.services).toEqual(['github', 'stripe'])
    expect(cap.totalVars).toBe(3)
    expect(cap.categories.api_key).toBe(2)
    expect(cap.categories.integration).toBe(1)
  })

  it('empty for user with no vars', () => {
    const cap = store.capability('user-1')
    expect(cap.services).toEqual([])
    expect(cap.totalVars).toBe(0)
  })
})

describe('UsersEnvStore — conflictsWith', () => {
  let db: Database.Database
  let store: UsersEnvStore
  const origKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new UsersEnvStore(db)
  })

  afterEach(() => {
    process.env.ENCRYPTION_KEY = origKey
  })

  it('returns overlapping var names', () => {
    store.setEnv('user-1', 'STRIPE_KEY', 'v')
    store.setEnv('user-1', 'GH_TOKEN', 'v')
    const conflicts = store.conflictsWith('user-1', ['STRIPE_KEY', 'OTHER_VAR'])
    expect(conflicts).toEqual(['STRIPE_KEY'])
  })

  it('returns empty for no overlap', () => {
    store.setEnv('user-1', 'MY_KEY', 'v')
    expect(store.conflictsWith('user-1', ['OTHER'])).toEqual([])
  })

  it('returns empty for empty input', () => {
    store.setEnv('user-1', 'KEY', 'v')
    expect(store.conflictsWith('user-1', [])).toEqual([])
  })
})

describe('UsersEnvStore — importEnv', () => {
  let db: Database.Database
  let store: UsersEnvStore
  const origKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new UsersEnvStore(db)
  })

  afterEach(() => {
    process.env.ENCRYPTION_KEY = origKey
  })

  it('imports .env format content', () => {
    const content = `
# comment
STRIPE_KEY=sk_test_123
GH_TOKEN=ghp_abc

EMPTY_LINE_ABOVE=works
`
    const result = store.importEnv('user-1', content)
    expect(result.saved).toBe(3)
    expect(result.errors).toHaveLength(0)
    expect(store.getEnv('user-1', 'STRIPE_KEY')).toBe('sk_test_123')
    expect(store.getEnv('user-1', 'GH_TOKEN')).toBe('ghp_abc')
    expect(store.getEnv('user-1', 'EMPTY_LINE_ABOVE')).toBe('works')
  })

  it('strips quotes from values', () => {
    const content = `
DOUBLE="hello world"
SINGLE='goodbye world'
`
    store.importEnv('user-1', content)
    expect(store.getEnv('user-1', 'DOUBLE')).toBe('hello world')
    expect(store.getEnv('user-1', 'SINGLE')).toBe('goodbye world')
  })

  it('skips lines without = or empty values', () => {
    const content = `
NOT_A_VAR
EMPTY_VAL=
GOOD=value
`
    const result = store.importEnv('user-1', content)
    expect(result.saved).toBe(1)
    expect(store.getEnv('user-1', 'GOOD')).toBe('value')
  })

  it('sets source from opts', () => {
    store.importEnv('user-1', 'KEY=val', { source: '.env.production' })
    const vars = store.listEnv('user-1')
    expect(vars[0].source).toBe('.env.production')
  })
})

describe('UsersEnvStore — encryption requirement', () => {
  let db: Database.Database
  let store: UsersEnvStore
  const origKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
    store = new UsersEnvStore(db)
  })

  afterEach(() => {
    process.env.ENCRYPTION_KEY = origKey
  })

  it('throws when ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => store.setEnv('user-1', 'KEY', 'val')).toThrow(/ENCRYPTION_KEY/)
  })
})
