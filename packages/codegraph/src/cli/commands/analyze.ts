/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import path from 'node:path'
import { openDb, clearDb, closeDb } from '../../storage/db.js'
import { GraphStore } from '../../storage/graph-store.js'
import { upsertRegistry } from '../../storage/registry.js'
import { saveMeta, loadMeta } from '../../storage/meta.js'
import { walkFiles } from '../../utils/file-walker.js'
import { getHeadCommit, getRepoName, isGitRepo } from '../../utils/git.js'
import { createProject } from '../../core/parser/ts-parser.js'
import { buildGraph } from '../../core/graph/builder.js'
import { detectCommunities } from '../../core/graph/community.js'
import { detectProcesses } from '../../core/graph/process.js'
import { info, success, warn, error } from '../../utils/logger.js'

export interface AnalyzeOptions {
  force?: boolean
  skipGit?: boolean
  noProgress?: boolean
}

export async function analyzeCommand(targetPath: string, options: AnalyzeOptions): Promise<void> {
  const repoPath = path.resolve(targetPath)
  const repoName = getRepoName(repoPath)
  const startTime = Date.now()

  info(`Analyzing ${repoName}...`)

  // Check git
  if (!options.skipGit && !isGitRepo(repoPath)) {
    error('Not a git repository. Use --skip-git to index non-git folders.')
    process.exit(1)
  }

  const headCommit = getHeadCommit(repoPath)

  // Determine indexing mode:
  //   force=true                        → full rebuild  (incremental=false)
  //   no existing meta                  → first index   (incremental=false)
  //   meta exists, same commit          → skip (return early)
  //   meta exists, different commit     → incremental   (incremental=true)
  //   headCommit is null (--skip-git)   → always full   (incremental=false)
  const existingMeta = loadMeta(repoPath)
  const canIncrement = !options.force && existingMeta !== null && headCommit !== null
  const incremental = canIncrement && existingMeta!.lastCommit !== headCommit

  if (canIncrement && existingMeta!.lastCommit === headCommit) {
    success(`Index is up to date (${existingMeta!.stats.nodes} nodes, commit ${headCommit?.slice(0, 7)})`)
    return
  }

  // Walk files
  info('Walking files...')
  const files = walkFiles(repoPath)
  info(`Found ${files.length} source files`)

  if (files.length === 0) {
    warn('No TypeScript/JavaScript files found.')
    return
  }

  // Open database
  const db = openDb(repoPath)
  const store = new GraphStore(db)

  if (options.force) {
    clearDb(db)
  }

  // Parse with ts-morph
  info('Parsing AST...')
  const project = createProject(repoPath, files)

  // Build graph
  const result = buildGraph(project, store, repoPath, incremental)
  info(`Parsed: ${result.nodes} nodes, ${result.edges} edges, ${result.files} files (${result.skipped} skipped)`)

  // Community detection
  info('Detecting communities...')
  const communities = detectCommunities(store)
  info(`Found ${communities} communities`)

  // Process detection
  info('Detecting processes...')
  const processes = detectProcesses(store)
  info(`Found ${processes} processes`)

  // Save metadata
  const stats = store.stats()
  const meta = {
    name: repoName,
    path: repoPath,
    lastCommit: headCommit,
    indexedAt: new Date().toISOString(),
    stats,
  }
  saveMeta(repoPath, meta)
  upsertRegistry({
    name: repoName,
    path: repoPath,
    lastCommit: headCommit,
    indexedAt: meta.indexedAt,
    stats,
  })

  closeDb(db)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  success(`Done in ${elapsed}s — ${stats.nodes} nodes, ${stats.edges} edges, ${stats.communities} communities, ${stats.processes} processes`)
}
