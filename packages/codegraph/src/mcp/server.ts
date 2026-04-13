import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { openDb, closeDb } from '../storage/db.js'
import { GraphStore } from '../storage/graph-store.js'
import { loadRegistry, getRegistryEntry } from '../storage/registry.js'
import { loadMeta } from '../storage/meta.js'
import { analyzeImpact } from '../core/analysis/impact.js'
import { getSymbolContext } from '../core/analysis/context.js'
import { detectChanges } from '../core/analysis/change-detection.js'
import { previewRename, executeRename } from '../core/analysis/rename.js'
import { getHeadCommit } from '../utils/git.js'

function resolveRepo(nameOrPath?: string): { path: string; name: string } | null {
  if (nameOrPath) {
    const entry = getRegistryEntry(nameOrPath)
    if (entry) return { path: entry.path, name: entry.name }
  }
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
        const results = withStore(resolved.path, (store) => store.rawQuery(sql))
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
