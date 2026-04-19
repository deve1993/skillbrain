import type { SourceFile } from 'ts-morph';
import type { GraphEdge } from '../graph/types.js';
export interface ImportInfo {
    fromFile: string;
    toModule: string;
    specifiers: string[];
    isRelative: boolean;
}
export declare function extractImports(sourceFile: SourceFile, relativePath: string): {
    edges: GraphEdge[];
    imports: ImportInfo[];
};
//# sourceMappingURL=import-extractor.d.ts.map