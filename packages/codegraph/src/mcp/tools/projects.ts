import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { openDb, closeDb } from '../../storage/db.js'
import { MemoryStore } from '../../storage/memory-store.js'
import { ProjectsStore } from '../../storage/projects-store.js'
import { scanProject } from '../../storage/project-scanner.js'
import { getRegistryEntry, loadRegistry } from '../../storage/registry.js'
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
      const projects = withProjectsStore(resolved.path, (store) => store.list())
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
      const project = withProjectsStore(resolved.path, (store) => store.get(name))
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
      notes: z.string().optional(),
      repo: z.string().optional(),
    },
    async ({ project, varName, value, environment, isSecret, notes, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }
      try {
        withProjectsStore(resolved.path, (store) => {
          store.setEnv(project, varName, value, environment, 'manual', isSecret, notes)
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
      repo: z.string().optional(),
    },
    async ({ project, envContent, environment, repo }) => {
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
              store.setEnv(project, name, value, environment, '.env', isSecret)
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
