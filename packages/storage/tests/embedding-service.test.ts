/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { describe, it, expect } from 'vitest'
import { vectorToBlob, blobToVector, cosine, EmbeddingService } from '../src/embedding-service.js'

describe('vectorToBlob / blobToVector', () => {
  it('round-trips a Float32Array through Buffer and back', () => {
    const original = new Float32Array(384)
    for (let i = 0; i < 384; i++) original[i] = Math.random()
    const buf = vectorToBlob(original)
    const restored = blobToVector(buf)
    expect(restored.length).toBe(384)
    for (let i = 0; i < 384; i++) {
      expect(restored[i]).toBeCloseTo(original[i], 5)
    }
  })
})

describe('cosine', () => {
  it('returns ~1.0 for identical normalized vectors', () => {
    const v = new Float32Array(384).fill(1 / Math.sqrt(384))
    expect(cosine(v, v)).toBeCloseTo(1.0, 4)
  })

  it('returns 0.0 for orthogonal vectors', () => {
    const a = new Float32Array(384)
    const b = new Float32Array(384)
    a[0] = 1
    b[1] = 1
    expect(cosine(a, b)).toBe(0)
  })
})

describe('EmbeddingService singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = EmbeddingService.get()
    const b = EmbeddingService.get()
    expect(a).toBe(b)
  })
})
