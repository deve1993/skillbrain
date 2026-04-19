import type { Project } from 'ts-morph';
import { GraphStore } from '../../storage/graph-store.js';
export interface BuildResult {
    nodes: number;
    edges: number;
    files: number;
    skipped: number;
}
export declare function buildGraph(project: Project, store: GraphStore, repoPath: string, incremental: boolean): BuildResult;
//# sourceMappingURL=builder.d.ts.map