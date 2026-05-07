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

export interface CoolifyDeployResult {
  deploymentUuid: string
  message: string
  resourceUrl: string
}

export async function triggerCoolifyDeploy(
  params: { appUuid: string },
  ctx: ConnectorCtx,
): Promise<CoolifyDeployResult> {
  const token   = getConnectorEnv('COOLIFY_API_TOKEN', ctx)
  const baseUrl = getConnectorEnv('COOLIFY_BASE_URL', ctx)
    .replace(/\/$/, '')

  const res = await fetch(`${baseUrl}/api/v1/deployments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uuid: params.appUuid }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Coolify: deploy failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { deployment_uuid?: string; message?: string }
  return {
    deploymentUuid: data.deployment_uuid ?? 'unknown',
    message: data.message ?? 'Deployment triggered',
    resourceUrl: `${baseUrl}/project/default/applications/${params.appUuid}/deployments`,
  }
}
