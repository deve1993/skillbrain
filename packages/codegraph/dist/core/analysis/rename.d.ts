import type { RenamePreview } from '../graph/types.js';
import { GraphStore } from '../../storage/graph-store.js';
export declare function previewRename(store: GraphStore, repoPath: string, symbolName: string, newName: string): RenamePreview;
export declare function executeRename(repoPath: string, preview: RenamePreview, symbolName: string, newName: string): number;
//# sourceMappingURL=rename.d.ts.map