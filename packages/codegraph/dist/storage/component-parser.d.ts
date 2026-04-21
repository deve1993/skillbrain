import type { SectionType } from './components-store.js';
export interface ParsedComponent {
    name: string;
    sectionType: SectionType;
    category: string;
    description?: string;
    filePath: string;
    props: Record<string, string>;
    codeSnippet: string;
}
export declare function categoryFromPath(filePath: string): string;
export declare function parseComponentFile(filePath: string, content: string): ParsedComponent[];
//# sourceMappingURL=component-parser.d.ts.map