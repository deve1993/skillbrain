import type { DesignSystemInput } from './components-store.js';
export type SourceType = 'tailwind' | 'css' | 'tokens_json';
export interface TokenSource {
    source: SourceType;
    path: string;
    tokens: Partial<DesignSystemInput>;
}
export interface Conflict {
    field: 'colors' | 'fonts' | 'spacing' | 'radius';
    key: string;
    values: Array<{
        source: string;
        value: unknown;
    }>;
}
export interface MergeResult {
    merged: Partial<DesignSystemInput>;
    conflicts: Conflict[];
    sources: TokenSource[];
}
export interface DesignFiles {
    tailwind?: string;
    css?: string;
    tokensJson?: string;
}
export declare function detectDesignFiles(workspacePath: string): DesignFiles;
export declare function parseTailwindConfigFromContent(text: string): Partial<DesignSystemInput>;
export declare function parseTailwindConfig(filePath: string): Partial<DesignSystemInput>;
export declare function parseCSSVariablesFromContent(text: string): Partial<DesignSystemInput>;
export declare function parseCSSVariables(filePath: string): Partial<DesignSystemInput>;
export declare function parseTokensJsonFromContent(content: string): Partial<DesignSystemInput>;
export declare function parseTokensJson(filePath: string): Partial<DesignSystemInput>;
export declare function mergeTokenSources(sources: TokenSource[]): MergeResult;
//# sourceMappingURL=design-token-parser.d.ts.map