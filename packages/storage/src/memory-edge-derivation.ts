// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Pixarts — contact daniel@pixarts.eu for commercial license

import type { Memory, MemoryEdgeType } from './memory-store.js'

export interface EdgeCandidate {
  targetId: string
  type: MemoryEdgeType
  reason: string
  score: number
}

const tagOverlap = (a: string[], b: string[]): number => {
  const setB = new Set(b)
  return a.filter((t) => setB.has(t)).length
}

const contextSimilar = (a: string, b: string): boolean => {
  if (!a || !b) return false
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return true
  if (na.length >= 30 && nb.includes(na.slice(0, 30))) return true
  if (nb.length >= 30 && na.includes(nb.slice(0, 30))) return true
  return false
}

const opposite = (a: Memory['type'], b: Memory['type']): boolean => {
  const pairs: Array<[Memory['type'], Memory['type']]> = [
    ['Pattern', 'AntiPattern'],
    ['Decision', 'AntiPattern'],
  ]
  return pairs.some(([x, y]) => (a === x && b === y) || (a === y && b === x))
}

export function deriveEdgeCandidates(subject: Memory, candidates: Memory[]): EdgeCandidate[] {
  const out: EdgeCandidate[] = []

  for (const c of candidates) {
    if (c.id === subject.id) continue

    const sameProject = !!subject.project && subject.project === c.project
    const overlap = tagOverlap(subject.tags, c.tags)
    const ctxSim = contextSimilar(subject.context, c.context)

    // CausedBy: BugFix → AntiPattern when share skill-tag and similar context
    if (subject.type === 'BugFix' && c.type === 'AntiPattern' && overlap >= 1 && ctxSim) {
      out.push({
        targetId: c.id,
        type: 'CausedBy',
        reason: 'BugFix linked to AntiPattern (shared skill + context)',
        score: 0.9,
      })
      continue
    }

    // Contradicts: opposite types with same/similar context
    if (opposite(subject.type, c.type) && ctxSim) {
      out.push({
        targetId: c.id,
        type: 'Contradicts',
        reason: 'opposite types share context',
        score: 0.85,
      })
      continue
    }

    // RelatedTo: same project + tag overlap >= 2
    if (sameProject && overlap >= 2) {
      out.push({
        targetId: c.id,
        type: 'RelatedTo',
        reason: `shared project + ${overlap} tags`,
        score: 0.5 + 0.1 * overlap,
      })
      continue
    }

    // RelatedTo: tag overlap >= 3 (cross-project)
    if (overlap >= 3) {
      out.push({
        targetId: c.id,
        type: 'RelatedTo',
        reason: `shared ${overlap} tags`,
        score: 0.4 + 0.05 * overlap,
      })
    }
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 3)
}
