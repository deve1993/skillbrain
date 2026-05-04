/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

export function vectorToBlob(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength)
}

export function blobToVector(b: Buffer): Float32Array {
  return new Float32Array(b.buffer, b.byteOffset, 384)
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

export class EmbeddingService {
  private static _instance?: EmbeddingService
  private pipeline?: any

  static get(): EmbeddingService {
    if (!EmbeddingService._instance) EmbeddingService._instance = new EmbeddingService()
    return EmbeddingService._instance
  }

  async embed(text: string, kind: 'query' | 'passage'): Promise<Float32Array | null> {
    try {
      if (!this.pipeline) {
        const { pipeline } = await import('@huggingface/transformers')
        this.pipeline = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small')
      }
      const prefix = kind === 'query' ? 'query: ' : 'passage: '
      const out = await this.pipeline(prefix + text, { pooling: 'mean', normalize: true })
      return new Float32Array(out.data)
    } catch (err) {
      console.error('[embedding-service] embed failed', err)
      return null
    }
  }

  async embedMany(texts: string[], kind: 'passage'): Promise<(Float32Array | null)[]> {
    const results: (Float32Array | null)[] = []
    for (const text of texts) {
      results.push(await this.embed(text, kind))
    }
    return results
  }
}
