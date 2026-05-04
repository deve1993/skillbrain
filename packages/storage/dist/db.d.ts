import Database from 'better-sqlite3';
export declare function getDbPath(repoPath: string): string;
export declare function getCodegraphDir(repoPath: string): string;
export declare function openDb(repoPath: string): Database.Database;
export declare function clearDb(db: Database.Database): void;
export declare function closeDb(db: Database.Database): void;
//# sourceMappingURL=db.d.ts.map