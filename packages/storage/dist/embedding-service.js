/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */
export function vectorToBlob(v) {
    return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}
export function blobToVector(b) {
    return new Float32Array(b.buffer, b.byteOffset, 384);
}
export function cosine(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++)
        s += a[i] * b[i];
    return s;
}
export class EmbeddingService {
    static _instance;
    static _disabled = false;
    pipeline;
    static get() {
        if (!EmbeddingService._instance)
            EmbeddingService._instance = new EmbeddingService();
        return EmbeddingService._instance;
    }
    static async warmup() {
        if (EmbeddingService._disabled)
            return;
        try {
            await EmbeddingService.get().embed('warmup', 'query');
        }
        catch {
            // Ignore warmup failures; embed() already handles fallback behavior.
        }
    }
    async embed(text, kind) {
        if (EmbeddingService._disabled)
            return null;
        try {
            if (!this.pipeline) {
                try {
                    const { pipeline } = await import('@huggingface/transformers');
                    this.pipeline = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
                }
                catch {
                    EmbeddingService._disabled = true;
                    console.warn('[embedding-service] onnxruntime failed to load — embeddings disabled, using BM25 fallback');
                    return null;
                }
            }
            const prefix = kind === 'query' ? 'query: ' : 'passage: ';
            const out = await this.pipeline(prefix + text, { pooling: 'mean', normalize: true });
            return new Float32Array(out.data);
        }
        catch (err) {
            console.error('[embedding-service] embed failed', err);
            return null;
        }
    }
    async embedMany(texts, kind) {
        const results = [];
        for (const text of texts) {
            results.push(await this.embed(text, kind));
        }
        return results;
    }
}
//# sourceMappingURL=embedding-service.js.map