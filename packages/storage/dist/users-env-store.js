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
import { encrypt, decrypt, isEncryptionAvailable } from './crypto.js';
/**
 * Per-user master.env store. Mirrors the env methods of ProjectsStore but
 * scoped by user_id instead of project_name. Same AES-256-GCM encryption,
 * same global ENCRYPTION_KEY (isolation via user_id, not via per-user key).
 */
export class UsersEnvStore {
    db;
    constructor(db) {
        this.db = db;
    }
    setEnv(userId, varName, value, opts = {}) {
        if (!isEncryptionAvailable()) {
            throw new Error('ENCRYPTION_KEY not configured — env storage unavailable');
        }
        const enc = encrypt(value);
        const now = new Date().toISOString();
        const existing = this.db.prepare('SELECT id, created_at FROM user_env_vars WHERE user_id = ? AND var_name = ?').get(userId, varName);
        const id = existing?.id || randomId();
        const createdAt = existing?.created_at || now;
        const category = opts.category ?? 'api_key';
        const isSecret = opts.isSecret ?? (!varName.startsWith('NEXT_PUBLIC_') && !varName.startsWith('PUBLIC_'));
        this.db.prepare(`
      INSERT INTO user_env_vars
        (id, user_id, var_name, encrypted_value, iv, auth_tag,
         category, service, is_secret, description, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, var_name) DO UPDATE SET
        encrypted_value = excluded.encrypted_value,
        iv = excluded.iv,
        auth_tag = excluded.auth_tag,
        category = excluded.category,
        service = excluded.service,
        is_secret = excluded.is_secret,
        description = excluded.description,
        source = excluded.source,
        updated_at = excluded.updated_at
    `).run(id, userId, varName, enc.ciphertext, enc.iv, enc.authTag, category, opts.service ?? null, isSecret ? 1 : 0, opts.description ?? null, opts.source ?? 'manual', createdAt, now);
        return this.getMeta(userId, varName);
    }
    /**
     * Decrypt a single value and bump last_used_at.
     * Returns undefined if the var doesn't exist for this user.
     */
    getEnv(userId, varName) {
        const row = this.db.prepare('SELECT id, encrypted_value, iv, auth_tag FROM user_env_vars WHERE user_id = ? AND var_name = ?').get(userId, varName);
        if (!row)
            return undefined;
        try {
            const value = decrypt({ ciphertext: row.encrypted_value, iv: row.iv, authTag: row.auth_tag });
            this.db.prepare('UPDATE user_env_vars SET last_used_at = ? WHERE id = ?')
                .run(new Date().toISOString(), row.id);
            return value;
        }
        catch {
            return undefined;
        }
    }
    /**
     * Decrypt all env values for a user as a Record<varName, value>.
     * Used for bulk export. Does NOT bump last_used_at (to keep export idempotent).
     */
    getAllEnv(userId, opts = {}) {
        const rows = this.listEnv(userId, opts);
        const result = {};
        for (const meta of rows) {
            const row = this.db.prepare('SELECT encrypted_value, iv, auth_tag FROM user_env_vars WHERE id = ?').get(meta.id);
            if (!row)
                continue;
            try {
                result[meta.varName] = decrypt({ ciphertext: row.encrypted_value, iv: row.iv, authTag: row.auth_tag });
            }
            catch { /* skip invalid entries */ }
        }
        return result;
    }
    /**
     * List env vars for a user — names + metadata only, no values.
     * Used by hub UI and capability profile.
     */
    listEnv(userId, opts = {}) {
        const conds = ['user_id = ?'];
        const params = [userId];
        if (opts.category) {
            conds.push('category = ?');
            params.push(opts.category);
        }
        if (opts.service) {
            conds.push('service = ?');
            params.push(opts.service);
        }
        const rows = this.db.prepare(`SELECT id, user_id, var_name, category, service, is_secret, description, source, last_used_at, created_at, updated_at
       FROM user_env_vars
       WHERE ${conds.join(' AND ')}
       ORDER BY category, service, var_name`).all(...params);
        return rows.map(this.rowToMeta);
    }
    hasEnv(userId, varName) {
        const row = this.db.prepare('SELECT 1 FROM user_env_vars WHERE user_id = ? AND var_name = ?').get(userId, varName);
        return !!row;
    }
    /**
     * Capability profile: which services this user has at least one credential for.
     * Powers the session_resume payload Claude Code reads at start.
     */
    capability(userId) {
        const rows = this.db.prepare(`SELECT service, category FROM user_env_vars WHERE user_id = ?`).all(userId);
        const services = new Set();
        const categories = {
            api_key: 0, mcp_config: 0, integration: 0, preference: 0,
        };
        for (const r of rows) {
            if (r.service)
                services.add(r.service);
            categories[r.category] = (categories[r.category] ?? 0) + 1;
        }
        return {
            services: [...services].sort(),
            totalVars: rows.length,
            categories,
        };
    }
    /**
     * Names of env vars this user has that overlap with a given list of project env names.
     * Used by session_resume to flag conflicts so Claude Code knows to ask which to use.
     */
    conflictsWith(userId, projectVarNames) {
        if (projectVarNames.length === 0)
            return [];
        const placeholders = projectVarNames.map(() => '?').join(',');
        const rows = this.db.prepare(`SELECT var_name FROM user_env_vars WHERE user_id = ? AND var_name IN (${placeholders})`).all(userId, ...projectVarNames);
        return rows.map((r) => r.var_name);
    }
    deleteEnv(userId, varName) {
        const result = this.db.prepare('DELETE FROM user_env_vars WHERE user_id = ? AND var_name = ?').run(userId, varName);
        return result.changes > 0;
    }
    /**
     * Bulk import .env content. Returns { saved, errors }.
     */
    importEnv(userId, envContent, opts = {}) {
        let saved = 0;
        const errors = [];
        for (const rawLine of envContent.split('\n')) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#'))
                continue;
            const eqIdx = line.indexOf('=');
            if (eqIdx === -1)
                continue;
            const name = line.slice(0, eqIdx).trim();
            let value = line.slice(eqIdx + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!name || !value)
                continue;
            try {
                this.setEnv(userId, name, value, { ...opts, source: opts.source ?? '.env' });
                saved++;
            }
            catch (e) {
                errors.push(`${name}: ${e.message}`);
            }
        }
        return { saved, errors };
    }
    getMeta(userId, varName) {
        const row = this.db.prepare(`SELECT id, user_id, var_name, category, service, is_secret, description, source, last_used_at, created_at, updated_at
       FROM user_env_vars WHERE user_id = ? AND var_name = ?`).get(userId, varName);
        return row ? this.rowToMeta(row) : undefined;
    }
    rowToMeta(row) {
        return {
            id: row.id,
            userId: row.user_id,
            varName: row.var_name,
            category: row.category,
            service: row.service ?? undefined,
            isSecret: !!row.is_secret,
            description: row.description ?? undefined,
            source: row.source,
            lastUsedAt: row.last_used_at ?? undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
//# sourceMappingURL=users-env-store.js.map