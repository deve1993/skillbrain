// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Pixarts — contact daniel@pixarts.eu for commercial license

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { startDecayScheduler } from '@skillbrain/storage'

describe('startDecayScheduler', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('calls runner immediately on start', () => {
    const runner = vi.fn()
    startDecayScheduler({ runner, intervalMs: 60_000 })
    expect(runner).toHaveBeenCalledTimes(1)
  })

  it('calls runner once per interval', () => {
    const runner = vi.fn()
    const stop = startDecayScheduler({ runner, intervalMs: 60_000 })
    vi.advanceTimersByTime(60_000)
    expect(runner).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(60_000)
    expect(runner).toHaveBeenCalledTimes(3)
    stop()
  })

  it('returns a stop fn that halts future runs', () => {
    const runner = vi.fn()
    const stop = startDecayScheduler({ runner, intervalMs: 60_000 })
    stop()
    vi.advanceTimersByTime(120_000)
    expect(runner).toHaveBeenCalledTimes(1)
  })

  it('swallows runner errors', () => {
    const runner = vi.fn().mockImplementation(() => { throw new Error('boom') })
    expect(() => startDecayScheduler({ runner, intervalMs: 60_000 })).not.toThrow()
  })
})
