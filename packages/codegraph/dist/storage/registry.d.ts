export interface RegistryEntry {
    name: string;
    path: string;
    lastCommit: string | null;
    indexedAt: string;
    stats: {
        nodes: number;
        edges: number;
        files: number;
        communities: number;
        processes: number;
    };
}
export declare function loadRegistry(): RegistryEntry[];
export declare function saveRegistry(entries: RegistryEntry[]): void;
export declare function upsertRegistry(entry: RegistryEntry): void;
export declare function removeFromRegistry(repoPath: string): void;
export declare function getRegistryEntry(nameOrPath: string): RegistryEntry | undefined;
//# sourceMappingURL=registry.d.ts.map