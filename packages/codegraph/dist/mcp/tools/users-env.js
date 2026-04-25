import { z } from 'zod';
import { openDb, closeDb } from '../../storage/db.js';
import { UsersEnvStore } from '../../storage/users-env-store.js';
import { ProjectsStore } from '../../storage/projects-store.js';
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
function withUsersEnvStore(repoPath, fn) {
    const db = openDb(repoPath);
    const store = new UsersEnvStore(db);
    try {
        return fn(store);
    }
    finally {
        closeDb(db);
    }
}
function projectVarNames(repoPath, project) {
    const db = openDb(repoPath);
    try {
        return new ProjectsStore(db)
            .listEnvNames(project, 'production')
            .map((v) => v.varName);
    }
    finally {
        closeDb(db);
    }
}
const requireUser = (ctx) => {
    if (!ctx.userId) {
        throw new Error('user_env tools require an authenticated MCP session. ' +
            'Connect using a personal API key (POST /api/me/api-keys) — the legacy shared token is not bound to a user.');
    }
    return ctx.userId;
};
export function registerUserEnvTools(server, ctx) {
    // --- user_env_list ---
    server.tool('user_env_list', 'List the names + metadata of credentials/configs in YOUR personal master.env. Values are NOT returned — use user_env_get for that. Use this for capability checks ("do I have X?") without revealing secrets.', {
        category: z.enum(['api_key', 'mcp_config', 'integration', 'preference']).optional(),
        service: z.string().optional().describe('Filter by service name (e.g. "anthropic", "github")'),
        repo: z.string().optional(),
    }, async ({ category, service, repo }) => {
        try {
            const userId = requireUser(ctx);
            const resolved = resolveMemoryRepo(repo);
            if (!resolved)
                return { content: [{ type: 'text', text: 'Repository not found.' }] };
            const vars = withUsersEnvStore(resolved.path, (s) => s.listEnv(userId, { category, service }));
            const formatted = vars.map((v) => ({
                varName: v.varName,
                category: v.category,
                service: v.service,
                isSecret: v.isSecret,
                description: v.description,
                lastUsedAt: v.lastUsedAt,
            }));
            return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ ${err.message}` }] };
        }
    });
    // --- user_env_get ---
    server.tool('user_env_get', 'Decrypt and return the value of a single credential from YOUR master.env. Bumps last_used_at. If a `project` is provided AND that project also has the same var, the response includes a `conflict: true` flag — in that case ASK the user which to use before proceeding.', {
        varName: z.string().describe('Env var name (e.g. ANTHROPIC_API_KEY)'),
        project: z.string().optional().describe('Current project — used to detect user vs project conflicts'),
        reason: z.string().optional().describe('Why you need this value (logged for transparency)'),
        repo: z.string().optional(),
    }, async ({ varName, project, reason, repo }) => {
        try {
            const userId = requireUser(ctx);
            const resolved = resolveMemoryRepo(repo);
            if (!resolved)
                return { content: [{ type: 'text', text: 'Repository not found.' }] };
            const value = withUsersEnvStore(resolved.path, (s) => s.getEnv(userId, varName));
            if (value === undefined) {
                return { content: [{ type: 'text', text: JSON.stringify({ found: false, varName, hint: `Not in your master.env. Add it via the SkillBrain hub (#/my-env) or call user_env_set.` }) }] };
            }
            let conflict = false;
            let projectHasIt = false;
            if (project) {
                const names = projectVarNames(resolved.path, project);
                projectHasIt = names.includes(varName);
                conflict = projectHasIt;
            }
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            found: true,
                            varName,
                            value,
                            conflict,
                            projectHasIt,
                            ...(reason ? { reason } : {}),
                            ...(conflict ? { warning: `Both YOUR master.env and project "${project}" have ${varName}. Ask the user which to use for this task before proceeding — do not assume.` } : {}),
                        }, null, 2),
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ ${err.message}` }] };
        }
    });
    // --- user_env_available ---
    server.tool('user_env_available', 'Quick boolean check: does YOUR master.env have credentials for a given service or var? Useful as a precondition before attempting to use a tool/integration.', {
        service: z.string().optional().describe('Service name (e.g. "anthropic", "github")'),
        varName: z.string().optional().describe('Specific env var name'),
        repo: z.string().optional(),
    }, async ({ service, varName, repo }) => {
        try {
            const userId = requireUser(ctx);
            if (!service && !varName) {
                return { content: [{ type: 'text', text: '❌ Pass either `service` or `varName`.' }] };
            }
            const resolved = resolveMemoryRepo(repo);
            if (!resolved)
                return { content: [{ type: 'text', text: 'Repository not found.' }] };
            const result = withUsersEnvStore(resolved.path, (s) => {
                if (varName) {
                    return { available: s.hasEnv(userId, varName), varName };
                }
                const matches = s.listEnv(userId, { service });
                return { available: matches.length > 0, service, vars: matches.map((v) => v.varName) };
            });
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ ${err.message}` }] };
        }
    });
    // --- user_env_set ---
    server.tool('user_env_set', 'Save (or update) a credential/config in YOUR master.env. Use after the user provides a new key so future sessions can find it via user_env_get.', {
        varName: z.string(),
        value: z.string(),
        category: z.enum(['api_key', 'mcp_config', 'integration', 'preference']).optional().default('api_key'),
        service: z.string().optional().describe('Logical service name (e.g. "anthropic", "supabase")'),
        description: z.string().optional(),
        isSecret: z.boolean().optional(),
        repo: z.string().optional(),
    }, async ({ varName, value, category, service, description, isSecret, repo }) => {
        try {
            const userId = requireUser(ctx);
            const resolved = resolveMemoryRepo(repo);
            if (!resolved)
                return { content: [{ type: 'text', text: 'Repository not found.' }] };
            const saved = withUsersEnvStore(resolved.path, (s) => s.setEnv(userId, varName, value, { category, service, description, isSecret, source: 'mcp' }));
            return {
                content: [{
                        type: 'text',
                        text: `✅ Saved ${varName} (encrypted) in your master.env [${saved.category}${saved.service ? `/${saved.service}` : ''}]`,
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ ${err.message}` }] };
        }
    });
}
//# sourceMappingURL=users-env.js.map