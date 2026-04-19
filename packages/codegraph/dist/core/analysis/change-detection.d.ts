import type { ChangeDetectionResult } from '../graph/types.js';
import { GraphStore } from '../../storage/graph-store.js';
export declare function detectChanges(store: GraphStore, repoPath: string, scope?: 'staged' | 'all' | 'compare', baseRef?: string): ChangeDetectionResult;
//# sourceMappingURL=change-detection.d.ts.map