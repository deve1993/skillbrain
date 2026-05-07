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
import { openDb, closeDb, WhiteboardsStore } from '@skillbrain/storage'
import type { ToolContext } from './index.js'

const SKILLBRAIN_ROOT = process.env.SKILLBRAIN_ROOT || process.cwd()

function withStore<T>(fn: (store: WhiteboardsStore) => T): T {
  const db = openDb(SKILLBRAIN_ROOT)
  try { return fn(new WhiteboardsStore(db)) }
  finally { closeDb(db) }
}

export function registerWhiteboardTools(server: McpServer, _ctx: ToolContext): void {
  // ── List ──
  server.tool(
    'whiteboard_list',
    'List whiteboards. Filter by scope (team|project) and/or projectName. Returns id, name, scope, project, description, tags, lastOpened.',
    {
      scope: z.enum(['team', 'project']).optional(),
      projectName: z.string().optional(),
      tag: z.string().optional(),
      pinned: z.boolean().optional(),
      search: z.string().optional(),
    },
    async ({ scope, projectName, tag, pinned, search }) => {
      const boards = withStore((s) => s.list({ scope, projectName, tag, pinned, search }))
      return {
        content: [{
          type: 'text',
          text: boards.length
            ? boards.map((b) => `${b.pinnedAt ? '📌 ' : ''}[${b.id}] ${b.name} (${b.scope}${b.projectName ? ' · ' + b.projectName : ''}) — updated ${b.updatedAt.split('T')[0]}${b.tags.length ? ' #' + b.tags.join(' #') : ''}${b.description ? '\n     ' + b.description : ''}`).join('\n')
            : 'No whiteboards found.',
        }],
      }
    },
  )

  // ── Read ──
  server.tool(
    'whiteboard_read',
    'Read a whiteboard by id. Returns metadata + parsed nodes (sticky/frame/code/sb-card/...) + connectors.',
    { id: z.string().describe('Whiteboard id (12-char nanoid)') },
    async ({ id }) => {
      const board = withStore((s) => s.get(id))
      if (!board) return { content: [{ type: 'text', text: `Whiteboard ${id} not found.` }] }
      let parsed: any = {}
      try { parsed = JSON.parse(board.stateJson) } catch {}
      const summary = {
        id: board.id,
        name: board.name,
        scope: board.scope,
        projectName: board.projectName,
        description: board.description,
        tags: board.tags,
        nodes: (parsed.nodes || []).map((n: any) => ({
          id: n.id, type: n.type,
          text: n.text || n.name || n.snapshot?.title || '',
          cardKind: n.cardKind, refId: n.refId,
        })),
        connectorCount: (parsed.connectors || []).length,
        updatedAt: board.updatedAt,
        stateVersion: board.stateVersion,
      }
      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
    },
  )

  // ── Create ──
  server.tool(
    'whiteboard_create',
    'Create a new whiteboard. Optional: prepopulate with nodes + tags + description.',
    {
      name: z.string().describe('Board name'),
      scope: z.enum(['team', 'project']).default('team'),
      projectName: z.string().optional().describe('Required when scope=project'),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      nodes: z.array(z.any()).optional().describe('Initial nodes to seed (sticky/frame/sb-card/...)'),
      connectors: z.array(z.any()).optional(),
    },
    async ({ name, scope, projectName, description, tags, nodes, connectors }) => {
      if (scope === 'project' && !projectName) {
        return { content: [{ type: 'text', text: 'projectName is required when scope=project.' }] }
      }
      const stateJson = JSON.stringify({
        nodes: nodes || [],
        connectors: connectors || [],
        viewport: { x: 0, y: 0, zoom: 1 },
      })
      const board = withStore((s) => {
        const created = s.create({ name, scope, projectName: projectName ?? null, createdBy: 'mcp@local', stateJson })
        if (tags || description !== undefined) s.updateMetadata(created.id, { tags, description })
        return s.get(created.id)
      })
      return { content: [{ type: 'text', text: `Created whiteboard ${board?.id} — ${board?.name}` }] }
    },
  )

  // ── Add nodes (append to existing board) ──
  server.tool(
    'whiteboard_add_nodes',
    'Append nodes/connectors to an existing whiteboard. Use this to programmatically add sticky/sb-card/code/frame nodes.',
    {
      id: z.string(),
      nodes: z.array(z.any()).default([]),
      connectors: z.array(z.any()).optional(),
    },
    async ({ id, nodes, connectors }) => {
      const board = withStore((s) => s.get(id))
      if (!board) return { content: [{ type: 'text', text: `Board ${id} not found.` }] }
      const state = (() => { try { return JSON.parse(board.stateJson) } catch { return { nodes: [], connectors: [], viewport: { x: 0, y: 0, zoom: 1 } } } })()
      state.nodes = [...(state.nodes || []), ...nodes]
      if (connectors?.length) state.connectors = [...(state.connectors || []), ...connectors]
      withStore((s) => s.saveState({ id, stateJson: JSON.stringify(state), expectedVersion: board.stateVersion }))
      return { content: [{ type: 'text', text: `Added ${nodes.length} node(s) and ${connectors?.length || 0} connector(s) to ${board.name}.` }] }
    },
  )

  // ── Search across boards ──
  server.tool(
    'whiteboard_search',
    'Full-text search across whiteboards by name/description/state. Returns matching boards.',
    { q: z.string().describe('Search query'), limit: z.number().optional().default(20) },
    async ({ q, limit }) => {
      const boards = withStore((s) => s.searchAll(q, limit))
      return {
        content: [{
          type: 'text',
          text: boards.length
            ? boards.map((b) => `[${b.id}] ${b.name} (${b.scope}) — ${b.updatedAt.split('T')[0]}`).join('\n')
            : `No boards match "${q}".`,
        }],
      }
    },
  )
}
