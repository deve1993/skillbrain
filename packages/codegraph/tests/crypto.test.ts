import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { encrypt, decrypt, isEncryptionAvailable, assertEncryptionUsable } from '@skillbrain/storage'

const TEST_KEY = 'a'.repeat(64) // 32 bytes of 'a' in hex

describe('crypto', () => {
  const originalKey = process.env.ENCRYPTION_KEY

  beforeAll(() => { process.env.ENCRYPTION_KEY = TEST_KEY })
  afterAll(() => { process.env.ENCRYPTION_KEY = originalKey })

  it('roundtrips plaintext through encrypt → decrypt', () => {
    const plain = 'DATABASE_URL=postgres://user:pass@host/db'
    const enc = encrypt(plain)
    expect(enc.ciphertext).not.toBe(plain)
    expect(enc.iv).toBeTruthy()
    expect(enc.authTag).toBeTruthy()
    const dec = decrypt(enc)
    expect(dec).toBe(plain)
  })

  it('uses a fresh IV per call — same plaintext gives different ciphertext', () => {
    const a = encrypt('same')
    const b = encrypt('same')
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('decrypt fails with tampered authTag', () => {
    const enc = encrypt('secret')
    enc.authTag = Buffer.alloc(16, 0).toString('base64') // zero out tag
    expect(() => decrypt(enc)).toThrow()
  })

  it('throws without ENCRYPTION_KEY', () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('x')).toThrow(/ENCRYPTION_KEY/)
    expect(isEncryptionAvailable()).toBe(false)
    process.env.ENCRYPTION_KEY = TEST_KEY
  })

  it('assertEncryptionUsable roundtrips successfully', () => {
    expect(() => assertEncryptionUsable()).not.toThrow()
  })
})
