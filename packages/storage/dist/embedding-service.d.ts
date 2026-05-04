export declare function vectorToBlob(v: Float32Array): Buffer;
export declare function blobToVector(b: Buffer): Float32Array;
export declare function cosine(a: Float32Array, b: Float32Array): number;
export declare class EmbeddingService {
    private static _instance?;
    private pipeline?;
    static get(): EmbeddingService;
    embed(text: string, kind: 'query' | 'passage'): Promise<Float32Array | null>;
    embedMany(texts: string[], kind: 'passage'): Promise<(Float32Array | null)[]>;
}
//# sourceMappingURL=embedding-service.d.ts.map