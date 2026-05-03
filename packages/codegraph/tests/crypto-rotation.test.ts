import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import { runMigrations } from '../src/storage/migrator.js'
import { encrypt, decrypt, rotateKey } from '../src/storage/crypto.js'

const OLD_KEY = 'a'.repeat(64)
const NEW_KEY = 'b'.repeat(64)

function ensureProject(db: Database.Database, name: string) {
  const now = new Date().toISOString()
  db.prepare('INSERT OR IGNORE INTO projects (name, created_at, updated_at) VALUES (?, ?, ?)').run(name, now, now)
}

function insertProjectEnv(db: Database.Database, id: string, project: string, varName: string, plaintext: string) {
  ensureProject(db, project)
  const enc = encrypt(plaintext)
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO project_env_vars (id, project_name, environment, var_name, encrypted_value, iv, auth_tag, created_at, updated_at)
    VALUES (?, ?, 'production', ?, ?, ?, ?, ?, ?)
  `).run(id, project, varName, enc.ciphertext, enc.iv, enc.authTag, now, now)
}

function insertUserEnv(db: Database.Database, id: string, userId: string, varName: string, plaintext: string) {
  const enc = encrypt(plaintext)
  db.prepare(`
    INSERT INTO user_env_vars (id, user_id, var_name, encrypted_value, iv, auth_tag)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, varName, enc.ciphertext, enc.iv, enc.authTag)
}

function createTestUser(db: Database.Database, id = 'user-1') {
  db.prepare('INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)').run(id, 'Test', `${id}@t.com`, 'member')
}

describe('rotateKey', () => {
  let db: Database.Database
  const origKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = OLD_KEY
    db = new Database(':memory:')
    runMigrations(db)
    createTestUser(db)
  })

  afterEach(() => {
    process.env.ENCRYPTION_KEY = origKey
  })

  it('re-encrypts project_env_vars and user_env_vars with new key', () => {
    insertProjectEnv(db, 'pe1', 'myproject', 'DB_URL', 'postgres://secret')
    insertUserEnv(db, 'ue1', 'user-1', 'STRIPE_KEY', 'sk_test_abc')

    const rotated = rotateKey(db, NEW_KEY)
    expect(rotated).toBe(2)

    process.env.ENCRYPTION_KEY = NEW_KEY
    const projRow = db.prepare('SELECT encrypted_value, iv, auth_tag FROM project_env_vars WHERE id = ?').get('pe1') as any
    expect(decrypt({ ciphertext: projRow.encrypted_value, iv: projRow.iv, authTag: projRow.auth_tag })).toBe('postgres://secret')

    const userRow = db.prepare('SELECT encrypted_value, iv, auth_tag FROM user_env_vars WHERE id = ?').get('ue1') as any
    expect(decrypt({ ciphertext: userRow.encrypted_value, iv: userRow.iv, authTag: userRow.auth_tag })).toBe('sk_test_abc')
  })

  it('old key cannot decrypt after rotation', () => {
    insertProjectEnv(db, 'pe1', 'proj', 'KEY', 'secret')
    rotateKey(db, NEW_KEY)

    const row = db.prepare('SELECT encrypted_value, iv, auth_tag FROM project_env_vars WHERE id = ?').get('pe1') as any
    expect(() => decrypt({ ciphertext: row.encrypted_value, iv: row.iv, authTag: row.auth_tag })).toThrow()
  })

  it('rotation is atomic — all rows or none', () => {
    insertProjectEnv(db, 'pe1', 'proj', 'KEY1', 'val1')
    insertProjectEnv(db, 'pe2', 'proj', 'KEY2', 'val2')
    insertUserEnv(db, 'ue1', 'user-1', 'KEY3', 'val3')

    const rotated = rotateKey(db, NEW_KEY)
    expect(rotated).toBe(3)

    process.env.ENCRYPTION_KEY = NEW_KEY
    expect(decrypt(getEncRow(db, 'project_env_vars', 'pe1'))).toBe('val1')
    expect(decrypt(getEncRow(db, 'project_env_vars', 'pe2'))).toBe('val2')
    expect(decrypt(getEncRow(db, 'user_env_vars', 'ue1'))).toBe('val3')
  })

  it('returns 0 when no encrypted rows exist', () => {
    expect(rotateKey(db, NEW_KEY)).toBe(0)
  })

  it('rejects same key as current', () => {
    expect(() => rotateKey(db, OLD_KEY)).toThrow(/identical/)
  })

  it('rejects invalid key format — too short', () => {
    expect(() => rotateKey(db, 'abc')).toThrow(/64 hex chars/)
  })

  it('rejects invalid key format — non-hex', () => {
    expect(() => rotateKey(db, 'g'.repeat(64))).toThrow(/64 hex chars/)
  })

  it('rejects when ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => rotateKey(db, NEW_KEY)).toThrow(/ENCRYPTION_KEY not set/)
  })

  it('handles unicode and special chars in encrypted values', () => {
    const unicodeValue = '密码是: 🔐 café résumé'
    insertProjectEnv(db, 'pe1', 'proj', 'UNICODE', unicodeValue)
    rotateKey(db, NEW_KEY)

    process.env.ENCRYPTION_KEY = NEW_KEY
    expect(decrypt(getEncRow(db, 'project_env_vars', 'pe1'))).toBe(unicodeValue)
  })

  it('handles empty string values', () => {
    insertProjectEnv(db, 'pe1', 'proj', 'EMPTY', '')
    rotateKey(db, NEW_KEY)

    process.env.ENCRYPTION_KEY = NEW_KEY
    expect(decrypt(getEncRow(db, 'project_env_vars', 'pe1'))).toBe('')
  })

  it('handles large values', () => {
    const largeValue = crypto.randomBytes(4096).toString('base64')
    insertProjectEnv(db, 'pe1', 'proj', 'LARGE', largeValue)
    rotateKey(db, NEW_KEY)

    process.env.ENCRYPTION_KEY = NEW_KEY
    expect(decrypt(getEncRow(db, 'project_env_vars', 'pe1'))).toBe(largeValue)
  })
})

function getEncRow(db: Database.Database, table: string, id: string) {
  const row = db.prepare(`SELECT encrypted_value, iv, auth_tag FROM ${table} WHERE id = ?`).get(id) as any
  return { ciphertext: row.encrypted_value, iv: row.iv, authTag: row.auth_tag }
}
