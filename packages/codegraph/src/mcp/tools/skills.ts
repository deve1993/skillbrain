import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { openDb, closeDb } from '../../storage/db.js'
import { MemoryStore } from '../../storage/memory-store.js'
import { SkillsStore } from '../../storage/skills-store.js'
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

function withSkillsStore<T>(repoPath: string, fn: (store: SkillsStore) => T): T {
  const db = openDb(repoPath)
  const store = new SkillsStore(db)
  try {
    return fn(store)
  } finally {
    closeDb(db)
  }
}

const skillTypes = ['domain', 'lifecycle', 'process', 'agent', 'command'] as const

export function registerSkillTools(server: McpServer, _ctx: ToolContext): void {
  // --- Tool: skill_list ---
  server.tool(
    'skill_list',
    'List all available skills, optionally filtered by type or category',
    {
      type: z.enum(skillTypes).optional().describe('Filter: domain, lifecycle, process, agent, command'),
      category: z.string().optional().describe('Filter by category name'),
      repo: z.string().optional(),
    },
    async ({ type, category, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const skills = withSkillsStore(resolved.path, (store) => store.list(type, category))
      const formatted = skills.map((s) => ({
        name: s.name, category: s.category, type: s.type,
        description: s.description.slice(0, 120), lines: s.lines,
      }))

      return { content: [{ type: 'text', text: `${formatted.length} skills found:\n\n${JSON.stringify(formatted, null, 2)}` }] }
    },
  )

  // --- Tool: skill_read ---
  server.tool(
    'skill_read',
    'Read the full content of a skill, agent, or command by name',
    {
      name: z.string().describe('Skill name (e.g., "nextjs", "agent:builder", "command:frontend")'),
      repo: z.string().optional(),
    },
    async ({ name, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const skill = withSkillsStore(resolved.path, (store) => store.get(name))
      if (!skill) return { content: [{ type: 'text', text: `Skill "${name}" not found. Use skill_list to see available skills.` }] }

      return {
        content: [{
          type: 'text',
          text: `# ${skill.name} (${skill.type}, ${skill.category})\n\n${skill.content}`,
        }],
      }
    },
  )

  // --- Tool: skill_update ---
  server.tool(
    'skill_update',
    'Update the content of an existing skill in the database. Use after generating an improved version based on recent learnings.',
    {
      name: z.string().describe('Skill name (must exist — use skill_list to verify)'),
      content: z.string().describe('Full updated SKILL.md content (complete replacement)'),
      reason: z.string().optional().describe('Why this update was made'),
      repo: z.string().optional(),
    },
    async ({ name, content, reason, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const result = withSkillsStore(resolved.path, (store) => {
        const existing = store.get(name)
        if (!existing) return null
        store.upsert({
          ...existing,
          content,
          lines: content.split('\n').length,
          updatedAt: new Date().toISOString(),
        })
        return existing.name
      })

      if (!result) {
        return { content: [{ type: 'text', text: `Skill "${name}" not found. Use skill_list to see available skills.` }] }
      }

      return {
        content: [{
          type: 'text',
          text: `Skill "${name}" updated successfully.${reason ? ` Reason: ${reason}` : ''}`,
        }],
      }
    },
  )

  // --- Tool: skill_route ---
  server.tool(
    'skill_route',
    'Given a task description, find the best skills to load (semantic search)',
    {
      task: z.string().describe('What you want to do (e.g., "add stripe payments", "fix auth bug")'),
      limit: z.number().optional().default(5),
      repo: z.string().optional(),
    },
    async ({ task, limit, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const skills = withSkillsStore(resolved.path, (store) => store.route(task, limit))
      const formatted = skills.map((s) => ({
        name: s.name, category: s.category, type: s.type,
        description: s.description.slice(0, 150), lines: s.lines,
      }))

      return {
        content: [{
          type: 'text',
          text: `Recommended skills for "${task}":\n\n${JSON.stringify(formatted, null, 2)}\n\nUse skill_read to load any skill.`,
        }],
      }
    },
  )

  // --- Tool: agent_list ---
  server.tool(
    'agent_list',
    'List all available agents with their model, effort level, and purpose',
    { repo: z.string().optional() },
    async ({ repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const agents = withSkillsStore(resolved.path, (store) => store.list('agent'))
      const formatted = agents.map((a) => ({
        name: a.name.replace('agent:', ''),
        description: a.description.slice(0, 120),
        lines: a.lines,
      }))

      return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] }
    },
  )

  // --- Tool: agent_read ---
  server.tool(
    'agent_read',
    'Read the full prompt of an agent',
    {
      name: z.string().describe('Agent name (e.g., "builder", "planner", "ux-designer")'),
      repo: z.string().optional(),
    },
    async ({ name, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const agentName = name.startsWith('agent:') ? name : `agent:${name}`
      const agent = withSkillsStore(resolved.path, (store) => store.get(agentName))
      if (!agent) return { content: [{ type: 'text', text: `Agent "${name}" not found. Use agent_list.` }] }

      return { content: [{ type: 'text', text: agent.content }] }
    },
  )

  // --- Tool: command_list ---
  server.tool(
    'command_list',
    'List all available slash commands',
    { repo: z.string().optional() },
    async ({ repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const commands = withSkillsStore(resolved.path, (store) => store.list('command'))
      const formatted = commands.map((c) => ({
        name: '/' + c.name.replace('command:', ''),
        description: c.description,
        lines: c.lines,
      }))

      return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] }
    },
  )

  // --- Tool: command_read ---
  server.tool(
    'command_read',
    'Read the full content of a slash command',
    {
      name: z.string().describe('Command name (e.g., "frontend", "audit", "new-project")'),
      repo: z.string().optional(),
    },
    async ({ name, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const cmdName = name.startsWith('command:') ? name : `command:${name}`
      const cmd = withSkillsStore(resolved.path, (store) => store.get(cmdName))
      if (!cmd) return { content: [{ type: 'text', text: `Command "${name}" not found. Use command_list.` }] }

      return { content: [{ type: 'text', text: cmd.content }] }
    },
  )

  // --- Tool: cortex_briefing ---
  server.tool(
    'cortex_briefing',
    'Generate a 5-layer working memory briefing for the current session context',
    {
      project: z.string().optional().describe('Current project name'),
      task: z.string().optional().describe('What you are about to work on'),
      repo: z.string().optional(),
    },
    async ({ project, task, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const db = openDb(resolved.path)
      const memStore = new MemoryStore(db)
      const skillStore = new SkillsStore(db)

      // Layer 1: Identity
      const skillStats = skillStore.stats()

      // Layer 2: Recent sessions
      const sessions = memStore.recentSessions(5)

      // Layer 3: Memory stats
      const memStats = memStore.stats()
      const contradictions = memStore.getContradictions()

      // Layer 4: Top memories for task
      let topMemories: any[] = []
      if (task) {
        topMemories = memStore.search(task, 10).map((r) => ({
          id: r.memory.id, type: r.memory.type, confidence: r.memory.confidence,
          context: r.memory.context, solution: r.memory.solution.slice(0, 200),
        }))
      } else {
        topMemories = memStore.scored(project, undefined, 10).map((r) => ({
          id: r.memory.id, type: r.memory.type, confidence: r.memory.confidence,
          context: r.memory.context, solution: r.memory.solution.slice(0, 200),
        }))
      }

      // Layer 5: Relevant skills for task
      let relevantSkills: any[] = []
      if (task) {
        relevantSkills = skillStore.route(task, 5).map((s) => ({
          name: s.name, category: s.category, description: s.description.slice(0, 100),
        }))
      }

      closeDb(db)

      const briefing = [
        `## Cortex Briefing`,
        ``,
        `### Layer 1: System`,
        `- Skills: ${skillStats.total} (${Object.entries(skillStats.byType).map(([t, c]) => `${t}: ${c}`).join(', ')})`,
        `- Memories: ${memStats.total} active, ${memStats.edges} edges`,
        `- Contradictions: ${contradictions.length}`,
        ``,
        `### Layer 2: Recent Sessions`,
        sessions.length > 0
          ? sessions.map((s) => `- **${s.sessionName}** (${s.startedAt.split('T')[0]}): ${s.summary || 'no summary'} [+${s.memoriesCreated} memories]`).join('\n')
          : '- No session history yet',
        ``,
        `### Layer 3: Project Context`,
        `- Project: ${project || 'not specified'}`,
        `- Task: ${task || 'not specified'}`,
        ``,
        `### Layer 4: Relevant Memories (${topMemories.length})`,
        topMemories.map((m) => `- [${m.type} conf:${m.confidence}] ${m.context}`).join('\n') || '- No memories found',
        ``,
        `### Layer 5: Recommended Skills (${relevantSkills.length})`,
        relevantSkills.map((s) => `- **${s.name}** (${s.category}): ${s.description}`).join('\n') || '- Use skill_route for task-specific recommendations',
      ].join('\n')

      return { content: [{ type: 'text', text: briefing }] }
    },
  )

  // --- Tool: skill_stats ---
  server.tool(
    'skill_stats',
    'Get statistics about all skills, agents, and commands in the system',
    { repo: z.string().optional() },
    async ({ repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const stats = withSkillsStore(resolved.path, (store) => store.stats())
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] }
    },
  )
}
