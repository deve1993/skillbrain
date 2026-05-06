import type Database from 'better-sqlite3';
export type WhiteboardScope = 'team' | 'project';
export interface Whiteboard {
    id: string;
    name: string;
    scope: WhiteboardScope;
    projectName: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    stateJson: string;
    stateVersion: number;
    thumbnailDataUrl: string | null;
    votePool: number;
    shareToken: string | null;
    pinnedAt: string | null;
    lastOpenedAt: string | null;
    tags: string[];
    description: string | null;
    deletedAt: string | null;
}
export interface WhiteboardSummary {
    id: string;
    name: string;
    scope: WhiteboardScope;
    projectName: string | null;
    createdBy: string;
    updatedAt: string;
    thumbnailDataUrl: string | null;
    pinnedAt: string | null;
    lastOpenedAt: string | null;
    tags: string[];
    description: string | null;
}
export interface WhiteboardComment {
    id: string;
    boardId: string;
    nodeId: string;
    parentId: string | null;
    authorEmail: string;
    body: string;
    createdAt: string;
}
export declare class WhiteboardConcurrencyError extends Error {
    readonly currentVersion: number;
    readonly code = "whiteboard_version_conflict";
    constructor(currentVersion: number);
}
export declare class WhiteboardsStore {
    private db;
    constructor(db: Database.Database);
    create(input: {
        name: string;
        scope: WhiteboardScope;
        projectName?: string | null;
        createdBy: string;
        stateJson?: string;
        votePool?: number;
    }): Whiteboard;
    get(id: string): Whiteboard | undefined;
    list(filter?: {
        scope?: WhiteboardScope;
        projectName?: string;
        includeTrashed?: boolean;
        onlyTrashed?: boolean;
        pinned?: boolean;
        tag?: string;
        search?: string;
    }): WhiteboardSummary[];
    /** Most recently opened/edited boards. */
    listRecent(limit?: number): WhiteboardSummary[];
    /** Toggle pin: returns the new pinned_at value (string or null). */
    togglePin(id: string): string | null;
    /** Update last_opened_at to now (called when client opens a board). */
    markOpened(id: string): void;
    /** Update tags / description (free-form metadata, no version bump). */
    updateMetadata(id: string, patch: {
        tags?: string[];
        description?: string | null;
    }): Whiteboard | undefined;
    /** All distinct tags across non-deleted boards. */
    allTags(): Array<{
        tag: string;
        count: number;
    }>;
    /** Soft delete: set deleted_at instead of removing the row. */
    softDelete(id: string): boolean;
    /** Restore from trash. */
    restore(id: string): boolean;
    /** Permanently delete trashed boards older than `daysAgo`. */
    purgeTrashOlderThan(daysAgo: number): number;
    /** Duplicate a board (state copied, new id, name="X (copy)"). */
    duplicate(id: string, opts?: {
        newName?: string;
        newScope?: WhiteboardScope;
        newProjectName?: string | null;
        createdBy?: string;
    }): Whiteboard | undefined;
    /** Move a board to a different scope/project. */
    move(id: string, target: {
        scope?: WhiteboardScope;
        projectName?: string | null;
    }): Whiteboard | undefined;
    /**
     * Save the canvas state with optimistic concurrency.
     * `expectedVersion` must match the current `state_version` or the call throws
     * WhiteboardConcurrencyError so the client can prompt the user to reload.
     */
    saveState(input: {
        id: string;
        stateJson: string;
        expectedVersion: number;
        thumbnailDataUrl?: string | null;
    }): Whiteboard;
    /** Update name / vote pool — does NOT bump state_version. */
    updateMeta(id: string, patch: {
        name?: string;
        votePool?: number;
    }): Whiteboard | undefined;
    delete(id: string): boolean;
    /** Generate (or rotate) the share token for a whiteboard. Returns the new token. */
    enableShare(id: string): string;
    /** Revoke the share token. */
    disableShare(id: string): void;
    /** Look up a whiteboard by its share token (for read-only public access). */
    getByShareToken(token: string): Whiteboard | undefined;
    /** Crude global text search across boards' serialized state. */
    searchAll(query: string, limit?: number): WhiteboardSummary[];
    addComment(input: {
        boardId: string;
        nodeId: string;
        parentId?: string | null;
        authorEmail: string;
        body: string;
    }): WhiteboardComment;
    listComments(boardId: string, nodeId?: string): WhiteboardComment[];
    createSnapshot(input: {
        boardId: string;
        reason: 'auto' | 'manual' | 'pre-merge' | 'pre-restore';
        createdBy?: string;
    }): string;
    listSnapshots(boardId: string, limit?: number): Array<{
        id: string;
        createdAt: string;
        createdBy: string | null;
        reason: string;
        stateVersion: number;
    }>;
    getSnapshot(snapshotId: string): {
        id: string;
        boardId: string;
        stateJson: string;
        stateVersion: number;
        createdAt: string;
    } | undefined;
    /** Trim old snapshots beyond N per board. */
    pruneSnapshots(boardId: string, keep?: number): number;
    recordActivity(input: {
        boardId: string;
        userEmail: string;
        action: string;
        detail?: string;
    }): void;
    listActivity(boardId: string, limit?: number): Array<{
        id: string;
        userEmail: string;
        action: string;
        detail: string | null;
        createdAt: string;
    }>;
    addNotification(input: {
        userEmail: string;
        type: 'mention' | 'reply' | 'shared';
        boardId?: string;
        nodeId?: string;
        body?: string;
    }): string;
    listNotifications(userEmail: string, opts?: {
        unreadOnly?: boolean;
        limit?: number;
    }): Array<{
        id: string;
        type: string;
        boardId: string | null;
        nodeId: string | null;
        body: string | null;
        createdAt: string;
        readAt: string | null;
    }>;
    markNotificationRead(id: string, userEmail: string): boolean;
    markAllNotificationsRead(userEmail: string): number;
    unreadNotificationCount(userEmail: string): number;
    recordHeartbeat(boardId: string, userEmail: string): void;
    /** Active editors are those whose heartbeat is within `windowSeconds`. */
    activeEditors(boardId: string, windowSeconds?: number): Array<{
        userEmail: string;
        lastSeen: string;
    }>;
    deleteComment(id: string, requireAuthorEmail?: string): boolean;
}
//# sourceMappingURL=whiteboards-store.d.ts.map