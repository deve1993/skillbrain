/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { openDb, closeDb } from '@skillbrain/storage'
import { MemoryStore } from '@skillbrain/storage'
import { ProjectsStore } from '@skillbrain/storage'
import { scanProject } from '@skillbrain/storage'
import { getRegistryEntry, loadRegistry } from '@skillbrain/storage'
import type { ToolContext } from './index.js'

const MEMORY_REPO_NAME = process.env.SKILLBRAIN_MEMORY_REPO || 'skillbrain'
const SKILLBRAIN_ROOT = process.env.SKILLBRAIN_ROOT || ''

function resolveMemoryRepo(nameOrPath?: string): { path: string; name: string } | null {
  if (nameOrPath) {
    const entry = getRegistryEntry(nameOrPath)
    if (entry) return { path: entry.path, name: entry.name }
  }
  const entry = getRegistryEntry(MEMORY_REPO_NAME)
  if (entry) return { path: entry.path, name: entry.name }
  const entries = loadRegistry()
  if (entries.length === 1) return { path: entries[0].path, name: entries[0].name }
  if (SKILLBRAIN_ROOT) return { path: SKILLBRAIN_ROOT, name: 'skillbrain' }
  return null
}

function withProjectsStore<T>(repoPath: string, fn: (store: ProjectsStore) => T): T {
  const db = openDb(repoPath)
  const store = new ProjectsStore(db)
  try {
    return fn(store)
  } finally {
    closeDb(db)
  }
}

function withMemoryStore<T>(repoPath: string, fn: (store: MemoryStore) => T): T {
  const db = openDb(repoPath)
  const store = new MemoryStore(db)
  try {
    return fn(store)
  } finally {
    closeDb(db)
  }
}

export function registerProjectTools(server: McpServer, _ctx: ToolContext): void {
  // --- Tool: project_list ---
  server.tool(
    'project_list',
    'List all projects with their status, last session, memories, and next steps',
    { repo: z.string().optional() },
    async ({ repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const projects = withMemoryStore(resolved.path, (store) => store.listProjects())

      if (projects.length === 0) {
        return { content: [{ type: 'text', text: 'No projects found. Projects are auto-created when you use session_start with a project name.' }] }
      }

      const formatted = projects.map((p) => ({
        name: p.name,
        status: p.lastSession?.status || 'unknown',
        lastWorked: p.lastSession?.date?.split('T')[0] || 'never',
        task: p.lastSession?.task || null,
        nextSteps: p.lastSession?.nextSteps || null,
        blockers: p.blockers || null,
        sessions: p.totalSessions,
        memories: p.totalMemories,
        branch: p.lastBranch || null,
      }))

      return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] }
    },
  )

  // --- Tool: project_scan ---
  server.tool(
    'project_scan',
    'Scan a workspace directory to auto-detect project metadata (stack, repo, CMS, DB, deploy, integrations, env var names). Returns detected fields + list of missing fields to ask the user.',
    {
      workspacePath: z.string().describe('Absolute path to project workspace'),
      save: z.boolean().optional().default(true).describe('Save detected fields to DB'),
      repo: z.string().optional(),
    },
    async ({ workspacePath, save, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const result = scanProject(workspacePath)

      if (save) {
        withProjectsStore(resolved.path, (store) => store.upsert({
          name: result.detected.name,
          displayName: result.detected.displayName,
          repoUrl: result.detected.repoUrl,
          mainBranch: result.detected.mainBranch,
          workspacePath,
          startedAt: result.detected.startedAt,
          stack: result.detected.stack,
          language: result.detected.language,
          packageManager: result.detected.packageManager,
          nodeVersion: result.detected.nodeVersion,
          dbType: result.detected.dbType,
          cmsType: result.detected.cmsType,
          cmsAdminUrl: result.detected.cmsAdminUrl,
          deployPlatform: result.detected.deployPlatform,
          hasCi: result.detected.hasCi,
          integrations: result.detected.integrations,
          legalCookieBanner: result.detected.legalCookieBanner,
        }))
      }

      return {
        content: [{
          type: 'text',
          text: `## Scanned ${result.detected.name}\n\n` +
            `**Detected:**\n${JSON.stringify(result.detected, null, 2)}\n\n` +
            `**Missing — ask user:**\n${result.missing.map((m) => `- ${m.field}: ${m.prompt}`).join('\n')}\n\n` +
            `Env vars found in .env.example: ${result.detected.envVarNames.length}\n` +
            `Ask user to provide actual values → use project_set_env_batch or project_set_env for each.`,
        }],
      }
    },
  )

  // --- Tool: project_list_full ---
  server.tool(
    'project_list_full',
    'List all projects with full metadata (includes stack, repo, live URL, client, status)',
    { repo: z.string().optional() },
    async ({ repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      const projects = withProjectsStore(resolved.path, (store) => store.listSanitized())
      return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] }
    },
  )

  // --- Tool: project_get ---
  server.tool(
    'project_get',
    'Get full metadata for a single project',
    { name: z.string(), repo: z.string().optional() },
    async ({ name, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      const project = withProjectsStore(resolved.path, (store) => store.getSanitized(name))
      if (!project) return { content: [{ type: 'text', text: `Project "${name}" not found. Use project_scan to create it.` }] }
      return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] }
    },
  )

  // --- Tool: project_update ---
  server.tool(
    'project_update',
    'Update one or more fields on a project',
    {
      name: z.string().describe('Project name'),
      fields: z.object({
        displayName: z.string().optional(),
        description: z.string().optional(),
        clientName: z.string().optional(),
        category: z.string().optional(),
        teamLead: z.string().optional().describe('Lead developer/owner (e.g., "Daniel")'),
        teamMembers: z.array(z.object({
          name: z.string(),
          role: z.string().optional(),
          email: z.string().optional(),
        })).optional().describe('Team members with optional role'),
        status: z.enum(['active', 'paused', 'archived', 'completed']).optional(),
        endedAt: z.string().optional(),
        liveUrl: z.string().optional(),
        dbReference: z.string().optional(),
        dbAdminUrl: z.string().optional(),
        cmsAdminUrl: z.string().optional(),
        deployPlatform: z.string().optional(),
        domainPrimary: z.string().optional(),
        notes: z.string().optional(),
      }).describe('Fields to update'),
      repo: z.string().optional(),
    },
    async ({ name, fields, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      const project = withProjectsStore(resolved.path, (store) => store.upsert({ name, ...fields }))
      return { content: [{ type: 'text', text: `✅ Updated ${project.name}\n${JSON.stringify(fields, null, 2)}` }] }
    },
  )

  // --- Tool: project_set_env ---
  server.tool(
    'project_set_env',
    'Encrypt and save an env variable value for a project (AES-256-GCM). Also updates .env.example-style tracking.',
    {
      project: z.string(),
      varName: z.string().describe('Env var name (e.g., MONGODB_URI)'),
      value: z.string().describe('Actual value to encrypt and save'),
      environment: z.enum(['production', 'staging', 'development']).optional().default('production'),
      isSecret: z.boolean().optional().default(true),
      category: z.enum(['api_key', 'mcp_config', 'integration', 'preference']).optional().default('api_key').describe('Type of env var'),
      service: z.string().optional().describe('External service name (e.g., supabase, stripe, openai)'),
      description: z.string().optional().describe('Human-readable description of what this var is used for'),
      repo: z.string().optional(),
    },
    async ({ project, varName, value, environment, isSecret, category, service, description, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      try {
        withProjectsStore(resolved.path, (store) => {
          store.setEnv(project, varName, value, environment, 'manual', isSecret, description, category, service)
        })
        return { content: [{ type: 'text', text: `✅ Saved ${varName} (encrypted) for ${project}/${environment}` }] }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }] }
      }
    },
  )

  // --- Tool: project_set_env_batch ---
  server.tool(
    'project_set_env_batch',
    'Parse a raw .env file content and encrypt all variables in one call',
    {
      project: z.string(),
      envContent: z.string().describe('Raw .env file content (KEY=value lines)'),
      environment: z.enum(['production', 'staging', 'development']).optional().default('production'),
      category: z.enum(['api_key', 'mcp_config', 'integration', 'preference']).optional().default('api_key').describe('Category applied to all vars in this batch'),
      service: z.string().optional().describe('External service name applied to all vars in this batch (e.g., supabase)'),
      repo: z.string().optional(),
    },
    async ({ project, envContent, environment, category, service, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      const lines = envContent.split('\n')
      let saved = 0
      let errors: string[] = []
      try {
        withProjectsStore(resolved.path, (store) => {
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue
            const eqIdx = trimmed.indexOf('=')
            if (eqIdx === -1) continue
            const name = trimmed.slice(0, eqIdx).trim()
            let value = trimmed.slice(eqIdx + 1).trim()
            // Strip surrounding quotes
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1)
            }
            if (!name || !value) continue
            try {
              const isSecret = !name.startsWith('NEXT_PUBLIC_') && !name.startsWith('PUBLIC_')
              store.setEnv(project, name, value, environment, '.env', isSecret, undefined, category, service)
              saved++
            } catch (e: any) {
              errors.push(`${name}: ${e.message}`)
            }
          }
        })
        return { content: [{ type: 'text', text: `✅ Saved ${saved} env vars for ${project}/${environment}${errors.length ? `\n⚠️ ${errors.length} errors:\n${errors.join('\n')}` : ''}` }] }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }] }
      }
    },
  )

  // --- Tool: project_get_env ---
  server.tool(
    'project_get_env',
    'Retrieve decrypted env vars for a project (to restore .env.local or copy to deploy). Returns full key=value pairs.',
    {
      project: z.string(),
      environment: z.enum(['production', 'staging', 'development']).optional().default('production'),
      format: z.enum(['json', 'dotenv']).optional().default('dotenv').describe('Output format'),
      repo: z.string().optional(),
    },
    async ({ project, environment, format, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      try {
        const vars = withProjectsStore(resolved.path, (store) => store.getAllEnv(project, environment))
        if (Object.keys(vars).length === 0) {
          return { content: [{ type: 'text', text: `No env vars found for ${project}/${environment}` }] }
        }
        if (format === 'json') {
          return { content: [{ type: 'text', text: JSON.stringify(vars, null, 2) }] }
        }
        const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`)
        return { content: [{ type: 'text', text: lines.join('\n') }] }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }] }
      }
    },
  )

  // --- Tool: project_generate_env_example ---
  server.tool(
    'project_generate_env_example',
    'Generate .env.example template with variable names (no values) from stored env vars',
    { project: z.string(), environment: z.string().optional().default('production'), repo: z.string().optional() },
    async ({ project, environment, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      const template = withProjectsStore(resolved.path, (store) => store.generateEnvExample(project, environment))
      return { content: [{ type: 'text', text: template }] }
    },
  )

  // --- Tool: project_create ---
  server.tool(
    'project_create',
    'Create a new project explicitly. Fails if a project with the same name already exists. For implicit auto-create (no-fail upsert) use project_scan instead.',
    {
      name: z.string().describe('Unique project name (primary key)'),
      displayName: z.string().optional(),
      description: z.string().optional(),
      clientName: z.string().optional(),
      category: z.string().optional(),
      workspacePath: z.string().optional().describe('Absolute path to project workspace on disk'),
      repoUrl: z.string().optional(),
      mainBranch: z.string().optional(),
      stack: z.array(z.string()).optional(),
      language: z.string().optional(),
      packageManager: z.string().optional(),
      deployPlatform: z.string().optional(),
      liveUrl: z.string().optional(),
      domainPrimary: z.string().optional(),
      status: z.enum(['active', 'paused', 'archived', 'completed']).optional().default('active'),
      teamLead: z.string().optional(),
      notes: z.string().optional(),
      repo: z.string().optional(),
    },
    async ({ repo, ...fields }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      try {
        const created = withProjectsStore(resolved.path, (store) => {
          if (store.get(fields.name)) {
            throw new Error(`Project "${fields.name}" already exists. Use project_update to modify or project_clone to duplicate.`)
          }
          return store.upsert({ ...fields, startedAt: new Date().toISOString() })
        })
        return { content: [{ type: 'text', text: `✅ Created project "${created.name}"\n${JSON.stringify({ name: created.name, status: created.status, workspacePath: created.workspacePath, stack: created.stack }, null, 2)}` }] }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }] }
      }
    },
  )

  // --- Tool: project_delete ---
  server.tool(
    'project_delete',
    'Permanently delete a project and ALL associated data (sessions, memories, env vars). Irreversible. Requires confirm=true. For soft-delete prefer project_update with status="archived".',
    {
      name: z.string().describe('Project name to delete'),
      confirm: z.literal(true).describe('Must be explicitly true — guards against accidental deletion'),
      repo: z.string().optional(),
    },
    async ({ name, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      try {
        const counts = withProjectsStore(resolved.path, (store) => store.purge(name))
        return { content: [{ type: 'text', text: `🗑️ Deleted "${name}"\n  Sessions removed: ${counts.sessions}\n  Memories removed: ${counts.memories}\n  Env vars removed: ${counts.envVars}` }] }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }] }
      }
    },
  )

  // --- Tool: project_repair ---
  server.tool(
    'project_repair',
    'Health-check a project: workspace path exists on disk, git remote reachable, env vars complete vs detected stack. Read-only — returns issues + suggested fixes without writing.',
    {
      name: z.string().describe('Project to inspect'),
      repo: z.string().optional(),
    },
    async ({ name, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      const project = withProjectsStore(resolved.path, (store) => store.get(name))
      if (!project) return { content: [{ type: 'text', text: `Project "${name}" not found.` }] }

      const fs = await import('node:fs')
      const path = await import('node:path')
      const issues: { severity: 'error' | 'warn' | 'info'; field: string; message: string; suggestedFix: string }[] = []

      // 1. Workspace path
      if (!project.workspacePath) {
        issues.push({ severity: 'warn', field: 'workspacePath', message: 'No workspacePath set', suggestedFix: 'Run project_scan or project_update with workspacePath' })
      } else if (!fs.existsSync(project.workspacePath)) {
        issues.push({ severity: 'error', field: 'workspacePath', message: `Path does not exist on disk: ${project.workspacePath}`, suggestedFix: 'Update workspacePath via project_update, or archive the project' })
      } else {
        const gitDir = path.join(project.workspacePath, '.git')
        if (!fs.existsSync(gitDir)) {
          issues.push({ severity: 'warn', field: 'workspacePath', message: 'No .git directory — workspace exists but is not a repo', suggestedFix: 'Initialize git or update workspacePath' })
        }
      }

      // 2. Re-scan and diff against stored metadata
      if (project.workspacePath && fs.existsSync(project.workspacePath)) {
        try {
          const fresh = scanProject(project.workspacePath)
          const d = fresh.detected
          if (d.repoUrl && d.repoUrl !== project.repoUrl) {
            issues.push({ severity: 'info', field: 'repoUrl', message: `DB has "${project.repoUrl || '∅'}" but disk reports "${d.repoUrl}"`, suggestedFix: `project_update name="${name}" fields={ repoUrl: "${d.repoUrl}" }` })
          }
          if (d.stack && d.stack.length && JSON.stringify(d.stack.sort()) !== JSON.stringify((project.stack || []).slice().sort())) {
            issues.push({ severity: 'info', field: 'stack', message: `Stack drift — DB: [${(project.stack || []).join(', ')}] vs disk: [${d.stack.join(', ')}]`, suggestedFix: `project_scan workspacePath="${project.workspacePath}"` })
          }
          if (d.packageManager && d.packageManager !== project.packageManager) {
            issues.push({ severity: 'info', field: 'packageManager', message: `DB: ${project.packageManager || '∅'}, disk: ${d.packageManager}`, suggestedFix: `project_update with packageManager` })
          }
          // 3. Missing env vars
          const stored = withProjectsStore(resolved.path, (store) => store.listEnvNames(name, 'production'))
          const storedNames = new Set(stored.map((v) => v.varName))
          const missing = (d.envVarNames || []).filter((v: string) => !storedNames.has(v))
          if (missing.length > 0) {
            issues.push({ severity: 'warn', field: 'envVars', message: `${missing.length} env vars in .env.example without stored values: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`, suggestedFix: `project_set_env or project_set_env_batch for each` })
          }
        } catch (e: any) {
          issues.push({ severity: 'warn', field: 'scan', message: `Scan failed: ${e.message}`, suggestedFix: 'Inspect workspace manually' })
        }
      }

      // 4. Status sanity
      if (project.status === 'archived' && (project.endedAt == null || project.endedAt === '')) {
        issues.push({ severity: 'info', field: 'endedAt', message: 'Archived but endedAt is empty', suggestedFix: `project_update endedAt="${new Date().toISOString()}"` })
      }

      const summary = issues.length === 0
        ? `✅ "${name}" looks healthy. No issues detected.`
        : `🔍 ${issues.length} issue(s) on "${name}"\n\n` + issues.map((i, n) => `${n + 1}. [${i.severity.toUpperCase()}] ${i.field}: ${i.message}\n   → ${i.suggestedFix}`).join('\n\n')

      return { content: [{ type: 'text', text: summary }] }
    },
  )

  // --- Tool: project_clone ---
  server.tool(
    'project_clone',
    'Duplicate a project as a template — copies metadata (stack, integrations, team) under a new name. Does NOT copy env var values, sessions, or memories. Optionally copies env var NAMES as placeholders.',
    {
      source: z.string().describe('Existing project to clone'),
      target: z.string().describe('Name for the new project (must not exist)'),
      includeEnvSchema: z.boolean().optional().default(false).describe('If true, copy env var NAMES (not values) as placeholders with value "TODO_SET_ME"'),
      repo: z.string().optional(),
    },
    async ({ source, target, includeEnvSchema, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      try {
        const result = withProjectsStore(resolved.path, (store) => {
          const src = store.get(source)
          if (!src) throw new Error(`Source project "${source}" not found`)
          if (store.get(target)) throw new Error(`Target project "${target}" already exists`)

          const now = new Date().toISOString()
          store.upsert({
            name: target,
            displayName: src.displayName,
            description: src.description ? `${src.description} (cloned from ${source})` : `Cloned from ${source}`,
            clientName: src.clientName,
            category: src.category,
            teamLead: src.teamLead,
            teamMembers: src.teamMembers,
            status: 'active',
            startedAt: now,
            mainBranch: src.mainBranch,
            stack: src.stack,
            language: src.language,
            packageManager: src.packageManager,
            nodeVersion: src.nodeVersion,
            dbType: src.dbType,
            cmsType: src.cmsType,
            deployPlatform: src.deployPlatform,
            hasCi: src.hasCi,
            integrations: src.integrations,
            // explicitly NOT copied: workspacePath, repoUrl, liveUrl, domainPrimary, dbReference, dbAdminUrl, cmsAdminUrl, lastDeploy
          })

          let envSchemaCopied = 0
          if (includeEnvSchema) {
            const vars = store.listEnvNames(source, 'production')
            for (const v of vars) {
              try {
                store.setEnv(target, v.varName, 'TODO_SET_ME', 'production', 'cloned', v.isSecret, v.description, v.category, v.service)
                envSchemaCopied++
              } catch { /* skip on error */ }
            }
          }
          return { envSchemaCopied }
        })
        return { content: [{ type: 'text', text: `✅ Cloned "${source}" → "${target}"\n  Env schema copied: ${result.envSchemaCopied} vars (placeholders)\n  Next: project_update "${target}" workspacePath, repoUrl, liveUrl as needed.` }] }
      } catch (err: any) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }] }
      }
    },
  )

  // --- Tool: project_merge ---
  server.tool(
    'project_merge',
    'Merge duplicate projects into one primary. Moves all sessions/memories from aliases to primary, then deletes alias records.',
    {
      primary: z.string().describe('Primary project name to keep'),
      aliases: z.array(z.string()).describe('Aliases to merge into primary'),
      repo: z.string().optional(),
    },
    async ({ primary, aliases, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      const result = withProjectsStore(resolved.path, (store) => store.merge(primary, aliases))
      return { content: [{ type: 'text', text: `✅ Merged ${aliases.length} aliases into ${primary}\n  Sessions moved: ${result.movedSessions}\n  Memories moved: ${result.movedMemories}\n  Env vars moved: ${result.movedEnvVars}` }] }
    },
  )
}
