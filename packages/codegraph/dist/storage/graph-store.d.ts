import type Database from 'better-sqlite3';
import type { GraphNode, GraphEdge, FileRecord } from '../core/graph/types.js';
export declare class GraphStore {
    private db;
    private stmts;
    constructor(db: Database.Database);
    private prepareStatements;
    addNode(node: GraphNode): void;
    addEdge(edge: GraphEdge): void;
    addFile(file: FileRecord): void;
    addNodesBatch(nodes: GraphNode[]): void;
    addEdgesBatch(edges: GraphEdge[]): void;
    getNode(id: string): GraphNode | undefined;
    getNodeByName(name: string): GraphNode | undefined;
    getNodesByFile(filePath: string): GraphNode[];
    getNodesByLabel(label: string): GraphNode[];
    getCallers(nodeId: string): GraphNode[];
    getCallees(nodeId: string): GraphNode[];
    getProcessesForSymbol(nodeId: string): {
        name: string;
        step: number;
    }[];
    getProcessSteps(processId: string): (GraphNode & {
        step: number;
    })[];
    getCommunityMembers(communityId: string): GraphNode[];
    getEdgesFrom(nodeId: string): GraphEdge[];
    getEdgesTo(nodeId: string): GraphEdge[];
    getFile(filePath: string): FileRecord | undefined;
    getAllFiles(): FileRecord[];
    deleteByFile(filePath: string): void;
    search(query: string, limit?: number): {
        node: GraphNode;
        rank: number;
    }[];
    stats(): {
        nodes: any;
        edges: any;
        files: any;
        communities: any;
        processes: any;
    };
    rawQuery(sql: string): unknown[];
    exec(sql: string): void;
    private rowToNode;
    private rowToEdge;
}
//# sourceMappingURL=graph-store.d.ts.map