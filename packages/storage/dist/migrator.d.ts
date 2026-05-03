import type Database from 'better-sqlite3';
export declare function getAppliedMigrations(db: Database.Database): string[];
export declare function runMigrations(db: Database.Database, dir?: string): void;
//# sourceMappingURL=migrator.d.ts.map