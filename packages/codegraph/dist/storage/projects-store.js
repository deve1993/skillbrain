import { randomId } from '../utils/hash.js';
import { encrypt, decrypt, isEncryptionAvailable } from './crypto.js';
export class ProjectsStore {
    db;
    constructor(db) {
        this.db = db;
    }
    // ── CRUD Projects ──
    upsert(project) {
        const existing = this.get(project.name);
        const now = new Date().toISOString();
        const merged = {
            name: project.name,
            displayName: project.displayName ?? existing?.displayName,
            description: project.description ?? existing?.description,
            clientName: project.clientName ?? existing?.clientName,
            category: project.category ?? existing?.category,
            teamLead: project.teamLead ?? existing?.teamLead,
            teamMembers: project.teamMembers ?? existing?.teamMembers ?? [],
            startedAt: project.startedAt ?? existing?.startedAt,
            endedAt: project.endedAt ?? existing?.endedAt,
            status: project.status ?? existing?.status ?? 'active',
            repoUrl: project.repoUrl ?? existing?.repoUrl,
            mainBranch: project.mainBranch ?? existing?.mainBranch ?? 'main',
            workspacePath: project.workspacePath ?? existing?.workspacePath,
            stack: project.stack ?? existing?.stack ?? [],
            language: project.language ?? existing?.language,
            packageManager: project.packageManager ?? existing?.packageManager,
            nodeVersion: project.nodeVersion ?? existing?.nodeVersion,
            dbType: project.dbType ?? existing?.dbType,
            dbReference: project.dbReference ?? existing?.dbReference,
            dbAdminUrl: project.dbAdminUrl ?? existing?.dbAdminUrl,
            cmsType: project.cmsType ?? existing?.cmsType,
            cmsAdminUrl: project.cmsAdminUrl ?? existing?.cmsAdminUrl,
            deployPlatform: project.deployPlatform ?? existing?.deployPlatform,
            liveUrl: project.liveUrl ?? existing?.liveUrl,
            deployStatus: project.deployStatus ?? existing?.deployStatus,
            lastDeploy: project.lastDeploy ?? existing?.lastDeploy,
            hasCi: project.hasCi ?? existing?.hasCi ?? false,
            domainPrimary: project.domainPrimary ?? existing?.domainPrimary,
            domainsExtra: project.domainsExtra ?? existing?.domainsExtra ?? [],
            integrations: project.integrations ?? existing?.integrations ?? {},
            legalCookieBanner: project.legalCookieBanner ?? existing?.legalCookieBanner,
            legalPrivacyUrl: project.legalPrivacyUrl ?? existing?.legalPrivacyUrl,
            legalTermsUrl: project.legalTermsUrl ?? existing?.legalTermsUrl,
            aliases: project.aliases ?? existing?.aliases ?? [],
            notes: project.notes ?? existing?.notes,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };
        this.db.prepare(`
      INSERT OR REPLACE INTO projects (
        name, display_name, description, client_name, category,
        team_lead, team_members,
        started_at, ended_at, status,
        repo_url, main_branch, workspace_path,
        stack, language, package_manager, node_version,
        db_type, db_reference, db_admin_url,
        cms_type, cms_admin_url,
        deploy_platform, live_url, deploy_status, last_deploy, has_ci,
        domain_primary, domains_extra,
        integrations,
        legal_cookie_banner, legal_privacy_url, legal_terms_url,
        aliases, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(merged.name, merged.displayName ?? null, merged.description ?? null, merged.clientName ?? null, merged.category ?? null, merged.teamLead ?? null, JSON.stringify(merged.teamMembers), merged.startedAt ?? null, merged.endedAt ?? null, merged.status, merged.repoUrl ?? null, merged.mainBranch ?? null, merged.workspacePath ?? null, JSON.stringify(merged.stack), merged.language ?? null, merged.packageManager ?? null, merged.nodeVersion ?? null, merged.dbType ?? null, merged.dbReference ?? null, merged.dbAdminUrl ?? null, merged.cmsType ?? null, merged.cmsAdminUrl ?? null, merged.deployPlatform ?? null, merged.liveUrl ?? null, merged.deployStatus ?? null, merged.lastDeploy ?? null, merged.hasCi ? 1 : 0, merged.domainPrimary ?? null, JSON.stringify(merged.domainsExtra), JSON.stringify(merged.integrations), merged.legalCookieBanner ?? null, merged.legalPrivacyUrl ?? null, merged.legalTermsUrl ?? null, JSON.stringify(merged.aliases), merged.notes ?? null, merged.createdAt, merged.updatedAt);
        return merged;
    }
    get(name) {
        const row = this.db.prepare('SELECT * FROM projects WHERE name = ?').get(name);
        return row ? this.rowToProject(row) : undefined;
    }
    list() {
        const rows = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
        return rows.map(this.rowToProject);
    }
    delete(name) {
        this.db.prepare('DELETE FROM projects WHERE name = ?').run(name);
    }
    /**
     * Merge aliases into a primary project.
     * Moves sessions/memories/env-vars from aliases → primary, then deletes alias rows.
     * Throws if the primary project does not exist.
     */
    merge(primary, aliases) {
        // primary may only exist in session_log/memories (no metadata scan yet) — that is fine
        let movedSessions = 0;
        let movedMemories = 0;
        let movedEnvVars = 0;
        // Wrap all mutations in a single transaction so that if anything throws
        // mid-way, no partial state is committed (sessions moved but env vars
        // stranded, etc.). SQLite rolls back on exception.
        const tx = this.db.transaction(() => {
            for (const alias of aliases) {
                if (alias === primary)
                    continue;
                // Move sessions
                const s = this.db.prepare('UPDATE session_log SET project = ? WHERE project = ?').run(primary, alias);
                movedSessions += s.changes;
                // Move memories
                const m = this.db.prepare('UPDATE memories SET project = ? WHERE project = ?').run(primary, alias);
                movedMemories += m.changes;
                // Move env vars (must happen BEFORE delete — project_env_vars has ON DELETE CASCADE).
                // Use INSERT OR REPLACE semantics via UPDATE OR REPLACE so that if the primary
                // already has a var with the same (var_name, environment), the alias value wins.
                const e = this.db
                    .prepare('UPDATE OR REPLACE project_env_vars SET project_name = ? WHERE project_name = ?')
                    .run(primary, alias);
                movedEnvVars += e.changes;
                // Delete alias project record (cascades to any remaining env vars, but we've moved them)
                this.delete(alias);
            }
            // Update aliases field on primary.
            // IMPORTANT: use a targeted UPDATE, not upsert() — upsert does INSERT OR REPLACE,
            // which under FK cascades would delete the primary row (and any env vars pointing
            // to it) before re-inserting.
            const proj = this.get(primary);
            if (proj) {
                const newAliases = [...new Set([...proj.aliases, ...aliases])];
                this.db
                    .prepare('UPDATE projects SET aliases = ?, updated_at = ? WHERE name = ?')
                    .run(JSON.stringify(newAliases), new Date().toISOString(), primary);
            }
        });
        tx();
        return { movedSessions, movedMemories, movedEnvVars };
    }
    // ── Env Vars (encrypted) ──
    setEnv(projectName, varName, value, environment = 'production', source = 'manual', isSecret = true, notes) {
        if (!isEncryptionAvailable()) {
            throw new Error('ENCRYPTION_KEY not configured — env storage unavailable');
        }
        const enc = encrypt(value);
        const now = new Date().toISOString();
        const existing = this.db.prepare('SELECT id FROM project_env_vars WHERE project_name = ? AND var_name = ? AND environment = ?').get(projectName, varName, environment);
        const id = existing?.id || randomId();
        const createdAt = existing ? undefined : now;
        this.db.prepare(`
      INSERT OR REPLACE INTO project_env_vars
        (id, project_name, var_name, encrypted_value, iv, auth_tag,
         environment, source, is_secret, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectName, varName, enc.ciphertext, enc.iv, enc.authTag, environment, source, isSecret ? 1 : 0, notes ?? null, createdAt ?? (existing ? this.db.prepare('SELECT created_at FROM project_env_vars WHERE id = ?').get(id)?.created_at : now), now);
    }
    getEnv(projectName, varName, environment = 'production') {
        const row = this.db.prepare('SELECT encrypted_value, iv, auth_tag FROM project_env_vars WHERE project_name = ? AND var_name = ? AND environment = ?').get(projectName, varName, environment);
        if (!row)
            return undefined;
        return decrypt({ ciphertext: row.encrypted_value, iv: row.iv, authTag: row.auth_tag });
    }
    getAllEnv(projectName, environment = 'production') {
        const rows = this.db.prepare('SELECT var_name, encrypted_value, iv, auth_tag FROM project_env_vars WHERE project_name = ? AND environment = ?').all(projectName, environment);
        const result = {};
        for (const r of rows) {
            try {
                result[r.var_name] = decrypt({ ciphertext: r.encrypted_value, iv: r.iv, authTag: r.auth_tag });
            }
            catch { /* skip invalid entries */ }
        }
        return result;
    }
    listEnvNames(projectName, environment = 'production') {
        const rows = this.db.prepare('SELECT id, project_name, var_name, environment, source, is_secret, notes, created_at, updated_at FROM project_env_vars WHERE project_name = ? AND environment = ? ORDER BY var_name').all(projectName, environment);
        return rows.map((r) => ({
            id: r.id,
            projectName: r.project_name,
            varName: r.var_name,
            environment: r.environment,
            source: r.source ?? undefined,
            isSecret: !!r.is_secret,
            notes: r.notes ?? undefined,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        }));
    }
    deleteEnv(projectName, varName, environment = 'production') {
        this.db.prepare('DELETE FROM project_env_vars WHERE project_name = ? AND var_name = ? AND environment = ?').run(projectName, varName, environment);
    }
    generateEnvExample(projectName, environment = 'production') {
        const vars = this.listEnvNames(projectName, environment);
        const lines = [
            `# ${projectName} — ${environment} environment`,
            `# Generated by SkillBrain project_generate_env_example`,
            `# DO NOT commit actual values to git`,
            '',
        ];
        for (const v of vars) {
            if (v.notes)
                lines.push(`# ${v.notes}`);
            lines.push(`${v.varName}=`);
        }
        return lines.join('\n');
    }
    rowToProject(row) {
        let teamMembers = [];
        try {
            teamMembers = JSON.parse(row.team_members || '[]');
        }
        catch { }
        return {
            name: row.name,
            displayName: row.display_name ?? undefined,
            description: row.description ?? undefined,
            clientName: row.client_name ?? undefined,
            category: row.category ?? undefined,
            teamLead: row.team_lead ?? undefined,
            teamMembers,
            startedAt: row.started_at ?? undefined,
            endedAt: row.ended_at ?? undefined,
            status: row.status || 'active',
            repoUrl: row.repo_url ?? undefined,
            mainBranch: row.main_branch ?? 'main',
            workspacePath: row.workspace_path ?? undefined,
            stack: JSON.parse(row.stack || '[]'),
            language: row.language ?? undefined,
            packageManager: row.package_manager ?? undefined,
            nodeVersion: row.node_version ?? undefined,
            dbType: row.db_type ?? undefined,
            dbReference: row.db_reference ?? undefined,
            dbAdminUrl: row.db_admin_url ?? undefined,
            cmsType: row.cms_type ?? undefined,
            cmsAdminUrl: row.cms_admin_url ?? undefined,
            deployPlatform: row.deploy_platform ?? undefined,
            liveUrl: row.live_url ?? undefined,
            deployStatus: row.deploy_status ?? undefined,
            lastDeploy: row.last_deploy ?? undefined,
            hasCi: !!row.has_ci,
            domainPrimary: row.domain_primary ?? undefined,
            domainsExtra: JSON.parse(row.domains_extra || '[]'),
            integrations: JSON.parse(row.integrations || '{}'),
            legalCookieBanner: row.legal_cookie_banner ?? undefined,
            legalPrivacyUrl: row.legal_privacy_url ?? undefined,
            legalTermsUrl: row.legal_terms_url ?? undefined,
            aliases: JSON.parse(row.aliases || '[]'),
            notes: row.notes ?? undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
//# sourceMappingURL=projects-store.js.map