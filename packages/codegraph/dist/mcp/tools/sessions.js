import { z } from 'zod';
import { openDb, closeDb } from '../../storage/db.js';
import { MemoryStore } from '../../storage/memory-store.js';
import { getRegistryEntry, loadRegistry } from '../../storage/registry.js';
const MEMORY_REPO_NAME = process.env.SKILLBRAIN_MEMORY_REPO || 'skillbrain';
const SKILLBRAIN_ROOT = process.env.SKILLBRAIN_ROOT || '';
function resolveMemoryRepo(nameOrPath) {
    if (nameOrPath) {
        const entry = getRegistryEntry(nameOrPath);
        if (entry)
            return { path: entry.path, name: entry.name };
    }
    const entry = getRegistryEntry(MEMORY_REPO_NAME);
    if (entry)
        return { path: entry.path, name: entry.name };
    const entries = loadRegistry();
    if (entries.length === 1)
        return { path: entries[0].path, name: entries[0].name };
    if (SKILLBRAIN_ROOT)
        return { path: SKILLBRAIN_ROOT, name: 'skillbrain' };
    return null;
}
function withMemoryStore(repoPath, fn) {
    const db = openDb(repoPath);
    const store = new MemoryStore(db);
    try {
        return fn(store);
    }
    finally {
        closeDb(db);
    }
}
export function registerSessionTools(server, _ctx) {
    // --- Tool: session_start ---
    server.tool('session_start', 'Log the start of a new session. Include project and task for context continuity.', {
        sessionName: z.string().describe('Session name (e.g., "MASTER_Fullstack", "Mobile")'),
        project: z.string().optional().describe('Project name (e.g., "Quickfy", "pixarts-landing")'),
        task: z.string().optional().describe('What you are working on (e.g., "add stripe payments", "fix auth bug")'),
        branch: z.string().optional().describe('Git branch name'),
        workspacePath: z.string().optional(),
        repo: z.string().optional(),
    }, async ({ sessionName, project, task, branch, workspacePath, repo }) => {
        const resolved = resolveMemoryRepo(repo);
        if (!resolved)
            return { content: [{ type: 'text', text: 'Repository not found.' }] };
        const session = withMemoryStore(resolved.path, (store) => store.startSession(sessionName, project, workspacePath, task, branch));
        // Check if there's a previous session for this project
        let resumeContext = '';
        if (project) {
            const prev = withMemoryStore(resolved.path, (store) => store.lastProjectSession(project));
            if (prev && prev.id !== session.id) {
                resumeContext = `\n\nPrevious session on "${project}":`;
                resumeContext += `\n  Last worked: ${prev.startedAt.split('T')[0]}`;
                resumeContext += `\n  Task: ${prev.taskDescription || 'not specified'}`;
                resumeContext += `\n  Status: ${prev.status}`;
                if (prev.summary)
                    resumeContext += `\n  Summary: ${prev.summary}`;
                if (prev.nextSteps)
                    resumeContext += `\n  Next steps: ${prev.nextSteps}`;
                if (prev.blockers)
                    resumeContext += `\n  Blockers: ${prev.blockers}`;
                resumeContext += `\n\nUse session_resume for full project history.`;
            }
        }
        return { content: [{ type: 'text', text: `Session started: ${session.id} (${sessionName}${project ? ` / ${project}` : ''})${resumeContext}` }] };
    });
    // --- Tool: session_end ---
    server.tool('session_end', 'Log the end of a session with summary, deliverables, next steps, and status', {
        sessionId: z.string().describe('Session ID from session_start'),
        summary: z.string().describe('What was accomplished this session'),
        deliverables: z.string().optional().describe('What was delivered/built (e.g., "Contact form with Zod validation")'),
        workType: z.enum(['feature', 'fix', 'setup', 'deploy', 'refactor', 'design', 'docs', 'other']).optional().describe('Type of work done'),
        nextSteps: z.string().optional().describe('What should be done next (critical for continuity)'),
        blockers: z.string().optional().describe('Any blockers or issues preventing progress'),
        status: z.enum(['completed', 'paused', 'blocked']).optional().default('completed'),
        memoriesCreated: z.number().default(0),
        memoriesValidated: z.number().default(0),
        filesChanged: z.array(z.string()).default([]),
        commits: z.array(z.string()).default([]).describe('Commit hashes made this session'),
        repo: z.string().optional(),
    }, async ({ sessionId, summary, deliverables, workType, nextSteps, blockers, status, memoriesCreated, memoriesValidated, filesChanged, commits, repo }) => {
        const resolved = resolveMemoryRepo(repo);
        if (!resolved)
            return { content: [{ type: 'text', text: 'Repository not found.' }] };
        withMemoryStore(resolved.path, (store) => store.endSession(sessionId, summary, memoriesCreated, memoriesValidated, filesChanged, nextSteps, blockers, commits, status, workType, deliverables));
        return { content: [{ type: 'text', text: `Session ${sessionId} ended (${status}).${deliverables ? `\nDelivered: ${deliverables}` : ''}${nextSteps ? `\nNext steps: ${nextSteps}` : ''}` }] };
    });
    // --- Tool: session_heartbeat ---
    server.tool('session_heartbeat', 'Update session last_heartbeat timestamp (called periodically by proxy to keep session alive)', {
        sessionId: z.string().describe('Session ID'),
        repo: z.string().optional(),
    }, async ({ sessionId, repo }) => {
        const resolved = resolveMemoryRepo(repo);
        if (!resolved)
            return { content: [{ type: 'text', text: 'Repository not found.' }] };
        withMemoryStore(resolved.path, (store) => store.heartbeat(sessionId));
        return { content: [{ type: 'text', text: `ok` }] };
    });
    // --- Tool: session_resume ---
    server.tool('session_resume', 'Get full context for resuming work on a project — last session, pending work, next steps, recent memories', {
        project: z.string().describe('Project name to resume'),
        repo: z.string().optional(),
    }, async ({ project, repo }) => {
        const resolved = resolveMemoryRepo(repo);
        if (!resolved)
            return { content: [{ type: 'text', text: 'Repository not found.' }] };
        const db = openDb(resolved.path);
        const memStore = new MemoryStore(db);
        // Get project sessions
        const sessions = memStore.projectSessions(project, 5);
        const pending = memStore.pendingSessions().filter((s) => s.project === project);
        // Get project-specific memories
        const memories = memStore.query({ project, limit: 10 });
        // Get recent memories related to this project
        const searchResults = memStore.search(project, 5);
        closeDb(db);
        if (sessions.length === 0 && memories.length === 0) {
            return { content: [{ type: 'text', text: `No history found for project "${project}". This is a fresh start.` }] };
        }
        const last = sessions[0];
        const lines = [
            `## Resume Context: ${project}`,
            '',
        ];
        if (last) {
            lines.push(`### Last Session`);
            lines.push(`- **Date**: ${last.startedAt.split('T')[0]}`);
            lines.push(`- **Task**: ${last.taskDescription || 'not specified'}`);
            lines.push(`- **Status**: ${last.status}`);
            if (last.summary)
                lines.push(`- **Summary**: ${last.summary}`);
            if (last.nextSteps)
                lines.push(`- **Next steps**: ${last.nextSteps}`);
            if (last.blockers)
                lines.push(`- **Blockers**: ${last.blockers}`);
            if (last.branch)
                lines.push(`- **Branch**: ${last.branch}`);
            if (last.filesChanged.length)
                lines.push(`- **Files changed**: ${last.filesChanged.slice(0, 10).join(', ')}`);
            if (last.commits.length)
                lines.push(`- **Commits**: ${last.commits.join(', ')}`);
            lines.push('');
        }
        if (pending.length > 0) {
            lines.push(`### Pending Work (${pending.length})`);
            for (const s of pending) {
                lines.push(`- [${s.status}] ${s.taskDescription || s.summary || 'no description'} (${s.startedAt.split('T')[0]})`);
            }
            lines.push('');
        }
        if (sessions.length > 1) {
            lines.push(`### Session History (last ${sessions.length})`);
            for (const s of sessions) {
                const date = s.startedAt.split('T')[0];
                lines.push(`- **${date}** [${s.status}]: ${s.summary || s.taskDescription || 'no summary'} (+${s.memoriesCreated} memories)`);
            }
            lines.push('');
        }
        if (memories.length > 0) {
            lines.push(`### Project Memories (${memories.length})`);
            for (const m of memories) {
                lines.push(`- [${m.type} conf:${m.confidence}] ${m.context.slice(0, 100)}`);
            }
            lines.push('');
        }
        if (searchResults.length > 0) {
            lines.push(`### Related Knowledge`);
            for (const r of searchResults) {
                if (!memories.find((m) => m.id === r.memory.id)) {
                    lines.push(`- [${r.memory.type} conf:${r.memory.confidence}] ${r.memory.context.slice(0, 100)}`);
                }
            }
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
    });
    // --- Tool: session_history ---
    server.tool('session_history', 'Get recent session history, optionally filtered by project', {
        project: z.string().optional().describe('Filter by project name'),
        limit: z.number().optional().default(10),
        repo: z.string().optional(),
    }, async ({ project, limit, repo }) => {
        const resolved = resolveMemoryRepo(repo);
        if (!resolved)
            return { content: [{ type: 'text', text: 'Repository not found.' }] };
        const sessions = withMemoryStore(resolved.path, (store) => project ? store.projectSessions(project, limit) : store.recentSessions(limit));
        if (sessions.length === 0) {
            return { content: [{ type: 'text', text: project ? `No sessions found for project "${project}".` : 'No session history found.' }] };
        }
        const formatted = sessions.map((s) => ({
            id: s.id,
            session: s.sessionName,
            project: s.project || 'none',
            task: s.taskDescription || 'none',
            status: s.status,
            started: s.startedAt,
            ended: s.endedAt || 'still running',
            summary: s.summary || 'no summary',
            nextSteps: s.nextSteps || null,
            blockers: s.blockers || null,
            memories: `+${s.memoriesCreated} created`,
            branch: s.branch || null,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] };
    });
}
//# sourceMappingURL=sessions.js.map