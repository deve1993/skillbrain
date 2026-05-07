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
import crypto from 'node:crypto'

const KLING_API = 'https://api.klingai.com'

function buildKlingJwt(accessKey: string, secretKey: string): string {
  // Kling richiede JWT HS256: { iss: accessKey, exp: now+1800, nbf: now-5 }
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 })).toString('base64url')
  const sig = crypto
    .createHmac('sha256', secretKey)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${sig}`
}

export interface KlingVideoTask {
  taskId: string
  status: 'submitted' | 'processing' | 'succeed' | 'failed'
  videoUrl?: string
}

export async function createKlingVideoTask(
  params: {
    prompt: string
    duration?: '5' | '10'
    aspectRatio?: '16:9' | '9:16' | '1:1'
    model?: string
  },
  ctx: ConnectorCtx,
): Promise<KlingVideoTask> {
  const accessKey = getConnectorEnv('KLING_ACCESS_KEY', ctx)
  const secretKey = getConnectorEnv('KLING_SECRET_KEY', ctx)
  const jwt = buildKlingJwt(accessKey, secretKey)

  const model = params.model ?? 'kling-v1'
  const res = await fetch(`${KLING_API}/v1/videos/text2video`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_name: model,
      prompt: params.prompt,
      duration: params.duration ?? '5',
      aspect_ratio: params.aspectRatio ?? '16:9',
      cfg_scale: 0.5,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Kling: create task failed (${res.status}): ${err}`)
  }
  const data = await res.json() as { data?: { task_id?: string; task_status?: string } }
  return {
    taskId: data.data?.task_id ?? '',
    status: (data.data?.task_status as KlingVideoTask['status']) ?? 'submitted',
  }
}

export async function pollKlingTask(
  taskId: string,
  ctx: ConnectorCtx,
): Promise<KlingVideoTask> {
  const accessKey = getConnectorEnv('KLING_ACCESS_KEY', ctx)
  const secretKey = getConnectorEnv('KLING_SECRET_KEY', ctx)
  const jwt = buildKlingJwt(accessKey, secretKey)

  const res = await fetch(`${KLING_API}/v1/videos/text2video/${taskId}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  })

  if (!res.ok) throw new Error(`Kling: poll failed (${res.status})`)
  const data = await res.json() as {
    data?: { task_status?: string; task_result?: { videos?: Array<{ url: string }> } }
  }

  const status = (data.data?.task_status ?? 'processing') as KlingVideoTask['status']
  const videoUrl = data.data?.task_result?.videos?.[0]?.url

  return { taskId, status, videoUrl }
}
