/*
 * SkillBrain — Self-hosted AI memory platform
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

const MINUTE = 60 * 1000

export const SESSION_STALE_THRESHOLD_MS = 15 * MINUTE
export const MEMORY_DECAY_INTERVAL_HOURS = 24
export const SKILL_DECAY_SESSIONS_THRESHOLD = 5
export const SKILL_DEPRECATION_SESSIONS_THRESHOLD = 20
