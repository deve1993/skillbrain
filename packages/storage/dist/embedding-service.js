/*
 * SkillBrain — Self-hosted AI memory platform
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
    pipeline;
    static get() {
        if (!EmbeddingService._instance)
            EmbeddingService._instance = new EmbeddingService();
        return EmbeddingService._instance;
    }
    async embed(text, kind) {
        try {
            if (!this.pipeline) {
                const { pipeline } = await import('@huggingface/transformers');
                this.pipeline = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
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