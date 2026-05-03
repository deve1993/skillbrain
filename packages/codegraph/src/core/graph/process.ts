/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type { GraphNode, GraphEdge } from './types.js'
import { edgeId } from '../../utils/hash.js'
import { GraphStore } from '@skillbrain/storage'

/**
 * Detect execution flows (processes) by BFS from entry points.
 */
export function detectProcesses(store: GraphStore): number {
  const entryPoints = findEntryPoints(store)
  if (entryPoints.length === 0) return 0

  const processNodes: GraphNode[] = []
  const stepEdges: GraphEdge[] = []
  const previousProcessSets: Set<string>[] = []
  let processCount = 0

  for (const entry of entryPoints) {
    // BFS from entry point following CALLS edges
    const steps = bfsForward(store, entry.id, 15)
    if (steps.length < 2) continue // Need at least 2 steps for a process

    // Deduplicate: skip if > 80% overlap with any single existing process
    const stepIds = new Set(steps.map((s) => s.id))
    let overlaps = false
    for (const prevSet of previousProcessSets) {
      const overlap = [...stepIds].filter((id) => prevSet.has(id)).length
      if (overlap / steps.length > 0.8) {
        overlaps = true
        break
      }
    }
    if (overlaps) continue

    previousProcessSets.push(stepIds)

    // Create process node
    const processId = `process_${processCount}`
    const processName = generateProcessName(entry, steps)

    processNodes.push({
      id: processId,
      label: 'Process',
      name: processName,
      isExported: false,
      properties: {
        entryPoint: entry.name,
        stepCount: steps.length,
        heuristicLabel: processName,
      },
    })

    // Create STEP_IN_PROCESS edges
    for (let i = 0; i < steps.length; i++) {
      stepEdges.push({
        id: edgeId(steps[i].id, processId, 'STEP_IN_PROCESS'),
        sourceId: steps[i].id,
        targetId: processId,
        type: 'STEP_IN_PROCESS',
        confidence: 1.0,
        step: i + 1,
      })
    }

    processCount++
  }

  store.addNodesBatch(processNodes)
  store.addEdgesBatch(stepEdges)

  return processCount
}

function findEntryPoints(store: GraphStore): GraphNode[] {
  // Entry points: exported functions with no incoming CALLS edges,
  // or functions matching common patterns (pages, API routes, handlers)
  const functions = store.getNodesByLabel('Function')
  const entryPoints: GraphNode[] = []

  const ENTRY_PATTERNS = [
    /^(page|layout|loading|error|not-found)$/i,     // Next.js App Router
    /^(get|post|put|delete|patch|head|options)$/i,   // Route handlers
    /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/,     // Route handlers (exact)
    /^(handler|middleware|action)$/i,                  // Server actions / middleware
    /^(default_|generateMetadata|generateStaticParams)/i, // Next.js
    /^(use[A-Z])/, // React hooks (as entry points for client-side flows)
  ]

  for (const fn of functions) {
    // Pattern-based entry points
    const isPattern = ENTRY_PATTERNS.some((p) => p.test(fn.name))

    // No callers = potential entry point
    const callers = store.getCallers(fn.id)
    const noCaller = callers.length === 0

    // Exported functions are more likely entry points
    if (fn.isExported && (isPattern || noCaller)) {
      entryPoints.push(fn)
    }
  }

  // Limit to 50 entry points to avoid explosion
  return entryPoints.slice(0, 50)
}

function bfsForward(store: GraphStore, startId: string, maxDepth: number): GraphNode[] {
  const visited = new Set<string>()
  const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }]
  const result: GraphNode[] = []

  const startNode = store.getNode(startId)
  if (startNode) result.push(startNode)
  visited.add(startId)

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (depth >= maxDepth) continue

    const callees = store.getCallees(id)
    for (const callee of callees) {
      if (visited.has(callee.id)) continue
      visited.add(callee.id)
      result.push(callee)
      queue.push({ id: callee.id, depth: depth + 1 })
    }
  }

  return result
}

function generateProcessName(entry: GraphNode, steps: GraphNode[]): string {
  const parts: string[] = []

  // Use entry point name
  const entryName = entry.name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .toLowerCase()

  parts.push(entryName)

  // Add last step name if different
  if (steps.length > 1) {
    const last = steps[steps.length - 1]
    if (last.name !== entry.name) {
      const lastName = last.name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
      parts.push('→')
      parts.push(lastName)
    }
  }

  return parts.join(' ')
}
