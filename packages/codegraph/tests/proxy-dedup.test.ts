import { describe, it, expect } from 'vitest'
import { findReusableSession } from '../src/mcp/proxy.js'

const WINDOW = 4 * 60 * 60 * 1000
const NOW = new Date('2026-04-16T12:00:00Z').getTime()

describe('findReusableSession', () => {
  it('reuses a fresh in-progress session', () => {
    const sessions = [
      { id: 'S-1', status: 'in-progress', started: new Date(NOW - 60 * 60 * 1000).toISOString() },
    ]
    expect(findReusableSession(sessions, NOW, WINDOW)?.id).toBe('S-1')
  })

  it('ignores completed sessions', () => {
    const sessions = [
      { id: 'S-1', status: 'completed', started: new Date(NOW - 60 * 1000).toISOString() },
    ]
    expect(findReusableSession(sessions, NOW, WINDOW)).toBeNull()
  })

  it('ignores stale in-progress sessions older than window', () => {
    const sessions = [
      { id: 'S-1', status: 'in-progress', started: new Date(NOW - 5 * 60 * 60 * 1000).toISOString() },
    ]
    expect(findReusableSession(sessions, NOW, WINDOW)).toBeNull()
  })

  it('returns first match from list', () => {
    const sessions = [
      { id: 'S-1', status: 'in-progress', started: new Date(NOW - 30 * 60 * 1000).toISOString() },
      { id: 'S-2', status: 'in-progress', started: new Date(NOW - 10 * 60 * 1000).toISOString() },
    ]
    expect(findReusableSession(sessions, NOW, WINDOW)?.id).toBe('S-1')
  })

  it('returns null on empty list', () => {
    expect(findReusableSession([], NOW, WINDOW)).toBeNull()
  })
})
