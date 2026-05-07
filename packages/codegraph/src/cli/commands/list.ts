/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { loadRegistry } from '@skillbrain/storage'

export function listCommand(): void {
  const entries = loadRegistry()

  if (entries.length === 0) {
    console.log('No indexed repositories.')
    return
  }

  console.log(`\n  Indexed repositories (${entries.length}):\n`)

  for (const entry of entries) {
    const age = timeSince(entry.indexedAt)
    console.log(`  ${entry.name}`)
    console.log(`    Path:        ${entry.path}`)
    console.log(`    Indexed:     ${age} ago`)
    console.log(`    Nodes:       ${entry.stats.nodes}`)
    console.log(`    Edges:       ${entry.stats.edges}`)
    console.log(`    Communities: ${entry.stats.communities}`)
    console.log(`    Processes:   ${entry.stats.processes}`)
    console.log(``)
  }
}

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
