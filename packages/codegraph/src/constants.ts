/**
 * Central constants for timing, thresholds, and configuration
 *
 * All timing constants are defined here to avoid magic numbers
 * scattered throughout the codebase.
 */

// ── Time unit helpers ──
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

// ── Session & Heartbeat ──
export const HEARTBEAT_INTERVAL_MS = 5 * MINUTE
export const SESSION_STALE_THRESHOLD_MS = 15 * MINUTE
export const SESSION_REUSE_WINDOW_MS = 4 * HOUR

// ── Memory Decay ──
export const MEMORY_DECAY_INTERVAL_HOURS = 24
export const MEMORY_STALE_VALIDATION_DAYS = 90

// ── Dashboard & Server ──
export const DEFAULT_DASHBOARD_PORT = 3333
