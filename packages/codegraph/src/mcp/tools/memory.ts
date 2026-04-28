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
import { getRegistryEntry, loadRegistry } from '../../storage/registry.js'
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

const memoryTypes = ['Fact', 'Preference', 'Decision', 'Pattern', 'AntiPattern', 'BugFix', 'Goal', 'Todo'] as const
const memoryEdgeTypes = ['RelatedTo', 'Updates', 'Contradicts', 'CausedBy', 'PartOf'] as const

export function registerMemoryTools(server: McpServer, _ctx: ToolContext): void {
  // --- Tool: memory_add ---
  server.tool(
    'memory_add',
    'Add a new memory (learning, fact, decision, pattern, etc.) to the Memory Graph',
    {
      type: z.enum(memoryTypes).describe('Memory type'),
      context: z.string().describe('When/where this applies: "In [technology], when [situation]..."'),
      problem: z.string().describe('What went wrong or was unclear'),
      solution: z.string().describe('Actionable steps (min 10 words)'),
      reason: z.string().describe('WHY it works (not just WHAT)'),
      tags: z.array(z.string()).min(2).max(5).describe('2-5 lowercase tags'),
      confidence: z.number().min(1).max(10).optional().default(1),
      importance: z.number().min(1).max(10).optional().default(5),
      scope: z.enum(['global', 'project-specific', 'personal', 'team', 'project']).optional().default('team'),
      project: z.string().optional().describe('Project name (if scope is project or project-specific)'),
      skill: z.string().optional().describe('Associated skill name'),
      draft: z.boolean().optional().default(false).describe('If true, stores as pending-review for dashboard approval instead of going live immediately'),
      repo: z.string().optional().describe('Repository to store memory in'),
    },
    async ({ type, context, problem, solution, reason, tags, confidence, importance, scope, project, skill, draft, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found. Run codegraph_list_repos.' }] }

      const memory = withMemoryStore(resolved.path, (store) => {
        const mem = store.add({ type, context, problem, solution, reason, tags, confidence, importance, scope, project, skill, status: draft ? 'pending-review' : 'active' })

        // Auto-detect contradictions
        const contradictions = store.detectContradictions(mem)
        const contradictionWarnings = contradictions.map((c) =>
          `⚠️ Potential contradiction with ${c.id}: "${c.context.slice(0, 80)}..."`,
        )

        return { mem, contradictionWarnings }
      })

      let text = draft
        ? `⏳ Memory queued for review: ${memory.mem.id} (${memory.mem.type}) — approve at ${dashboardUrl()}/#/review`
        : `✅ Memory added: ${memory.mem.id} (${memory.mem.type}, confidence: ${memory.mem.confidence})`
      if (memory.contradictionWarnings.length > 0) {
        text += '\n\n' + memory.contradictionWarnings.join('\n')
        text += '\n\nUse memory_add_edge to create Contradicts edges if confirmed.'
      }

      return { content: [{ type: 'text', text }] }
    },
  )

  // --- Tool: memory_search ---
  server.tool(
    'memory_search',
    'Search memories by semantic query (full-text search across context, problem, solution, reason)',
    {
      query: z.string().describe('Search query (natural language)'),
      limit: z.number().optional().default(15),
      repo: z.string().optional(),
    },
    async ({ query, limit, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const results = withMemoryStore(resolved.path, (store) => store.search(query, limit))

      const formatted = results.map((r) => ({
        id: r.memory.id,
        type: r.memory.type,
        confidence: r.memory.confidence,
        context: r.memory.context,
        solution: r.memory.solution.slice(0, 200),
        tags: r.memory.tags,
        edges: r.edges.map((e) => ({ type: e.type, target: e.targetId === r.memory.id ? e.sourceId : e.targetId })),
      }))

      return {
        content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
      }
    },
  )

  // --- Tool: memory_query ---
  server.tool(
    'memory_query',
    'Query memories by type, project, skill, confidence, tags, or status',
    {
      type: z.array(z.enum(memoryTypes)).optional().describe('Filter by memory types'),
      project: z.string().optional().describe('Filter by project'),
      skill: z.string().optional().describe('Filter by skill'),
      minConfidence: z.number().optional().describe('Minimum confidence score'),
      tags: z.array(z.string()).optional().describe('Filter by tags (all must match)'),
      status: z.enum(['active', 'pending-review', 'deprecated']).optional(),
      limit: z.number().optional().default(20),
      repo: z.string().optional(),
    },
    async ({ type, project, skill, minConfidence, tags, status, limit, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const results = withMemoryStore(resolved.path, (store) =>
        store.query({ type, project, skill, minConfidence, tags, status, limit }),
      )

      const formatted = results.map((m) => ({
        id: m.id, type: m.type, confidence: m.confidence, status: m.status,
        context: m.context.slice(0, 150), tags: m.tags, skill: m.skill,
      }))

      return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] }
    },
  )

  // --- Tool: memory_load ---
  server.tool(
    'memory_load',
    'Load top-scored memories for current session (replaces load-learnings). Uses scoring algorithm: confidence, scope match, recency, skill relevance',
    {
      project: z.string().optional().describe('Current project name'),
      activeSkills: z.array(z.string()).optional().describe('Skills active in this session'),
      limit: z.number().optional().default(15),
      repo: z.string().optional(),
    },
    async ({ project, activeSkills, limit, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const results = withMemoryStore(resolved.path, (store) =>
        store.scored(project, activeSkills, limit),
      )

      const byType: Record<string, number> = {}
      const formatted = results.map((r) => {
        byType[r.memory.type] = (byType[r.memory.type] || 0) + 1
        return {
          id: r.memory.id,
          type: r.memory.type,
          confidence: r.memory.confidence,
          score: Math.round(r.rank * 10) / 10,
          context: r.memory.context,
          problem: r.memory.problem,
          solution: r.memory.solution,
          tags: r.memory.tags,
        }
      })

      const summary = `📚 Loaded ${formatted.length} memories\n` +
        Object.entries(byType).map(([t, c]) => `   ${t}: ${c}`).join('\n')

      return {
        content: [{ type: 'text', text: summary + '\n\n' + JSON.stringify(formatted, null, 2) }],
      }
    },
  )

  // --- Tool: memory_add_edge ---
  server.tool(
    'memory_add_edge',
    'Create a relationship between two memories (RelatedTo, Updates, Contradicts, CausedBy, PartOf)',
    {
      sourceId: z.string().describe('Source memory ID'),
      targetId: z.string().describe('Target memory ID'),
      type: z.enum(memoryEdgeTypes).describe('Edge type'),
      reason: z.string().optional().describe('Why this relationship exists'),
      repo: z.string().optional(),
    },
    async ({ sourceId, targetId, type, reason, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const edge = withMemoryStore(resolved.path, (store) =>
        store.addEdge(sourceId, targetId, type, reason),
      )

      return {
        content: [{ type: 'text', text: `✅ Edge created: ${sourceId} --[${type}]--> ${targetId}` }],
      }
    },
  )

  // --- Tool: memory_stats ---
  server.tool(
    'memory_stats',
    'Get Memory Graph statistics: counts by type, status, and edge count',
    {
      repo: z.string().optional(),
    },
    async ({ repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const stats = withMemoryStore(resolved.path, (store) => store.stats())

      const contradictions = withMemoryStore(resolved.path, (store) => store.getContradictions())

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...stats,
            activeContradictions: contradictions.length,
            contradictions: contradictions.map((c) => ({
              memory1: c.id1,
              memory2: c.id2,
              reason: c.reason,
            })),
          }, null, 2),
        }],
      }
    },
  )

  // --- Tool: memory_decay ---
  server.tool(
    'memory_decay',
    'Apply decay cycle: reinforce validated memories, decay unused ones, mark stale as pending-review/deprecated',
    {
      validatedIds: z.array(z.string()).describe('Memory IDs that were used/confirmed this session'),
      sessionDate: z.string().describe('Current session date (YYYY-MM-DD)'),
      repo: z.string().optional(),
    },
    async ({ validatedIds, sessionDate, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const result = withMemoryStore(resolved.path, (store) =>
        store.applyDecay(validatedIds, sessionDate),
      )

      return {
        content: [{
          type: 'text',
          text: `📋 Decay cycle complete:\n` +
            `   ✅ Reinforced: ${result.reinforced}\n` +
            `   ⏰ Decayed: ${result.decayed}\n` +
            `   🔍 Pending review: ${result.pendingReview}\n` +
            `   ❌ Deprecated: ${result.deprecated}`,
        }],
      }
    },
  )

  // --- Tool: memory_suggest ---
  server.tool(
    'memory_suggest',
    'Call this at the end of a task. Returns a template for Claude to propose 1-3 memory candidates based on what was done. Claude fills in the details and calls memory_add for each approved one.',
    {
      taskDescription: z.string().describe('What the user asked for / what was worked on'),
      outcome: z.string().describe('What happened: bugs fixed, patterns found, corrections received, decisions made'),
      project: z.string().optional(),
      repo: z.string().optional(),
    },
    async ({ taskDescription, outcome, project }) => {
      // Return structured guidance — Claude uses this to extract and propose memories
      const template = `## Memory Capture Suggestions

Based on this task:
- **Task**: ${taskDescription}
- **Outcome**: ${outcome}
${project ? `- **Project**: ${project}` : ''}

Extract 1-3 memories that would be valuable in FUTURE sessions. For each:

1. **Is this worth saving?** (skip if: one-time fix, obvious typo, trivial)
2. **Which type?**
   - \`BugFix\`: non-obvious bug with non-obvious fix
   - \`Pattern\`: reusable approach that works well
   - \`AntiPattern\`: what NOT to do (with reason)
   - \`Preference\`: user style/approach preference
   - \`Decision\`: architectural choice with rationale
   - \`Fact\`: verified technical fact

3. **Propose to user**:
\`\`\`
I learned something worth saving. Want me to save:

1. [BugFix] "When using Server Actions in Next.js 15, cookies need explicit headers()..."
   Solution: "Pass cookies via headers() instead of relying on request context"
   Reason: "Server Actions run in a different context than RSCs"

[save / skip]
\`\`\`

4. For each approved: call \`memory_add({ type, context, problem, solution, reason, tags, project, skill })\`

Only save what would SAVE FUTURE TIME. Quality over quantity.`

      return { content: [{ type: 'text', text: template }] }
    },
  )
}
