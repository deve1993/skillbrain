import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { openDb, closeDb } from '../storage/db.js'
import { GraphStore } from '../storage/graph-store.js'
import { MemoryStore, type MemoryType, type MemoryEdgeType } from '../storage/memory-store.js'
import { loadRegistry, getRegistryEntry } from '../storage/registry.js'
import { loadMeta } from '../storage/meta.js'
import { analyzeImpact } from '../core/analysis/impact.js'
import { getSymbolContext } from '../core/analysis/context.js'
import { detectChanges } from '../core/analysis/change-detection.js'
import { previewRename, executeRename } from '../core/analysis/rename.js'
import { getHeadCommit } from '../utils/git.js'

const MEMORY_REPO_NAME = process.env.SKILLBRAIN_MEMORY_REPO || 'skillbrain'

function resolveRepo(nameOrPath?: string): { path: string; name: string } | null {
  if (nameOrPath) {
    const entry = getRegistryEntry(nameOrPath)
    if (entry) return { path: entry.path, name: entry.name }
  }
  const entries = loadRegistry()
  if (entries.length === 1) return { path: entries[0].path, name: entries[0].name }
  return null
}

// Memory tools always resolve to the central SkillBrain repo
// so memories are shared across ALL sessions
function resolveMemoryRepo(nameOrPath?: string): { path: string; name: string } | null {
  if (nameOrPath) {
    const entry = getRegistryEntry(nameOrPath)
    if (entry) return { path: entry.path, name: entry.name }
  }
  // Default to skillbrain repo for shared memory
  const entry = getRegistryEntry(MEMORY_REPO_NAME)
  if (entry) return { path: entry.path, name: entry.name }
  // Fallback to single-repo behavior
  const entries = loadRegistry()
  if (entries.length === 1) return { path: entries[0].path, name: entries[0].name }
  return null
}

function withStore<T>(repoPath: string, fn: (store: GraphStore) => T): T {
  const db = openDb(repoPath)
  const store = new GraphStore(db)
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

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'codegraph',
    version: '0.1.0',
  })

  // --- Tool: list_repos ---
  server.tool('codegraph_list_repos', 'List all indexed repositories', {}, async () => {
    const entries = loadRegistry()
    return {
      content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }],
    }
  })

  // --- Tool: query ---
  server.tool(
    'codegraph_query',
    'Search the code graph by concept, symptom, or keyword',
    {
      query: z.string().describe('Search query (concept, function name, error symptom)'),
      repo: z.string().optional().describe('Repository name or path'),
      limit: z.number().optional().default(10).describe('Max results'),
    },
    async ({ query, repo, limit }) => {
      const resolved = resolveRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found. Run codegraph_list_repos to see available repos.' }] }

      const results = withStore(resolved.path, (store) => store.search(query, limit))
      const formatted = results.map((r) => ({
        name: r.node.name,
        label: r.node.label,
        file: r.node.filePath,
        line: r.node.startLine,
        score: Math.abs(r.rank),
      }))

      return {
        content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
      }
    },
  )

  // --- Tool: context ---
  server.tool(
    'codegraph_context',
    '360-degree view of a symbol: callers, callees, processes, community',
    {
      name: z.string().describe('Symbol name to analyze'),
      repo: z.string().optional().describe('Repository name or path'),
    },
    async ({ name, repo }) => {
      const resolved = resolveRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const result = withStore(resolved.path, (store) => getSymbolContext(store, name))
      if (!result) return { content: [{ type: 'text', text: `Symbol "${name}" not found.` }] }

      const formatted = {
        symbol: { name: result.symbol.name, label: result.symbol.label, file: result.symbol.filePath, line: result.symbol.startLine },
        callers: result.callers.map((c) => ({ name: c.name, file: c.filePath })),
        callees: result.callees.map((c) => ({ name: c.name, file: c.filePath })),
        processes: result.processes,
        community: result.community,
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
      }
    },
  )

  // --- Tool: impact ---
  server.tool(
    'codegraph_impact',
    'Blast radius analysis: what breaks if you change this symbol',
    {
      target: z.string().describe('Symbol name to analyze'),
      direction: z.enum(['upstream', 'downstream', 'both']).optional().default('upstream'),
      maxDepth: z.number().optional().default(3),
      minConfidence: z.number().optional().default(0.5),
      repo: z.string().optional(),
    },
    async ({ target, direction, maxDepth, minConfidence, repo }) => {
      const resolved = resolveRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const result = withStore(resolved.path, (store) =>
        analyzeImpact(store, target, direction, maxDepth, minConfidence),
      )
      if (!result) return { content: [{ type: 'text', text: `Symbol "${target}" not found.` }] }

      const grouped: Record<string, any[]> = {}
      for (const item of result.items) {
        const key = `d=${item.depth}`
        if (!grouped[key]) grouped[key] = []
        grouped[key].push({
          name: item.name,
          label: item.label,
          file: item.filePath,
          confidence: item.confidence,
        })
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            target: result.target,
            riskLevel: result.riskLevel,
            totalAffected: result.items.length,
            affectedProcesses: result.affectedProcesses,
            byDepth: grouped,
          }, null, 2),
        }],
      }
    },
  )

  // --- Tool: detect_changes ---
  server.tool(
    'codegraph_detect_changes',
    'Map git changes to affected symbols and processes',
    {
      scope: z.enum(['staged', 'all', 'compare']).optional().default('all'),
      baseRef: z.string().optional().default('main'),
      repo: z.string().optional(),
    },
    async ({ scope, baseRef, repo }) => {
      const resolved = resolveRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const result = withStore(resolved.path, (store) =>
        detectChanges(store, resolved.path, scope, baseRef),
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            changedFiles: result.changedFiles.length,
            affectedSymbols: result.affectedSymbols.map((s) => ({ name: s.name, label: s.label, file: s.filePath })),
            affectedProcesses: result.affectedProcesses,
            riskLevel: result.riskLevel,
          }, null, 2),
        }],
      }
    },
  )

  // --- Tool: rename ---
  server.tool(
    'codegraph_rename',
    'Rename a symbol across all files using graph knowledge',
    {
      symbolName: z.string().describe('Current symbol name'),
      newName: z.string().describe('New symbol name'),
      dryRun: z.boolean().optional().default(true).describe('Preview only (true) or apply (false)'),
      repo: z.string().optional(),
    },
    async ({ symbolName, newName, dryRun, repo }) => {
      const resolved = resolveRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const preview = withStore(resolved.path, (store) =>
        previewRename(store, resolved.path, symbolName, newName),
      )

      if (!dryRun) {
        const applied = executeRename(resolved.path, preview, symbolName, newName)
        return {
          content: [{ type: 'text', text: JSON.stringify({ applied, files: preview.changes.length }, null, 2) }],
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalEdits: preview.totalEdits,
            files: preview.changes.map((c) => ({
              file: c.filePath,
              edits: c.edits.map((e) => ({
                line: e.line,
                old: e.oldText,
                new: e.newText,
                confidence: e.confidence,
                source: e.source,
              })),
            })),
          }, null, 2),
        }],
      }
    },
  )

  // --- Tool: cypher (SQL translation) ---
  server.tool(
    'codegraph_cypher',
    'Run a raw SQL query against the graph database',
    {
      query: z.string().describe('SQL query (tables: nodes, edges, files)'),
      repo: z.string().optional(),
    },
    async ({ query: sql, repo }) => {
      const resolved = resolveRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      try {
        const results = withStore(resolved.path, (store) => {
          // Enforce read-only mode to prevent DROP/DELETE/UPDATE via user queries
          store.exec('PRAGMA query_only = ON')
          try {
            return store.rawQuery(sql)
          } finally {
            store.exec('PRAGMA query_only = OFF')
          }
        })
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        }
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Query error: ${err.message}` }],
        }
      }
    },
  )

  // ═══════════════════════════════════════════════════════
  // Memory Graph Tools
  // ═══════════════════════════════════════════════════════

  const memoryTypes = ['Fact', 'Preference', 'Decision', 'Pattern', 'AntiPattern', 'BugFix', 'Goal', 'Todo'] as const
  const memoryEdgeTypes = ['RelatedTo', 'Updates', 'Contradicts', 'CausedBy', 'PartOf'] as const

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
      scope: z.enum(['global', 'project-specific']).optional().default('global'),
      project: z.string().optional().describe('Project name (if scope is project-specific)'),
      skill: z.string().optional().describe('Associated skill name'),
      repo: z.string().optional().describe('Repository to store memory in'),
    },
    async ({ type, context, problem, solution, reason, tags, confidence, importance, scope, project, skill, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found. Run codegraph_list_repos.' }] }

      const memory = withMemoryStore(resolved.path, (store) => {
        const mem = store.add({ type, context, problem, solution, reason, tags, confidence, importance, scope, project, skill })

        // Auto-detect contradictions
        const contradictions = store.detectContradictions(mem)
        const contradictionWarnings = contradictions.map((c) =>
          `⚠️ Potential contradiction with ${c.id}: "${c.context.slice(0, 80)}..."`,
        )

        return { mem, contradictionWarnings }
      })

      let text = `✅ Memory added: ${memory.mem.id} (${memory.mem.type}, confidence: ${memory.mem.confidence})`
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

  // ═══════════════════════════════════════════════════════
  // Session Log Tools (Cortex / Working Memory)
  // ═══════════════════════════════════════════════════════

  // --- Tool: session_start ---
  server.tool(
    'session_start',
    'Log the start of a new Claude Code session (for cross-session awareness)',
    {
      sessionName: z.string().describe('Session name (e.g., "MASTER_Fullstack", "Mobile")'),
      project: z.string().optional().describe('Current project name'),
      workspacePath: z.string().optional().describe('Workspace path'),
      repo: z.string().optional(),
    },
    async ({ sessionName, project, workspacePath, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const session = withMemoryStore(resolved.path, (store) =>
        store.startSession(sessionName, project, workspacePath),
      )

      return { content: [{ type: 'text', text: `Session started: ${session.id} (${sessionName})` }] }
    },
  )

  // --- Tool: session_end ---
  server.tool(
    'session_end',
    'Log the end of a session with summary and stats',
    {
      sessionId: z.string().describe('Session ID from session_start'),
      summary: z.string().describe('Brief session summary'),
      memoriesCreated: z.number().default(0),
      memoriesValidated: z.number().default(0),
      filesChanged: z.array(z.string()).default([]),
      repo: z.string().optional(),
    },
    async ({ sessionId, summary, memoriesCreated, memoriesValidated, filesChanged, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      withMemoryStore(resolved.path, (store) =>
        store.endSession(sessionId, summary, memoriesCreated, memoriesValidated, filesChanged),
      )

      return { content: [{ type: 'text', text: `Session ${sessionId} ended.` }] }
    },
  )

  // --- Tool: session_history ---
  server.tool(
    'session_history',
    'Get recent session history across all Claude Code sessions (cross-session awareness)',
    {
      limit: z.number().optional().default(5),
      repo: z.string().optional(),
    },
    async ({ limit, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const sessions = withMemoryStore(resolved.path, (store) => store.recentSessions(limit))

      if (sessions.length === 0) {
        return { content: [{ type: 'text', text: 'No session history found.' }] }
      }

      const formatted = sessions.map((s) => ({
        id: s.id,
        session: s.sessionName,
        started: s.startedAt,
        ended: s.endedAt || 'still running',
        summary: s.summary || 'no summary',
        memories: `+${s.memoriesCreated} created, ${s.memoriesValidated} validated`,
        project: s.project || 'none',
      }))

      return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] }
    },
  )

  // --- Resources ---
  server.resource('codegraph://repos', 'codegraph://repos', async () => {
    const entries = loadRegistry()
    return { contents: [{ uri: 'codegraph://repos', text: JSON.stringify(entries, null, 2), mimeType: 'application/json' }] }
  })

  // Resource: repo context (overview + staleness)
  server.resource('codegraph://repo/context', 'codegraph://repo/{name}/context', async (uri) => {
    const name = extractRepoName(uri.toString())
    const resolved = resolveRepo(name)
    if (!resolved) return { contents: [{ uri: uri.toString(), text: 'Repository not found', mimeType: 'text/plain' }] }

    const meta = loadMeta(resolved.path)
    const head = getHeadCommit(resolved.path)
    const isStale = head !== null && meta?.lastCommit !== head
    const stats = meta?.stats || { nodes: 0, edges: 0, files: 0, communities: 0, processes: 0 }

    const context = {
      name: resolved.name,
      path: resolved.path,
      indexedAt: meta?.indexedAt,
      isStale,
      headCommit: head?.slice(0, 7),
      indexedCommit: meta?.lastCommit?.slice(0, 7),
      ...stats,
    }

    return { contents: [{ uri: uri.toString(), text: JSON.stringify(context, null, 2), mimeType: 'application/json' }] }
  })

  // Resource: clusters (communities)
  server.resource('codegraph://repo/clusters', 'codegraph://repo/{name}/clusters', async (uri) => {
    const name = extractRepoName(uri.toString())
    const resolved = resolveRepo(name)
    if (!resolved) return { contents: [{ uri: uri.toString(), text: '[]', mimeType: 'application/json' }] }

    const clusters = withStore(resolved.path, (store) => {
      const communities = store.getNodesByLabel('Community')
      return communities.map((c) => ({
        name: c.name,
        id: c.id,
        memberCount: c.properties?.memberCount || 0,
      }))
    })

    return { contents: [{ uri: uri.toString(), text: JSON.stringify(clusters, null, 2), mimeType: 'application/json' }] }
  })

  // Resource: processes
  server.resource('codegraph://repo/processes', 'codegraph://repo/{name}/processes', async (uri) => {
    const name = extractRepoName(uri.toString())
    const resolved = resolveRepo(name)
    if (!resolved) return { contents: [{ uri: uri.toString(), text: '[]', mimeType: 'application/json' }] }

    const processes = withStore(resolved.path, (store) => {
      const procs = store.getNodesByLabel('Process')
      return procs.map((p) => ({
        name: p.name,
        id: p.id,
        entryPoint: p.properties?.entryPoint,
        stepCount: p.properties?.stepCount,
      }))
    })

    return { contents: [{ uri: uri.toString(), text: JSON.stringify(processes, null, 2), mimeType: 'application/json' }] }
  })

  // Resource: schema
  server.resource('codegraph://repo/schema', 'codegraph://repo/{name}/schema', async (uri) => {
    const schema = {
      nodeLabels: ['File', 'Function', 'Class', 'Method', 'Interface', 'Community', 'Process'],
      edgeTypes: ['CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'HAS_METHOD', 'MEMBER_OF', 'STEP_IN_PROCESS'],
      tables: {
        nodes: 'id TEXT PK, label TEXT, name TEXT, file_path TEXT, start_line INT, end_line INT, is_exported INT, properties JSON',
        edges: 'id TEXT PK, source_id TEXT FK, target_id TEXT FK, type TEXT, confidence REAL, reason TEXT, step INT',
        files: 'path TEXT PK, content_hash TEXT, indexed_at TEXT, symbol_count INT',
      },
      queryExamples: [
        "SELECT * FROM nodes WHERE label = 'Function' AND is_exported = 1",
        "SELECT n1.name AS caller, n2.name AS callee FROM edges e JOIN nodes n1 ON e.source_id = n1.id JOIN nodes n2 ON e.target_id = n2.id WHERE e.type = 'CALLS'",
        "SELECT n.name, e.step FROM nodes n JOIN edges e ON e.source_id = n.id WHERE e.target_id = '<process_id>' AND e.type = 'STEP_IN_PROCESS' ORDER BY e.step",
      ],
    }

    return { contents: [{ uri: uri.toString(), text: JSON.stringify(schema, null, 2), mimeType: 'application/json' }] }
  })

  // Resource: cluster detail
  server.resource('codegraph://repo/cluster', 'codegraph://repo/{name}/cluster/{cluster}', async (uri) => {
    const parts = uri.toString().split('/')
    const clusterName = decodeURIComponent(parts[parts.length - 1])
    const repoName = parts.length >= 5 ? parts[parts.length - 3] : undefined
    const resolved = resolveRepo(repoName)
    if (!resolved) return { contents: [{ uri: uri.toString(), text: '[]', mimeType: 'application/json' }] }

    const members = withStore(resolved.path, (store) => {
      const communities = store.getNodesByLabel('Community')
      const community = communities.find((c) => c.name === clusterName)
      if (!community) return []
      return store.getCommunityMembers(community.id).map((m) => ({
        name: m.name,
        label: m.label,
        file: m.filePath,
      }))
    })

    return { contents: [{ uri: uri.toString(), text: JSON.stringify(members, null, 2), mimeType: 'application/json' }] }
  })

  // Resource: process detail
  server.resource('codegraph://repo/process', 'codegraph://repo/{name}/process/{process}', async (uri) => {
    const parts = uri.toString().split('/')
    const processName = decodeURIComponent(parts[parts.length - 1])
    const repoName = parts.length >= 5 ? parts[parts.length - 3] : undefined
    const resolved = resolveRepo(repoName)
    if (!resolved) return { contents: [{ uri: uri.toString(), text: '[]', mimeType: 'application/json' }] }

    const steps = withStore(resolved.path, (store) => {
      const processes = store.getNodesByLabel('Process')
      const proc = processes.find((p) => p.name === processName)
      if (!proc) return []
      return store.getProcessSteps(proc.id).map((s) => ({
        step: s.step,
        name: s.name,
        label: s.label,
        file: s.filePath,
      }))
    })

    return { contents: [{ uri: uri.toString(), text: JSON.stringify(steps, null, 2), mimeType: 'application/json' }] }
  })

  // Connect transport
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

function extractRepoName(uri: string): string | undefined {
  // codegraph://repo/{name}/context → name
  const match = uri.match(/codegraph:\/\/repo\/([^/]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}
