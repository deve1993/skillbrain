import type { SectionType } from './components-store.js';
export interface ParsedComponent {
    name: string;
    sectionType: SectionType;
    category: string;
    description?: string;
    filePath: string;
    props: Record<string, string>;
    codeSnippet: string;
    designTokens: Record<string, string>;
}
export declare function categoryFromPath(filePath: string): string;
export declare function parseComponentFile(filePath: string, content: string): ParsedComponent[];
export declare function extractUsedTokens(content: string, designSystem: {
    colors?: Record<string, string>;
    fonts?: Record<string, unknown>;
    spacing?: Record<string, unknown>;
    radius?: Record<string, string>;
}): Record<string, string>;
//# sourceMappingURL=component-parser.d.ts.map