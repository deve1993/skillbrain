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
import { openDb, closeDb, StudioStore } from '@skillbrain/storage'
import type { ToolContext } from './index.js'

const getRoot = (): string => process.env.SKILLBRAIN_ROOT || ''

export function registerStudioTools(server: McpServer, ctx: ToolContext): void {
  // --- Tool: design_studio_init ---
  server.tool(
    'design_studio_init',
    'Create a new Studio conversation with optional brief and pickers',
    {
      title: z.string(),
      brief: z.object({
        surface: z.string(),
        audience: z.string(),
        tone: z.string(),
        brand: z.string(),
        scale: z.string(),
      }).optional(),
      skillId: z.string().optional(),
      dsId: z.string().optional(),
      directionId: z.string().optional(),
    },
    async (args) => {
      const db = openDb(getRoot())
      const store = new StudioStore(db)
      try {
        const result = store.createConversation({
          title: args.title,
          briefData: args.brief ?? null,
          skillId: args.skillId,
          dsId: args.dsId,
          directionId: args.directionId,
        })
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true }
      } finally {
        closeDb(db)
      }
    },
  )

  // --- Tool: design_studio_list ---
  server.tool(
    'design_studio_list',
    'List Studio conversations',
    {
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async (args) => {
      const db = openDb(getRoot())
      const store = new StudioStore(db)
      try {
        const result = store.listConversations({ limit: args.limit })
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true }
      } finally {
        closeDb(db)
      }
    },
  )

  // --- Tool: design_studio_get ---
  server.tool(
    'design_studio_get',
    'Get a Studio conversation with all messages',
    {
      id: z.string(),
    },
    async (args) => {
      const db = openDb(getRoot())
      const store = new StudioStore(db)
      try {
        const result = store.getConversation(args.id)
        if (!result) {
          return { content: [{ type: 'text' as const, text: 'Conversation not found' }], isError: true }
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true }
      } finally {
        closeDb(db)
      }
    },
  )

  // --- Tool: design_studio_generate ---
  server.tool(
    'design_studio_generate',
    'Enqueue a generation job for a Studio conversation',
    {
      conversationId: z.string(),
      agentModel: z.string().optional(),
      critiqueModel: z.string().optional(),
    },
    async (args) => {
      const agentModel = args.agentModel || 'claude-sonnet-4-6'
      const critiqueModel = args.critiqueModel || 'claude-haiku-4-5-20251001'
      const db = openDb(getRoot())
      const store = new StudioStore(db)
      try {
        const contextBlock = store.buildContextBlock(args.conversationId)
        const job = store.createJob({
          convId: args.conversationId,
          agentModel,
          critiqueModel,
          promptSnapshot: contextBlock,
        })
        return { content: [{ type: 'text' as const, text: JSON.stringify({ jobId: job.id, contextBlock }, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true }
      } finally {
        closeDb(db)
      }
    },
  )

  // --- Tool: design_studio_critique ---
  server.tool(
    'design_studio_critique',
    'Get the critique results for a completed generation job',
    {
      jobId: z.string(),
    },
    async (args) => {
      const db = openDb(getRoot())
      const store = new StudioStore(db)
      try {
        const job = store.getJob(args.jobId)
        if (!job) {
          return { content: [{ type: 'text' as const, text: 'Job not found' }], isError: true }
        }
        if (job.status !== 'done') {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ status: job.status }) }] }
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify({ critiqueJson: job.critiqueJson }, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true }
      } finally {
        closeDb(db)
      }
    },
  )

  // --- Tool: design_studio_ds_list ---
  server.tool(
    'design_studio_ds_list',
    'List available Design Systems in the Studio catalog',
    {
      search: z.string().optional(),
      limit: z.number().optional(),
    },
    async (args) => {
      const db = openDb(getRoot())
      const store = new StudioStore(db)
      try {
        const result = store.listDesignSystems({ search: args.search, limit: args.limit })
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true }
      } finally {
        closeDb(db)
      }
    },
  )

  // --- Tool: design_studio_ds_get ---
  server.tool(
    'design_studio_ds_get',
    'Get a Design System with full context for generation',
    {
      id: z.string(),
    },
    async (args) => {
      const db = openDb(getRoot())
      const store = new StudioStore(db)
      try {
        const result = store.getDesignSystem(args.id)
        if (!result) {
          return { content: [{ type: 'text' as const, text: 'Design System not found' }], isError: true }
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true }
      } finally {
        closeDb(db)
      }
    },
  )

  // --- Tool: design_studio_context ---
  server.tool(
    'design_studio_context',
    'Build the memory + codegraph context block for a conversation prompt',
    {
      conversationId: z.string(),
    },
    async (args) => {
      const db = openDb(getRoot())
      const store = new StudioStore(db)
      try {
        const contextBlock = store.buildContextBlock(args.conversationId)
        return { content: [{ type: 'text' as const, text: contextBlock }] }
      } catch (e) {
        return { content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true }
      } finally {
        closeDb(db)
      }
    },
  )

  void ctx
}
