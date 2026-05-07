/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type { Request, RequestHandler } from 'express'

export interface RouteContext {
  skillbrainRoot: string
  requireAdmin: RequestHandler
  hashPassword: (plain: string) => Promise<{ hash: string; salt: string }>
  generatePassword: (len?: number) => string
  sendInviteEmail: (to: string, name: string, password: string, apiKey: string) => Promise<void>
  anthropicApiKey: string
  isLocalhost: (req: Request) => boolean
}

export { createStudioRouter } from './studio.js'
