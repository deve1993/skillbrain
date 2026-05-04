import type { Memory, MemoryEdgeType } from './memory-store.js';
export interface EdgeCandidate {
    targetId: string;
    type: MemoryEdgeType;
    reason: string;
    score: number;
}
export declare function deriveEdgeCandidates(subject: Memory, candidates: Memory[]): EdgeCandidate[];
//# sourceMappingURL=memory-edge-derivation.d.ts.map