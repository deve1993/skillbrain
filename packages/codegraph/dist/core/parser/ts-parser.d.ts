import { Project, type SourceFile } from 'ts-morph';
import type { WalkedFile } from '../../utils/file-walker.js';
export declare function createProject(repoPath: string, files: WalkedFile[]): Project;
export declare function getSourceFiles(project: Project): SourceFile[];
//# sourceMappingURL=ts-parser.d.ts.map