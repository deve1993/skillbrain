/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */
import { randomId } from './utils/hash.js';
import { openDb, closeDb } from './db.js';
import { MemoryStore } from './memory-store.js';
import { getRegistryEntry, loadRegistry } from './registry.js';
// ── Row mappers ───────────────────────────────────────────────────────────────
function rowToConversation(r) {
    let briefData = null;
    if (r.brief_json) {
        try {
            briefData = JSON.parse(r.brief_json);
        }
        catch {
            briefData = null;
        }
    }
    return {
        id: r.id,
        title: r.title,
        status: r.status,
        briefData,
        skillId: r.skill_id,
        dsId: r.ds_id,
        directionId: r.direction_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}
function rowToConversationSummary(r) {
    return {
        id: r.id,
        title: r.title,
        status: r.status,
        skillId: r.skill_id,
        dsId: r.ds_id,
        directionId: r.direction_id,
        updatedAt: r.updated_at,
    };
}
function rowToMessage(r) {
    return {
        id: r.id,
        convId: r.conv_id,
        role: r.role,
        content: r.content,
        artifactHtml: r.artifact_html,
        createdAt: r.created_at,
    };
}
function rowToJob(r) {
    return {
        id: r.id,
        convId: r.conv_id,
        status: r.status,
        agentModel: r.agent_model,
        critiqueModel: r.critique_model,
        promptSnapshot: r.prompt_snapshot,
        artifactHtml: r.artifact_html,
        critiqueJson: r.critique_json,
        errorMsg: r.error_msg,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}
function rowToDesignSystem(r) {
    return {
        id: r.id,
        name: r.name,
        category: r.category,
        sourceUrl: r.source_url,
        tokensJson: r.tokens_json,
        guidelinesJson: r.guidelines_json,
        customTokensJson: r.custom_tokens_json,
        customNotes: r.custom_notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}
function rowToDesignSystemSummary(r) {
    return {
        id: r.id,
        name: r.name,
        category: r.category,
        sourceUrl: r.source_url,
        tokensJson: r.tokens_json,
        updatedAt: r.updated_at,
    };
}
function rowToDsVersion(r) {
    return {
        id: r.id,
        dsId: r.ds_id,
        authorEmail: r.author_email,
        changeJson: r.change_json,
        createdAt: r.created_at,
    };
}
function rowToSkill(r) {
    return {
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        createdAt: r.created_at,
    };
}
function rowToDirection(r) {
    return {
        id: r.id,
        name: r.name,
        description: r.description,
        moodboardJson: r.moodboard_json,
        createdAt: r.created_at,
    };
}
function rowToMediaTemplate(r) {
    return {
        id: r.id,
        name: r.name,
        type: r.type,
        promptTemplate: r.prompt_template,
        category: r.category,
        createdAt: r.created_at,
    };
}
// ── Store ─────────────────────────────────────────────────────────────────────
export class StudioStore {
    db;
    constructor(db) {
        this.db = db;
    }
    // ── Conversations ──
    listConversations(filter) {
        const where = [];
        const params = [];
        if (filter?.status) {
            where.push('status = ?');
            params.push(filter.status);
        }
        if (filter?.skillId) {
            where.push('skill_id = ?');
            params.push(filter.skillId);
        }
        if (filter?.dsId) {
            where.push('ds_id = ?');
            params.push(filter.dsId);
        }
        if (filter?.directionId) {
            where.push('direction_id = ?');
            params.push(filter.directionId);
        }
        const sql = `SELECT id, title, status, skill_id, ds_id, direction_id, updated_at
                 FROM studio_conversations
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY updated_at DESC
                 LIMIT ?`;
        params.push(filter?.limit ?? 100);
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(rowToConversationSummary);
    }
    createConversation(input) {
        const id = randomId();
        const now = new Date().toISOString();
        this.db.prepare(`INSERT INTO studio_conversations (id, title, brief_json, skill_id, ds_id, direction_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, input.title, input.briefData ? JSON.stringify(input.briefData) : null, input.skillId ?? null, input.dsId ?? null, input.directionId ?? null, now, now);
        return this.getConversation(id);
    }
    getConversation(id) {
        const row = this.db.prepare(`SELECT * FROM studio_conversations WHERE id = ?`).get(id);
        return row ? rowToConversation(row) : undefined;
    }
    updateConversation(id, patch) {
        const sets = [];
        const params = [];
        if (patch.title !== undefined) {
            sets.push('title = ?');
            params.push(patch.title);
        }
        if (patch.status !== undefined) {
            sets.push('status = ?');
            params.push(patch.status);
        }
        if ('briefData' in patch) {
            sets.push('brief_json = ?');
            params.push(patch.briefData ? JSON.stringify(patch.briefData) : null);
        }
        if ('skillId' in patch) {
            sets.push('skill_id = ?');
            params.push(patch.skillId ?? null);
        }
        if ('dsId' in patch) {
            sets.push('ds_id = ?');
            params.push(patch.dsId ?? null);
        }
        if ('directionId' in patch) {
            sets.push('direction_id = ?');
            params.push(patch.directionId ?? null);
        }
        if (!sets.length)
            return this.getConversation(id);
        sets.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);
        this.db.prepare(`UPDATE studio_conversations SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        return this.getConversation(id);
    }
    deleteConversation(id) {
        const r = this.db.prepare(`DELETE FROM studio_conversations WHERE id = ?`).run(id);
        return r.changes > 0;
    }
    // ── Messages ──
    listMessages(convId) {
        const rows = this.db.prepare(`SELECT * FROM studio_messages WHERE conv_id = ? ORDER BY created_at ASC`).all(convId);
        return rows.map(rowToMessage);
    }
    addMessage(input) {
        const id = randomId();
        const now = new Date().toISOString();
        this.db.prepare(`INSERT INTO studio_messages (id, conv_id, role, content, artifact_html, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`).run(id, input.convId, input.role, input.content, input.artifactHtml ?? null, now);
        // touch conversation updated_at
        this.db.prepare(`UPDATE studio_conversations SET updated_at = ? WHERE id = ?`).run(now, input.convId);
        return rowToMessage(this.db.prepare(`SELECT * FROM studio_messages WHERE id = ?`).get(id));
    }
    // ── Jobs ──
    createJob(input) {
        const id = randomId();
        const now = new Date().toISOString();
        this.db.prepare(`INSERT INTO studio_jobs (id, conv_id, agent_model, critique_model, prompt_snapshot, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, input.convId, input.agentModel, input.critiqueModel, input.promptSnapshot ?? '', now, now);
        return this.getJob(id);
    }
    getJob(id) {
        const row = this.db.prepare(`SELECT * FROM studio_jobs WHERE id = ?`).get(id);
        return row ? rowToJob(row) : undefined;
    }
    updateJob(id, patch) {
        const sets = [];
        const params = [];
        if (patch.status !== undefined) {
            sets.push('status = ?');
            params.push(patch.status);
        }
        if ('artifactHtml' in patch) {
            sets.push('artifact_html = ?');
            params.push(patch.artifactHtml ?? null);
        }
        if ('critiqueJson' in patch) {
            sets.push('critique_json = ?');
            params.push(patch.critiqueJson ?? null);
        }
        if ('errorMsg' in patch) {
            sets.push('error_msg = ?');
            params.push(patch.errorMsg ?? null);
        }
        if (patch.promptSnapshot !== undefined) {
            sets.push('prompt_snapshot = ?');
            params.push(patch.promptSnapshot);
        }
        if (!sets.length)
            return this.getJob(id);
        sets.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);
        this.db.prepare(`UPDATE studio_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        return this.getJob(id);
    }
    listJobs(convId, limit = 20) {
        const rows = this.db.prepare(`SELECT * FROM studio_jobs WHERE conv_id = ? ORDER BY created_at DESC LIMIT ?`).all(convId, limit);
        return rows.map(rowToJob);
    }
    listJobsForConv(convId) {
        const rows = this.db
            .prepare(`SELECT * FROM studio_jobs WHERE conv_id = ? ORDER BY created_at DESC`)
            .all(convId);
        return rows.map(rowToJob);
    }
    // ── Design Systems ──
    listDesignSystems(filter) {
        const where = [];
        const params = [];
        if (filter?.category) {
            where.push('category = ?');
            params.push(filter.category);
        }
        if (filter?.search) {
            where.push("LOWER(name) LIKE ?");
            params.push(`%${filter.search.toLowerCase()}%`);
        }
        const sql = `SELECT id, name, category, source_url, tokens_json, updated_at
                 FROM studio_design_systems
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY name ASC
                 LIMIT ?`;
        params.push(filter?.limit ?? 200);
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(rowToDesignSystemSummary);
    }
    getDesignSystem(id) {
        const row = this.db.prepare(`SELECT * FROM studio_design_systems WHERE id = ?`).get(id);
        return row ? rowToDesignSystem(row) : undefined;
    }
    updateDesignSystem(id, patch) {
        const sets = [];
        const params = [];
        if ('customTokensJson' in patch) {
            sets.push('custom_tokens_json = ?');
            params.push(patch.customTokensJson ?? null);
        }
        if ('customNotes' in patch) {
            sets.push('custom_notes = ?');
            params.push(patch.customNotes ?? null);
        }
        if (patch.guidelinesJson !== undefined) {
            sets.push('guidelines_json = ?');
            params.push(patch.guidelinesJson);
        }
        if (!sets.length)
            return this.getDesignSystem(id);
        sets.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);
        this.db.prepare(`UPDATE studio_design_systems SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        return this.getDesignSystem(id);
    }
    // ── Design System Versions ──
    createDsVersion(input) {
        const id = randomId();
        const now = new Date().toISOString();
        this.db.prepare(`INSERT INTO studio_ds_versions (id, ds_id, author_email, change_json, created_at)
       VALUES (?, ?, ?, ?, ?)`).run(id, input.dsId, input.authorEmail, input.changeJson, now);
        return rowToDsVersion(this.db.prepare(`SELECT * FROM studio_ds_versions WHERE id = ?`).get(id));
    }
    listDsVersions(dsId, limit = 20) {
        const rows = this.db.prepare(`SELECT * FROM studio_ds_versions WHERE ds_id = ? ORDER BY created_at DESC LIMIT ?`).all(dsId, limit);
        return rows.map(rowToDsVersion);
    }
    // ── Skills ──
    listSkills(filter) {
        const where = filter?.category ? 'WHERE category = ?' : '';
        const params = filter?.category ? [filter.category] : [];
        const rows = this.db.prepare(`SELECT * FROM studio_skills ${where} ORDER BY category ASC, name ASC`).all(...params);
        return rows.map(rowToSkill);
    }
    // ── Directions ──
    listDirections() {
        const rows = this.db.prepare(`SELECT * FROM studio_directions ORDER BY name ASC`).all();
        return rows.map(rowToDirection);
    }
    // ── Media Templates ──
    listMediaTemplates(filter) {
        const where = [];
        const params = [];
        if (filter?.type) {
            where.push('type = ?');
            params.push(filter.type);
        }
        if (filter?.category) {
            where.push('category = ?');
            params.push(filter.category);
        }
        const rows = this.db.prepare(`SELECT * FROM studio_media_templates
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY type ASC, name ASC`).all(...params);
        return rows.map(rowToMediaTemplate);
    }
    // ── Context ──
    resolveMemoryRepo() {
        const name = process.env.SKILLBRAIN_MEMORY_REPO || 'skillbrain';
        const entry = getRegistryEntry(name);
        if (entry)
            return entry.path;
        const entries = loadRegistry();
        if (entries.length === 1)
            return entries[0].path;
        const root = process.env.SKILLBRAIN_ROOT;
        if (root)
            return root;
        return null;
    }
    buildContextBlock(convId) {
        const conv = this.getConversation(convId);
        if (!conv)
            return '';
        const repoPath = this.resolveMemoryRepo();
        if (!repoPath)
            return '';
        let memoriesBlock = '';
        try {
            const memDb = openDb(repoPath);
            const memStore = new MemoryStore(memDb);
            try {
                const briefData = conv.briefData ?? {};
                const surface = typeof briefData.surface === 'string' ? briefData.surface : '';
                const queryParts = [surface, conv.skillId ?? ''].filter(Boolean);
                const query = queryParts.join(' ') || conv.title;
                const mems = memStore.search(query, 5);
                if (mems.length) {
                    memoriesBlock = '<memories>\n' +
                        mems.map((r) => `  <memory type="${r.memory.type}">${r.memory.context || r.memory.solution}</memory>`).join('\n') +
                        '\n</memories>';
                }
            }
            finally {
                closeDb(memDb);
            }
        }
        catch {
            // memory search is best-effort
        }
        return memoriesBlock;
    }
}
//# sourceMappingURL=studio-store.js.map