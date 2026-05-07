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

export interface N8nTriggerResult {
  executionId?: string
  status: string
  webhookUrl: string
}

export async function triggerN8nWorkflow(
  params: {
    webhookPath: string
    payload: Record<string, unknown>
  },
  ctx: ConnectorCtx,
): Promise<N8nTriggerResult> {
  const webhookBase = getConnectorEnv('N8N_WEBHOOK_URL', ctx).replace(/\/$/, '')
  const webhookUrl  = `${webhookBase}/${params.webhookPath}`

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.payload),
  })

  const text = await res.text()
  let data: Record<string, unknown> = {}
  try { data = JSON.parse(text) } catch { /* empty or non-JSON response is fine */ }

  if (!res.ok) throw new Error(`n8n: webhook failed (${res.status}): ${text}`)

  return {
    executionId: (data.executionId ?? data.id) as string | undefined,
    status: 'triggered',
    webhookUrl,
  }
}
