/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

/**
 * Migration script: learnings.md → Memory Graph SQLite
 *
 * Scans .agents/skills/ and .opencode/skill/ for learnings.md files,
 * parses YAML-style learning entries, and inserts them into the Memory Graph.
 *
 * Usage: node dist/storage/migrate-learnings.js <workspace-path>
 */

import fs from 'node:fs'
import path from 'node:path'
import { openDb } from './db.js'
import { MemoryStore, type MemoryType, type MemoryInput } from './memory-store.js'

interface ParsedLearning {
  id: string
  date: string
  type: string
  status: string
  project: string
  scope: string
  tags: string[]
  confidence: number
  context: string
  problem: string
  solution: string
  reason: string
  validatedBy: string[]
  createdIn: string
  supersedes?: string
  supersededBy?: string
  reinforces: string[]
  contradicts: string[]
  lastValidated?: string
  sessionsSinceValidation: number
  sourceFile: string
  skill: string
}

const TYPE_MAP: Record<string, MemoryType> = {
  'bug-fix': 'BugFix',
  'pattern': 'Pattern',
  'anti-pattern': 'AntiPattern',
  'preference': 'Preference',
  'negative': 'AntiPattern',
}

export function parseLearningsFile(content: string, filePath: string): ParsedLearning[] {
  const learnings: ParsedLearning[] = []
  const skill = extractSkillName(filePath)

  // Split by learning headers
  const blocks = content.split(/^## Learning/m).filter((b) => b.trim())

  for (const block of blocks) {
    try {
      const learning = parseBlock(block, filePath, skill)
      if (learning) learnings.push(learning)
    } catch {
      // Skip unparseable blocks
    }
  }

  return learnings
}

function parseBlock(block: string, filePath: string, skill: string): ParsedLearning | null {
  const lines = block.split('\n')

  const getValue = (key: string): string => {
    const line = lines.find((l) => l.trim().startsWith(`${key}:`))
    if (!line) return ''
    return line.split(':').slice(1).join(':').trim().replace(/^["']|["']$/g, '')
  }

  const getArray = (key: string): string[] => {
    const val = getValue(key)
    if (!val || val === '[]') return []
    // Parse YAML-ish array: [a, b] or a, b
    return val.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  }

  const id = getValue('id')
  if (!id) return null

  const context = getValue('context')
  const problem = getValue('problem')
  const solution = getValue('solution')
  const reason = getValue('reason')

  if (!context && !problem && !solution) return null

  return {
    id,
    date: getValue('date') || new Date().toISOString().split('T')[0],
    type: getValue('type') || 'pattern',
    status: getValue('status') || 'active',
    project: getValue('project') || 'global',
    scope: getValue('scope') || 'global',
    tags: getArray('tags'),
    confidence: parseInt(getValue('confidence') || '1', 10),
    context: context || 'No context provided',
    problem: problem || 'No problem described',
    solution: solution || 'No solution described',
    reason: reason || 'No reason provided',
    validatedBy: getArray('validated_by'),
    createdIn: getValue('created_in') || '',
    supersedes: getValue('supersedes') || undefined,
    supersededBy: getValue('superseded_by') || undefined,
    reinforces: getArray('reinforces'),
    contradicts: getArray('contradicts'),
    lastValidated: getValue('last_validated') || undefined,
    sessionsSinceValidation: parseInt(getValue('sessions_since_validation') || '0', 10),
    sourceFile: filePath,
    skill,
  }
}

function extractSkillName(filePath: string): string {
  // .agents/skills/systematic-debugging/learnings.md → systematic-debugging
  // .opencode/skill/nextjs/learnings.md → nextjs
  const parts = filePath.split('/')
  const learningsIdx = parts.findIndex((p) => p === 'learnings.md')
  if (learningsIdx > 0) return parts[learningsIdx - 1]
  return 'unknown'
}

function findLearningsFiles(workspacePath: string): string[] {
  const files: string[] = []
  const searchDirs = [
    path.join(workspacePath, '.agents', 'skills'),
    path.join(workspacePath, '.opencode', 'skill'),
  ]

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue
    walkDir(dir, (f) => {
      if (f.endsWith('learnings.md')) files.push(f)
    })
  }

  return files
}

function walkDir(dir: string, callback: (file: string) => void): void {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkDir(full, callback)
    else callback(full)
  }
}

export function migrate(workspacePath: string): { migrated: number; skipped: number; edges: number } {
  const db = openDb(workspacePath)
  const store = new MemoryStore(db)

  const files = findLearningsFiles(workspacePath)
  let migrated = 0
  let skipped = 0
  let edgeCount = 0

  // Map old IDs to new IDs for edge creation
  const idMap = new Map<string, string>()

  // First pass: create all memories
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const learnings = parseLearningsFile(content, file)

    for (const learning of learnings) {
      // Check if already migrated
      const existing = store.query({ tags: learning.tags.slice(0, 2), limit: 100 })
      const alreadyMigrated = existing.find((m) => m.migratedFrom === learning.id)
      if (alreadyMigrated) {
        idMap.set(learning.id, alreadyMigrated.id)
        skipped++
        continue
      }

      const input: MemoryInput = {
        type: TYPE_MAP[learning.type] ?? 'Pattern',
        scope: learning.scope === 'project-specific' ? 'project-specific' : 'global',
        project: learning.project !== 'global' ? learning.project : undefined,
        skill: learning.skill,
        context: learning.context,
        problem: learning.problem,
        solution: learning.solution,
        reason: learning.reason,
        confidence: learning.confidence,
        importance: 5,
        tags: learning.tags,
        sourceFile: learning.sourceFile,
        sourceSession: learning.createdIn,
        migratedFrom: learning.id,
      }

      const memory = store.add(input)
      idMap.set(learning.id, memory.id)
      migrated++
    }
  }

  // Second pass: create edges from relationships
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const learnings = parseLearningsFile(content, file)

    for (const learning of learnings) {
      const sourceNewId = idMap.get(learning.id)
      if (!sourceNewId) continue

      // Supersedes → Updates edge
      if (learning.supersedes) {
        const targetNewId = idMap.get(learning.supersedes)
        if (targetNewId) {
          store.addEdge(sourceNewId, targetNewId, 'Updates', 'Migrated from supersedes relationship')
          edgeCount++
        }
      }

      // Reinforces → RelatedTo edge
      for (const reinforceId of learning.reinforces) {
        const targetNewId = idMap.get(reinforceId)
        if (targetNewId) {
          store.addEdge(sourceNewId, targetNewId, 'RelatedTo', 'Migrated from reinforces relationship')
          edgeCount++
        }
      }

      // Contradicts → Contradicts edge
      for (const contradictId of learning.contradicts) {
        const targetNewId = idMap.get(contradictId)
        if (targetNewId) {
          store.addEdge(sourceNewId, targetNewId, 'Contradicts', 'Migrated from contradicts relationship')
          edgeCount++
        }
      }
    }
  }

  db.close()
  return { migrated, skipped, edges: edgeCount }
}

// CLI entry point
if (process.argv[1]?.endsWith('migrate-learnings.js')) {
  const workspace = process.argv[2] || process.cwd()
  console.log(`Migrating learnings from: ${workspace}`)
  const result = migrate(workspace)
  console.log(`✅ Migration complete:`)
  console.log(`   Migrated: ${result.migrated}`)
  console.log(`   Skipped (already migrated): ${result.skipped}`)
  console.log(`   Edges created: ${result.edges}`)
}
