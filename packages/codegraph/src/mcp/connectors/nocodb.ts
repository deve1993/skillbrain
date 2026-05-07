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

export interface NocoDbRowResult {
  id: number | string
  tableId: string
  row: Record<string, unknown>
}

export async function insertNocoDbRow(
  params: {
    tableId?: string
    row: Record<string, unknown>
  },
  ctx: ConnectorCtx,
): Promise<NocoDbRowResult> {
  const apiUrl  = getConnectorEnv('NOCODB_API_URL', ctx).replace(/\/$/, '')
  const token   = getConnectorEnv('NOCODB_API_TOKEN', ctx)
  const tableId = params.tableId ?? getConnectorEnv('NOCODB_TABLE_ID', ctx)

  const res = await fetch(`${apiUrl}/api/v1/db/data/noco/${tableId}`, {
    method: 'POST',
    headers: {
      'xc-token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params.row),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`NocoDB: insert failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { Id?: number; id?: number | string }
  return {
    id: data.Id ?? data.id ?? 0,
    tableId,
    row: params.row,
  }
}
