import type Database from 'better-sqlite3';
export interface BriefData {
    goal?: string;
    audience?: string;
    tone?: string;
    constraints?: string;
    [key: string]: unknown;
}
export type ConversationStatus = 'idle' | 'generating' | 'done' | 'error';
export interface Conversation {
    id: string;
    title: string;
    status: ConversationStatus;
    briefData: BriefData | null;
    skillId: string | null;
    dsId: string | null;
    directionId: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface ConversationSummary {
    id: string;
    title: string;
    status: ConversationStatus;
    skillId: string | null;
    dsId: string | null;
    directionId: string | null;
    updatedAt: string;
}
export type MessageRole = 'user' | 'assistant' | 'artifact';
export interface Message {
    id: string;
    convId: string;
    role: MessageRole;
    content: string;
    artifactHtml: string | null;
    createdAt: string;
}
export type JobStatus = 'pending' | 'running' | 'done' | 'error';
export interface Job {
    id: string;
    convId: string;
    status: JobStatus;
    agentModel: string;
    critiqueModel: string;
    promptSnapshot: string;
    artifactHtml: string | null;
    critiqueJson: string | null;
    errorMsg: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface DesignSystem {
    id: string;
    name: string;
    category: string;
    sourceUrl: string | null;
    tokensJson: string;
    guidelinesJson: string;
    customTokensJson: string | null;
    customNotes: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface DesignSystemSummary {
    id: string;
    name: string;
    category: string;
    sourceUrl: string | null;
    tokensJson: string;
    updatedAt: string;
}
export interface DsVersion {
    id: string;
    dsId: string;
    authorEmail: string;
    changeJson: string;
    createdAt: string;
}
export interface StudioSkill {
    id: string;
    name: string;
    description: string;
    category: string;
    createdAt: string;
}
export interface StudioDirection {
    id: string;
    name: string;
    description: string;
    moodboardJson: string;
    createdAt: string;
}
export type MediaTemplateType = 'image' | 'video' | 'hyperframe' | 'audio';
export interface MediaTemplate {
    id: string;
    name: string;
    type: MediaTemplateType;
    promptTemplate: string;
    category: string | null;
    createdAt: string;
}
export declare class StudioStore {
    private db;
    constructor(db: Database.Database);
    listConversations(filter?: {
        status?: ConversationStatus;
        skillId?: string;
        dsId?: string;
        directionId?: string;
        limit?: number;
    }): ConversationSummary[];
    createConversation(input: {
        title: string;
        briefData?: BriefData | null;
        skillId?: string | null;
        dsId?: string | null;
        directionId?: string | null;
    }): Conversation;
    getConversation(id: string): Conversation | undefined;
    updateConversation(id: string, patch: {
        title?: string;
        status?: ConversationStatus;
        briefData?: BriefData | null;
        skillId?: string | null;
        dsId?: string | null;
        directionId?: string | null;
    }): Conversation | undefined;
    deleteConversation(id: string): boolean;
    listMessages(convId: string): Message[];
    addMessage(input: {
        convId: string;
        role: MessageRole;
        content: string;
        artifactHtml?: string | null;
    }): Message;
    createJob(input: {
        convId: string;
        agentModel: string;
        critiqueModel: string;
        promptSnapshot?: string;
    }): Job;
    getJob(id: string): Job | undefined;
    updateJob(id: string, patch: {
        status?: JobStatus;
        artifactHtml?: string | null;
        critiqueJson?: string | null;
        errorMsg?: string | null;
        promptSnapshot?: string;
    }): Job | undefined;
    listJobs(convId: string, limit?: number): Job[];
    listJobsForConv(convId: string): Job[];
    listDesignSystems(filter?: {
        category?: string;
        search?: string;
        limit?: number;
    }): DesignSystemSummary[];
    getDesignSystem(id: string): DesignSystem | undefined;
    updateDesignSystem(id: string, patch: {
        customTokensJson?: string | null;
        customNotes?: string | null;
        guidelinesJson?: string;
    }): DesignSystem | undefined;
    createDsVersion(input: {
        dsId: string;
        authorEmail: string;
        changeJson: string;
    }): DsVersion;
    listDsVersions(dsId: string, limit?: number): DsVersion[];
    listSkills(filter?: {
        category?: string;
    }): StudioSkill[];
    listDirections(): StudioDirection[];
    listMediaTemplates(filter?: {
        type?: MediaTemplateType;
        category?: string;
    }): MediaTemplate[];
    private resolveMemoryRepo;
    buildContextBlock(convId: string): string;
}
//# sourceMappingURL=studio-store.d.ts.map