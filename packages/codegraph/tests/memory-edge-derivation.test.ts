// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Pixarts — contact daniel@pixarts.eu for commercial license

import { describe, it, expect } from 'vitest'
import { deriveEdgeCandidates } from '../src/storage/memory-edge-derivation.js'
import type { Memory } from '../src/storage/memory-store.js'

const mem = (over: Partial<Memory>): Memory => ({
  id: over.id || 'm-x',
  type: 'Pattern',
  status: 'active',
  scope: 'team',
  project: over.project,
  skill: over.skill,
  context: over.context || '',
  problem: '',
  solution: '',
  reason: '',
  confidence: 5,
  importance: 5,
  tags: over.tags || [],
  createdAt: '2026-05-03T00:00:00Z',
  updatedAt: '2026-05-03T00:00:00Z',
  sessionsSinceValidation: 0,
  validatedBy: [],
  ...over,
})

describe('deriveEdgeCandidates', () => {
  it('returns empty when no candidates match', () => {
    const subject = mem({ id: 'm-1', project: 'A', tags: ['x'] })
    const others: Memory[] = [mem({ id: 'm-2', project: 'B', tags: ['y'] })]
    expect(deriveEdgeCandidates(subject, others)).toEqual([])
  })

  it('emits RelatedTo when same project + tag overlap >= 2', () => {
    const subject = mem({ id: 'm-1', project: 'A', tags: ['nextjs', 'auth', 'oauth'] })
    const others: Memory[] = [
      mem({ id: 'm-2', project: 'A', tags: ['nextjs', 'auth', 'session'] }),
    ]
    const result = deriveEdgeCandidates(subject, others)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ targetId: 'm-2', type: 'RelatedTo' })
    expect(result[0].reason).toContain('shared project')
  })

  it('emits Contradicts when same context + opposite types (Pattern/AntiPattern)', () => {
    const subject = mem({ id: 'm-1', type: 'AntiPattern', context: 'In Next.js, when using server actions with redirect()' })
    const others: Memory[] = [
      mem({ id: 'm-2', type: 'Pattern', context: 'In Next.js, when using server actions with redirect()' }),
    ]
    const result = deriveEdgeCandidates(subject, others)
    expect(result.find((e) => e.type === 'Contradicts')).toBeDefined()
  })

  it('emits CausedBy when BugFix references AntiPattern with shared tag-skill', () => {
    const subject = mem({ id: 'm-1', type: 'BugFix', tags: ['nextjs', 'skill:nextjs'], context: 'In Next.js auth flow' })
    const others: Memory[] = [
      mem({ id: 'm-2', type: 'AntiPattern', tags: ['nextjs', 'skill:nextjs'], context: 'In Next.js auth flow' }),
    ]
    const result = deriveEdgeCandidates(subject, others)
    expect(result.find((e) => e.type === 'CausedBy' && e.targetId === 'm-2')).toBeDefined()
  })

  it('caps results at top 3 by score', () => {
    const subject = mem({ id: 'm-1', project: 'A', tags: ['a', 'b', 'c'] })
    const others: Memory[] = Array.from({ length: 10 }, (_, i) =>
      mem({ id: `m-${i + 2}`, project: 'A', tags: ['a', 'b', 'c'] })
    )
    expect(deriveEdgeCandidates(subject, others).length).toBeLessThanOrEqual(3)
  })

  it('never derives self-edge', () => {
    const subject = mem({ id: 'm-1', project: 'A', tags: ['a', 'b'] })
    const others: Memory[] = [mem({ id: 'm-1', project: 'A', tags: ['a', 'b'] })]
    expect(deriveEdgeCandidates(subject, others)).toEqual([])
  })
})
