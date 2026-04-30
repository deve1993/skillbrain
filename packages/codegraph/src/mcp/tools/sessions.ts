/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { openDb, closeDb } from '../../storage/db.js'
import { MemoryStore } from '../../storage/memory-store.js'
import { ComponentsStore } from '../../storage/components-store.js'
import { ProjectsStore } from '../../storage/projects-store.js'
import { UsersEnvStore } from '../../storage/users-env-store.js'
import { getRegistryEntry, loadRegistry } from '../../storage/registry.js'
import { SkillsStore } from '../../storage/skills-store.js'
import {
  detectDesignFiles, parseTailwindConfig, parseCSSVariables,
  parseTokensJson, mergeTokenSources, type TokenSource,
} from '../../storage/design-token-parser.js'
import { dashboardUrl } from '../../constants.js'
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

function withMemoryStore<T>(repoPath: string, fn: (store: MemoryStore) => T): T {
  const db = openDb(repoPath)
  const store = new MemoryStore(db)
  try {
    return fn(store)
  } finally {
    closeDb(db)
  }
}

export function registerSessionTools(server: McpServer, ctx: ToolContext): void {
  // --- Tool: session_start ---
  server.tool(
    'session_start',
    'Log the start of a new session. Include project and task for context continuity.',
    {
      sessionName: z.string().describe('Session name (e.g., "MASTER_Fullstack", "Mobile")'),
      project: z.string().optional().describe('Project name (e.g., "Quickfy", "pixarts-landing")'),
      task: z.string().optional().describe('What you are working on (e.g., "add stripe payments", "fix auth bug")'),
      branch: z.string().optional().describe('Git branch name'),
      workspacePath: z.string().optional(),
      repo: z.string().optional(),
    },
    async ({ sessionName, project, task, branch, workspacePath, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const session = withMemoryStore(resolved.path, (store) =>
        store.startSession(sessionName, project, workspacePath, task, branch),
      )

      // Check if there's a previous session for this project
      let resumeContext = ''
      if (project) {
        const prev = withMemoryStore(resolved.path, (store) => store.lastProjectSession(project))
        if (prev && prev.id !== session.id) {
          resumeContext = `\n\nPrevious session on "${project}":`
          resumeContext += `\n  Last worked: ${prev.startedAt.split('T')[0]}`
          resumeContext += `\n  Task: ${prev.taskDescription || 'not specified'}`
          resumeContext += `\n  Status: ${prev.status}`
          if (prev.summary) resumeContext += `\n  Summary: ${prev.summary}`
          if (prev.nextSteps) resumeContext += `\n  Next steps: ${prev.nextSteps}`
          if (prev.blockers) resumeContext += `\n  Blockers: ${prev.blockers}`
          resumeContext += `\n\nUse session_resume for full project history.`
        }
      }

      // Auto-scan design tokens if workspacePath + project provided
      if (workspacePath && project) {
        try {
          const files = detectDesignFiles(workspacePath)
          if (files.tailwind || files.css || files.tokensJson) {
            const sources: TokenSource[] = []
            if (files.tailwind) sources.push({ source: 'tailwind', path: files.tailwind, tokens: parseTailwindConfig(files.tailwind) })
            if (files.css) sources.push({ source: 'css', path: files.css, tokens: parseCSSVariables(files.css) })
            if (files.tokensJson) sources.push({ source: 'tokens_json', path: files.tokensJson, tokens: parseTokensJson(files.tokensJson) })

            const { merged, conflicts } = mergeTokenSources(sources)
            const db = openDb(resolved.path)
            const store = new ComponentsStore(db)
            try {
              if (conflicts.length === 0) {
                store.upsertDesignSystem({ project, ...merged })
                const colorCount = Object.keys(merged.colors ?? {}).length
                resumeContext += `\n\n🎨 Design system auto-updated (${colorCount} colors, ${Object.keys(merged.fonts ?? {}).length} fonts)`
              } else {
                const scan = store.addDesignSystemScan({ project, sources, merged, conflicts })
                resumeContext += `\n\n⚠️  Design system scan pending review (${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''}) — ${dashboardUrl()}/#/design-systems [${scan.id}]`
              }
            } finally {
              closeDb(db)
            }
          }
        } catch { /* non-blocking — don't fail session_start */ }
      }

      return { content: [{ type: 'text', text: `Session started: ${session.id} (${sessionName}${project ? ` / ${project}` : ''})${resumeContext}` }] }
    },
  )

  // --- Tool: session_end ---
  server.tool(
    'session_end',
    'Log the end of a session with summary, deliverables, next steps, and status',
    {
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
    },
    async ({ sessionId, summary, deliverables, workType, nextSteps, blockers, status, memoriesCreated, memoriesValidated, filesChanged, commits, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      withMemoryStore(resolved.path, (store) => {
        store.endSession(sessionId, summary, memoriesCreated, memoriesValidated, filesChanged, nextSteps, blockers, commits, status, workType as any, deliverables)
        // Index session content as verbatim searchable chunks (MemPalace pattern)
        const fullText = [summary, deliverables, nextSteps].filter(Boolean).join('\n\n')
        if (fullText.length > 50) store.indexSessionChunks(sessionId, fullText, undefined, new Date().toISOString())
      })

      // Skill proposal analysis: group memories from this session by skill tag
      const skillProposals = withMemoryStore(resolved.path, (store) => {
        const mems = (store as any).db.prepare(
          `SELECT id, tags FROM memories WHERE source_session = ? AND tags LIKE '%skill:%' AND status != 'deprecated'`
        ).all(sessionId) as { id: string; tags: string }[]

        const grouped: Record<string, string[]> = {}
        for (const m of mems) {
          const tags: string[] = JSON.parse(m.tags || '[]')
          for (const tag of tags) {
            if (tag.startsWith('skill:')) {
              const skillName = tag.replace('skill:', '')
              grouped[skillName] = [...(grouped[skillName] ?? []), m.id]
            }
          }
        }

        const created: string[] = []
        for (const [skillName, memIds] of Object.entries(grouped)) {
          if (memIds.length >= 2) {
            const propId = `SP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            try {
              ;(store as any).db.prepare(
                `INSERT OR IGNORE INTO skill_proposals (id, skill_name, session_id, memory_ids) VALUES (?, ?, ?, ?)`
              ).run(propId, skillName, sessionId, JSON.stringify(memIds))
              created.push(skillName)
            } catch { /* table may not exist yet in old DBs */ }
          }
        }
        return created
      })

      let text = `Session ${sessionId} ended (${status}).${deliverables ? `\nDelivered: ${deliverables}` : ''}${nextSteps ? `\nNext steps: ${nextSteps}` : ''}`
      if (skillProposals.length > 0) {
        text += `\n\n💡 Skill update proposals created for: ${skillProposals.join(', ')} — review at ${dashboardUrl()}/#/review`
      }
      return { content: [{ type: 'text', text }] }
    },
  )

  // --- Tool: session_heartbeat ---
  server.tool(
    'session_heartbeat',
    'Update session last_heartbeat timestamp (called periodically by proxy to keep session alive)',
    {
      sessionId: z.string().describe('Session ID'),
      repo: z.string().optional(),
    },
    async ({ sessionId, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      withMemoryStore(resolved.path, (store) => store.heartbeat(sessionId))
      return { content: [{ type: 'text', text: `ok` }] }
    },
  )

  // --- Tool: session_search ---
  server.tool(
    'session_search',
    'Search verbatim content from past session summaries and deliverables',
    {
      query: z.string().describe('Search query'),
      limit: z.number().optional().default(10).describe('Max results'),
      repo: z.string().optional(),
    },
    async ({ query, limit, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const results = withMemoryStore(resolved.path, (store) => store.searchSessions(query, limit ?? 10))
      if (!results || results.length === 0) {
        return { content: [{ type: 'text', text: `No past session content found for: "${query}"` }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
    },
  )

  // --- Tool: session_resume ---
  server.tool(
    'session_resume',
    'Get full context for resuming work on a project — last session, pending work, next steps, recent memories',
    {
      project: z.string().describe('Project name to resume'),
      repo: z.string().optional(),
    },
    async ({ project, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const db = openDb(resolved.path)
      const memStore = new MemoryStore(db)

      // Get project sessions
      const sessions = memStore.projectSessions(project, 5)
      const pending = memStore.pendingSessions().filter((s) => s.project === project)

      // Get project-specific memories
      const memories = memStore.query({ project, limit: 10 })

      // Get recent memories related to this project
      const searchResults = memStore.search(project, 5, project)

      // Capability profile from THIS user's master.env (when MCP session is bound to a user).
      // Includes which env var names overlap with the project's env so Claude Code knows
      // up-front to ask which to use rather than silently picking one.
      let capability: {
        userEnv: { services: string[]; totalVars: number; categories: Record<string, number> } | null
        conflictsWithProject: string[]
      } = { userEnv: null, conflictsWithProject: [] }
      if (ctx.userId) {
        try {
          const usersEnv = new UsersEnvStore(db)
          const projectVarNames = new ProjectsStore(db)
            .listEnvNames(project, 'production')
            .map((v) => v.varName)
          capability = {
            userEnv: usersEnv.capability(ctx.userId),
            conflictsWithProject: usersEnv.conflictsWith(ctx.userId, projectVarNames),
          }
        } catch { /* user_env_vars table may not be migrated yet on legacy DBs */ }
      }

      // Recommend skills based on last task or project name
      const skillStore = new SkillsStore(db)
      const taskHint = sessions[0]?.taskDescription || project
      const recommendedSkills = taskHint ? skillStore.route(taskHint, 5) : []

      closeDb(db)

      if (sessions.length === 0 && memories.length === 0) {
        return { content: [{ type: 'text', text: `No history found for project "${project}". This is a fresh start.` }] }
      }

      const last = sessions[0]
      const lines: string[] = [
        `## Resume Context: ${project}`,
        '',
      ]

      if (last) {
        lines.push(`### Last Session`)
        lines.push(`- **Date**: ${last.startedAt.split('T')[0]}`)
        lines.push(`- **Task**: ${last.taskDescription || 'not specified'}`)
        lines.push(`- **Status**: ${last.status}`)
        if (last.summary) lines.push(`- **Summary**: ${last.summary}`)
        if (last.nextSteps) lines.push(`- **Next steps**: ${last.nextSteps}`)
        if (last.blockers) lines.push(`- **Blockers**: ${last.blockers}`)
        if (last.branch) lines.push(`- **Branch**: ${last.branch}`)
        if (last.filesChanged.length) lines.push(`- **Files changed**: ${last.filesChanged.slice(0, 10).join(', ')}`)
        if (last.commits.length) lines.push(`- **Commits**: ${last.commits.join(', ')}`)
        lines.push('')
      }

      if (pending.length > 0) {
        lines.push(`### Pending Work (${pending.length})`)
        for (const s of pending) {
          lines.push(`- [${s.status}] ${s.taskDescription || s.summary || 'no description'} (${s.startedAt.split('T')[0]})`)
        }
        lines.push('')
      }

      if (sessions.length > 1) {
        lines.push(`### Session History (last ${sessions.length})`)
        for (const s of sessions) {
          const date = s.startedAt.split('T')[0]
          lines.push(`- **${date}** [${s.status}]: ${s.summary || s.taskDescription || 'no summary'} (+${s.memoriesCreated} memories)`)
        }
        lines.push('')
      }

      if (memories.length > 0) {
        lines.push(`### Project Memories (${memories.length})`)
        for (const m of memories) {
          lines.push(`- [${m.type} conf:${m.confidence}] ${m.context.slice(0, 100)}`)
        }
        lines.push('')
      }

      if (searchResults.length > 0) {
        lines.push(`### Related Knowledge`)
        for (const r of searchResults) {
          if (!memories.find((m) => m.id === r.memory.id)) {
            lines.push(`- [${r.memory.type} conf:${r.memory.confidence}] ${r.memory.context.slice(0, 100)}`)
          }
        }
        lines.push('')
      }

      if (recommendedSkills.length > 0) {
        lines.push(`### Recommended Skills for this Task`)
        for (const s of recommendedSkills) {
          lines.push(`- **${s.name}** (${s.category}): ${s.description.slice(0, 100)}`)
        }
        lines.push('')
      }

      if (capability.userEnv) {
        const cap = capability.userEnv
        lines.push(`### Your Capability Profile (master.env)`)
        if (cap.totalVars === 0) {
          lines.push(`- No personal credentials saved yet. Add them at /#/my-env in the hub.`)
        } else {
          lines.push(`- **Services available**: ${cap.services.length ? cap.services.join(', ') : '(none tagged)'}`)
          lines.push(`- **Vars**: ${cap.totalVars} total — api_key:${cap.categories.api_key} mcp_config:${cap.categories.mcp_config} integration:${cap.categories.integration} preference:${cap.categories.preference}`)
          if (capability.conflictsWithProject.length) {
            lines.push(`- ⚠️ **Conflicts with project ${project}**: ${capability.conflictsWithProject.join(', ')}`)
            lines.push(`  → ASK the user which to use for each task. Do NOT pick silently.`)
          }
          lines.push(`- Use \`user_env_get\` to fetch a value, \`user_env_available\` to check before using a tool.`)
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  // --- Tool: session_history ---
  server.tool(
    'session_history',
    'Get recent session history, optionally filtered by project',
    {
      project: z.string().optional().describe('Filter by project name'),
      limit: z.number().optional().default(10),
      repo: z.string().optional(),
    },
    async ({ project, limit, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const sessions = withMemoryStore(resolved.path, (store) =>
        project ? store.projectSessions(project, limit) : store.recentSessions(limit),
      )

      if (sessions.length === 0) {
        return { content: [{ type: 'text', text: project ? `No sessions found for project "${project}".` : 'No session history found.' }] }
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
      }))

      return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] }
    },
  )
}
