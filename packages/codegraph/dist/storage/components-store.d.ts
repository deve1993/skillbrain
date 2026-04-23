import type Database from 'better-sqlite3';
import type { TokenSource, Conflict } from './design-token-parser.js';
export type SectionType = 'hero' | 'navbar' | 'footer' | 'cta' | 'pricing' | 'features' | 'testimonials' | 'faq' | 'comparison' | 'process' | 'gallery' | 'demo' | 'form' | 'card' | 'other';
export interface UiComponent {
    id: string;
    project: string;
    name: string;
    sectionType: SectionType;
    description?: string;
    filePath?: string;
    tags: string[];
    propsSchema: Record<string, unknown>;
    codeSnippet?: string;
    designTokens: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export interface UiComponentInput {
    project: string;
    name: string;
    sectionType: SectionType;
    description?: string;
    filePath?: string;
    tags?: string[];
    propsSchema?: Record<string, unknown>;
    codeSnippet?: string;
    designTokens?: Record<string, unknown>;
}
export interface DesignSystem {
    id: string;
    project: string;
    clientName?: string;
    colors: Record<string, string>;
    fonts: Record<string, unknown>;
    spacing: Record<string, unknown>;
    radius: Record<string, string>;
    animations: unknown[];
    darkMode: boolean;
    colorFormat: 'hex' | 'oklch' | 'hsl';
    tailwindConfig?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
export interface DesignSystemInput {
    project: string;
    clientName?: string;
    colors?: Record<string, string>;
    fonts?: Record<string, unknown>;
    spacing?: Record<string, unknown>;
    radius?: Record<string, string>;
    animations?: unknown[];
    darkMode?: boolean;
    colorFormat?: 'hex' | 'oklch' | 'hsl';
    tailwindConfig?: string;
    notes?: string;
}
export interface ComponentSearchResult {
    component: UiComponent;
    rank: number;
}
export interface DesignSystemScan {
    id: string;
    project: string;
    scannedAt: string;
    sources: TokenSource[];
    merged: Partial<DesignSystemInput>;
    conflicts: Conflict[];
    status: 'pending' | 'applied' | 'dismissed';
}
export declare class ComponentsStore {
    private db;
    constructor(db: Database.Database);
    addComponent(input: UiComponentInput): UiComponent;
    getComponent(id: string): UiComponent | undefined;
    listComponents(filters?: {
        project?: string;
        sectionType?: SectionType;
        tag?: string;
        limit?: number;
    }): UiComponent[];
    searchComponents(query: string, limit?: number): ComponentSearchResult[];
    deleteComponent(id: string): void;
    componentStats(): {
        total: number;
        byProject: Record<string, number>;
        bySectionType: Record<string, number>;
    };
    upsertDesignSystem(input: DesignSystemInput): DesignSystem;
    getDesignSystem(project: string): DesignSystem | undefined;
    listDesignSystems(): DesignSystem[];
    addDesignSystemScan(scan: {
        project: string;
        sources: TokenSource[];
        merged: Partial<DesignSystemInput>;
        conflicts: Conflict[];
    }): DesignSystemScan;
    getPendingScans(project?: string): DesignSystemScan[];
    applyDesignSystemScan(scanId: string, resolved: Partial<DesignSystemInput>): DesignSystem;
    dismissDesignSystemScan(scanId: string): void;
    mergeDesignSystems(primary: string, alias: string): DesignSystem;
    private rowToScan;
    private populateFts;
    private rowToComponent;
    private rowToDesignSystem;
}
//# sourceMappingURL=components-store.d.ts.map