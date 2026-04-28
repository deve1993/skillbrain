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
 * AES-256-GCM encryption wrapper for env vars.
 *
 * Master key from ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * Each value gets a unique random IV (12 bytes).
 * Output: { ciphertext, iv, authTag } all base64-encoded.
 */

import crypto from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12

function getMasterKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) {
    throw new Error('ENCRYPTION_KEY env var not set — required for env var storage')
  }
  if (hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

export interface EncryptedValue {
  ciphertext: string
  iv: string
  authTag: string
}

export function encrypt(plaintext: string): EncryptedValue {
  const key = getMasterKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
}

export function decrypt(encrypted: EncryptedValue): string {
  const key = getMasterKey()
  const iv = Buffer.from(encrypted.iv, 'base64')
  const authTag = Buffer.from(encrypted.authTag, 'base64')
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64')

  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

export function isEncryptionAvailable(): boolean {
  try {
    getMasterKey()
    return true
  } catch {
    return false
  }
}

/**
 * Verify encryption is usable: key set, correct length, and able to
 * encrypt+decrypt a sentinel. Throws with a clear actionable message if not.
 */
export function assertEncryptionUsable(): void {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error(
      'ENCRYPTION_KEY env var not set. Generate one with:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
      'Then set it in your Coolify env vars and redeploy.',
    )
  }
  const sentinel = 'skillbrain-healthcheck'
  const enc = encrypt(sentinel)
  const dec = decrypt(enc)
  if (dec !== sentinel) {
    throw new Error('ENCRYPTION_KEY roundtrip failed — key may be wrong for existing DB')
  }
}
