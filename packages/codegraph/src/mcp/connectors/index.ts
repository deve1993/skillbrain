/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { openDb, closeDb, UsersEnvStore } from '@skillbrain/storage'

export interface ConnectorCtx {
  skillbrainRoot: string
  userId: string | undefined
}

/**
 * Resolve a credential: process.env first, then user env store.
 * Throws a user-friendly error if missing.
 */
export function getConnectorEnv(
  varName: string,
  ctx: ConnectorCtx,
): string {
  const fromEnv = process.env[varName]
  if (fromEnv) return fromEnv

  if (ctx.userId) {
    const db = openDb(ctx.skillbrainRoot)
    try {
      const store = new UsersEnvStore(db)
      const val = store.getEnv(ctx.userId, varName)
      if (val) return val
    } finally {
      closeDb(db)
    }
  }

  throw new Error(
    `${varName} not configured. Set it in Settings → Environment Variables or in server .env`,
  )
}

export interface ConnectorStatus {
  name: string
  label: string
  configured: boolean
  missingVars: string[]
}

/** Check which connectors are available for the current user. */
export function getConnectorStatuses(ctx: ConnectorCtx): ConnectorStatus[] {
  const check = (vars: string[]): { configured: boolean; missingVars: string[] } => {
    const missing = vars.filter(v => {
      try { getConnectorEnv(v, ctx); return false } catch { return true }
    })
    return { configured: missing.length === 0, missingVars: missing }
  }

  return [
    { name: 'github',   label: 'GitHub PR',       ...check(['GITHUB_TOKEN']) },
    { name: 'coolify',  label: 'Coolify Deploy',  ...check(['COOLIFY_API_TOKEN', 'COOLIFY_BASE_URL']) },
    { name: 'unsplash', label: 'Unsplash Images', ...check(['UNSPLASH_ACCESS_KEY']) },
    { name: 'kling',    label: 'Kling Video',     ...check(['KLING_ACCESS_KEY', 'KLING_SECRET_KEY']) },
    { name: 'payload',  label: 'Payload CMS',     ...check(['PAYLOAD_API_URL', 'PAYLOAD_API_KEY']) },
    { name: 'resend',   label: 'Resend Email',    ...check(['RESEND_API_KEY']) },
    { name: 'n8n',      label: 'n8n Workflow',    ...check(['N8N_WEBHOOK_URL']) },
    { name: 'plausible',label: 'Plausible',       ...check(['PLAUSIBLE_SITE_ID']) },
    { name: 'odoo',   label: 'Odoo CRM',      ...check(['ODOO_API_KEY', 'ODOO_URL']) },
    { name: 'nocodb', label: 'NocoDB',         ...check(['NOCODB_API_URL', 'NOCODB_API_TOKEN', 'NOCODB_TABLE_ID']) },
    { name: 'smtp',   label: 'SMTP Email',     ...check(['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) },
    { name: 'gdrive', label: 'Google Drive',   ...check(['GOOGLE_DRIVE_TOKEN']) },
  ]
}
