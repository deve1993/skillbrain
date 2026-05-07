/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type Database from 'better-sqlite3'
import { randomId } from './utils/hash.js'
import { encrypt, decrypt, isEncryptionAvailable } from './crypto.js'
import type { EnvCategory } from './users-env-store.js'

export interface TeamMember {
  name: string
  role?: string
  email?: string
}

export interface Project {
  name: string
  displayName?: string
  description?: string
  clientName?: string
  category?: string
  teamLead?: string
  teamMembers: TeamMember[]
  startedAt?: string
  endedAt?: string
  status: 'active' | 'paused' | 'archived' | 'completed'
  repoUrl?: string
  mainBranch?: string
  workspacePath?: string
  stack: string[]
  language?: string
  packageManager?: string
  nodeVersion?: string
  dbType?: string
  dbReference?: string
  dbAdminUrl?: string
  cmsType?: string
  cmsAdminUrl?: string
  deployPlatform?: string
  liveUrl?: string
  deployStatus?: string
  lastDeploy?: string
  hasCi: boolean
  domainPrimary?: string
  domainsExtra: string[]
  integrations: Record<string, any>
  legalCookieBanner?: string
  legalPrivacyUrl?: string
  legalTermsUrl?: string
  aliases: string[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface EnvVar {
  id: string
  projectName: string
  varName: string
  category: EnvCategory
  service?: string
  environment: string
  source?: string
  isSecret: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

export class ProjectsStore {
  constructor(private db: Database.Database) {}

  // ── CRUD Projects ──

  upsert(project: Partial<Project> & { name: string }): Project {
    const existing = this.get(project.name)
    const now = new Date().toISOString()

    const merged: Project = {
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
    }

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
    `).run(
      merged.name, merged.displayName ?? null, merged.description ?? null, merged.clientName ?? null, merged.category ?? null,
      merged.teamLead ?? null, JSON.stringify(merged.teamMembers),
      merged.startedAt ?? null, merged.endedAt ?? null, merged.status,
      merged.repoUrl ?? null, merged.mainBranch ?? null, merged.workspacePath ?? null,
      JSON.stringify(merged.stack), merged.language ?? null, merged.packageManager ?? null, merged.nodeVersion ?? null,
      merged.dbType ?? null, merged.dbReference ?? null, merged.dbAdminUrl ?? null,
      merged.cmsType ?? null, merged.cmsAdminUrl ?? null,
      merged.deployPlatform ?? null, merged.liveUrl ?? null, merged.deployStatus ?? null, merged.lastDeploy ?? null, merged.hasCi ? 1 : 0,
      merged.domainPrimary ?? null, JSON.stringify(merged.domainsExtra),
      JSON.stringify(merged.integrations),
      merged.legalCookieBanner ?? null, merged.legalPrivacyUrl ?? null, merged.legalTermsUrl ?? null,
      JSON.stringify(merged.aliases), merged.notes ?? null, merged.createdAt, merged.updatedAt,
    )

    return merged
  }

  get(name: string): Project | undefined {
    const row = this.db.prepare('SELECT * FROM projects WHERE name = ?').get(name) as any
    return row ? this.rowToProject(row) : undefined
  }

  list(): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as any[]
    return rows.map(this.rowToProject)
  }

  delete(name: string): void {
    this.db.prepare('DELETE FROM projects WHERE name = ?').run(name)
  }

  /**
   * Merge aliases into a primary project.
   * Moves sessions/memories/env-vars from aliases → primary, then deletes alias rows.
   * Throws if the primary project does not exist.
   */
  merge(primary: string, aliases: string[]): { movedSessions: number; movedMemories: number; movedEnvVars: number } {
    if (!this.get(primary)) {
      throw new Error(`Cannot merge into non-existent project "${primary}"`)
    }

    let movedSessions = 0
    let movedMemories = 0
    let movedEnvVars = 0

    // Wrap all mutations in a single transaction so that if anything throws
    // mid-way, no partial state is committed (sessions moved but env vars
    // stranded, etc.). SQLite rolls back on exception.
    const tx = this.db.transaction(() => {
      for (const alias of aliases) {
        if (alias === primary) continue
        // Move sessions
        const s = this.db.prepare('UPDATE session_log SET project = ? WHERE project = ?').run(primary, alias)
        movedSessions += s.changes
        // Move memories
        const m = this.db.prepare('UPDATE memories SET project = ? WHERE project = ?').run(primary, alias)
        movedMemories += m.changes
        // Move env vars (must happen BEFORE delete — project_env_vars has ON DELETE CASCADE).
        // Use INSERT OR REPLACE semantics via UPDATE OR REPLACE so that if the primary
        // already has a var with the same (var_name, environment), the alias value wins.
        const e = this.db
          .prepare('UPDATE OR REPLACE project_env_vars SET project_name = ? WHERE project_name = ?')
          .run(primary, alias)
        movedEnvVars += e.changes
        // Delete alias project record (cascades to any remaining env vars, but we've moved them)
        this.delete(alias)
      }

      // Update aliases field on primary.
      // IMPORTANT: use a targeted UPDATE, not upsert() — upsert does INSERT OR REPLACE,
      // which under FK cascades would delete the primary row (and any env vars pointing
      // to it) before re-inserting.
      const proj = this.get(primary)
      if (proj) {
        const newAliases = [...new Set([...proj.aliases, ...aliases])]
        this.db
          .prepare('UPDATE projects SET aliases = ?, updated_at = ? WHERE name = ?')
          .run(JSON.stringify(newAliases), new Date().toISOString(), primary)
      }
    })
    tx()

    return { movedSessions, movedMemories, movedEnvVars }
  }

  // ── Env Vars (encrypted) ──

  setEnv(
    projectName: string,
    varName: string,
    value: string,
    environment = 'production',
    source = 'manual',
    isSecret = true,
    description?: string,
    category: EnvCategory = 'api_key',
    service?: string,
  ): void {
    if (!isEncryptionAvailable()) {
      throw new Error('ENCRYPTION_KEY not configured — env storage unavailable')
    }
    const enc = encrypt(value)
    const now = new Date().toISOString()
    const existing = this.db.prepare(
      'SELECT id FROM project_env_vars WHERE project_name = ? AND var_name = ? AND environment = ?'
    ).get(projectName, varName, environment) as any

    const id = existing?.id || randomId()
    const createdAt = existing ? undefined : now

    this.db.prepare(`
      INSERT OR REPLACE INTO project_env_vars
        (id, project_name, var_name, encrypted_value, iv, auth_tag,
         environment, source, is_secret, description, category, service, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, projectName, varName, enc.ciphertext, enc.iv, enc.authTag,
      environment, source, isSecret ? 1 : 0, description ?? null, category, service ?? null,
      createdAt ?? (existing ? (this.db.prepare('SELECT created_at FROM project_env_vars WHERE id = ?').get(id) as any)?.created_at : now),
      now,
    )
  }

  getEnv(projectName: string, varName: string, environment = 'production'): string | undefined {
    const row = this.db.prepare(
      'SELECT encrypted_value, iv, auth_tag FROM project_env_vars WHERE project_name = ? AND var_name = ? AND environment = ?'
    ).get(projectName, varName, environment) as any
    if (!row) return undefined
    return decrypt({ ciphertext: row.encrypted_value, iv: row.iv, authTag: row.auth_tag })
  }

  getAllEnv(projectName: string, environment = 'production'): Record<string, string> {
    const rows = this.db.prepare(
      'SELECT var_name, encrypted_value, iv, auth_tag FROM project_env_vars WHERE project_name = ? AND environment = ?'
    ).all(projectName, environment) as any[]
    const result: Record<string, string> = {}
    for (const r of rows) {
      try {
        result[r.var_name] = decrypt({ ciphertext: r.encrypted_value, iv: r.iv, authTag: r.auth_tag })
      } catch { /* skip invalid entries */ }
    }
    return result
  }

  listEnvNames(projectName: string, environment = 'production'): EnvVar[] {
    const rows = this.db.prepare(
      'SELECT id, project_name, var_name, environment, source, is_secret, description, category, service, created_at, updated_at FROM project_env_vars WHERE project_name = ? AND environment = ? ORDER BY var_name'
    ).all(projectName, environment) as any[]
    return rows.map((r) => ({
      id: r.id,
      projectName: r.project_name,
      varName: r.var_name,
      category: (r.category ?? 'api_key') as EnvCategory,
      service: r.service ?? undefined,
      environment: r.environment,
      source: r.source ?? undefined,
      isSecret: !!r.is_secret,
      description: r.description ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  }

  deleteEnv(projectName: string, varName: string, environment = 'production'): void {
    this.db.prepare(
      'DELETE FROM project_env_vars WHERE project_name = ? AND var_name = ? AND environment = ?'
    ).run(projectName, varName, environment)
  }

  generateEnvExample(projectName: string, environment = 'production'): string {
    const vars = this.listEnvNames(projectName, environment)
    const lines: string[] = [
      `# ${projectName} — ${environment} environment`,
      `# Generated by SkillBrain project_generate_env_example`,
      `# DO NOT commit actual values to git`,
      '',
    ]
    for (const v of vars) {
      if (v.description) lines.push(`# ${v.description}`)
      lines.push(`${v.varName}=`)
    }
    return lines.join('\n')
  }

  static sanitizeNotes(notes?: string): string | undefined {
    if (!notes) return notes
    const secretPatterns = [
      /sk-[a-zA-Z0-9_-]{20,}/,
      /eyJ[a-zA-Z0-9_-]{20,}/,
      /ANTHROPIC_API_KEY\s*=\s*\S+/i,
      /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/i,
      /JWT_SECRET\s*=\s*\S+/i,
      /SMTP_PASS\s*=\s*\S+/i,
      /ADMIN_TOKEN\s*=\s*\S+/i,
      /API_KEY\s*=\s*\S+/i,
      /SECRET\s*=\s*\S+/i,
      /PASSWORD\s*=\s*\S+/i,
    ]
    for (const pattern of secretPatterns) {
      if (pattern.test(notes)) return '[REDACTED — contains secrets]'
    }
    return notes
  }

  listSanitized(): Project[] {
    return this.list().map((p) => ({ ...p, notes: ProjectsStore.sanitizeNotes(p.notes) }))
  }

  getSanitized(name: string): Project | undefined {
    const p = this.get(name)
    return p ? { ...p, notes: ProjectsStore.sanitizeNotes(p.notes) } : undefined
  }

  private rowToProject(row: any): Project {
    let teamMembers: TeamMember[] = []
    try { teamMembers = JSON.parse(row.team_members || '[]') } catch {}
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
    }
  }
}
