/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { randomUUID } from 'node:crypto'

export function randomId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12)
}
