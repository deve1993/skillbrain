/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { getConnectorEnv, type ConnectorCtx } from './index.js'

export interface OdooLead {
  name: string
  email?: string
  phone?: string
  description?: string
  partnerName?: string
  source?: string
  tags?: string[]
}

export interface OdooLeadResult {
  id: number
  name: string
  adminUrl: string
}

export async function createOdooLead(
  lead: OdooLead,
  ctx: ConnectorCtx,
): Promise<OdooLeadResult> {
  const apiKey  = getConnectorEnv('ODOO_API_KEY', ctx)
  const baseUrl = getConnectorEnv('ODOO_URL', ctx).replace(/\/$/, '')

  const body: Record<string, unknown> = {
    name: lead.name,
    description: lead.description ?? '',
    tag_ids: [],
  }
  if (lead.email)       body.email_from   = lead.email
  if (lead.phone)       body.phone        = lead.phone
  if (lead.partnerName) body.partner_name = lead.partnerName
  if (lead.source)      body.ref          = lead.source

  const res = await fetch(`${baseUrl}/api/crm.lead`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    return createOdooLeadJsonRpc(lead, apiKey, baseUrl)
  }

  const data = await res.json() as { id?: number; name?: string }
  const id = data.id ?? 0
  return {
    id,
    name: lead.name,
    adminUrl: `${baseUrl}/web#id=${id}&model=crm.lead&view_type=form`,
  }
}

async function createOdooLeadJsonRpc(
  lead: OdooLead,
  apiKey: string,
  baseUrl: string,
): Promise<OdooLeadResult> {
  const authRes = await fetch(`${baseUrl}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call', id: 1,
      params: {
        service: 'common', method: 'authenticate',
        args: [
          process.env['ODOO_DB'] ?? 'odoo',
          process.env['ODOO_USERNAME'] ?? 'admin',
          apiKey, {},
        ],
      },
    }),
  })
  const authData = await authRes.json() as { result?: number }
  const uid = authData.result
  if (!uid) throw new Error('Odoo: authentication failed')

  const vals: Record<string, unknown> = { name: lead.name }
  if (lead.email)       vals.email_from   = lead.email
  if (lead.phone)       vals.phone        = lead.phone
  if (lead.partnerName) vals.partner_name = lead.partnerName
  if (lead.description) vals.description  = lead.description

  const rpcRes = await fetch(`${baseUrl}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call', id: 2,
      params: {
        service: 'object', method: 'execute_kw',
        args: [
          process.env['ODOO_DB'] ?? 'odoo',
          uid, apiKey,
          'crm.lead', 'create', [vals],
        ],
      },
    }),
  })
  const rpcData = await rpcRes.json() as { result?: number }
  const id = rpcData.result ?? 0
  return {
    id,
    name: lead.name,
    adminUrl: `${baseUrl}/web#id=${id}&model=crm.lead&view_type=form`,
  }
}
