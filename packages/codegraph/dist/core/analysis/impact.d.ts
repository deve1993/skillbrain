import type { ImpactResult } from '../graph/types.js';
import { GraphStore } from '../../storage/graph-store.js';
export declare function analyzeImpact(store: GraphStore, targetName: string, direction?: 'upstream' | 'downstream' | 'both', maxDepth?: number, minConfidence?: number): ImpactResult | null;
//# sourceMappingURL=impact.d.ts.map