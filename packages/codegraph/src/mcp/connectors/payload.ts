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

export interface PayloadPublishResult {
  id: string
  collection: string
  title: string
  adminUrl: string
  previewUrl: string | null
}

export async function publishToPayload(
  params: {
    title: string
    artifactHtml: string
    collection?: string
    slug?: string
    status?: 'draft' | 'published'
  },
  ctx: ConnectorCtx,
): Promise<PayloadPublishResult> {
  const apiUrl = getConnectorEnv('PAYLOAD_API_URL', ctx).replace(/\/$/, '')
  const apiKey = getConnectorEnv('PAYLOAD_API_KEY', ctx)
  const coll   = params.collection ?? 'pages'
  const slug   = params.slug
    ?? params.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)

  const res = await fetch(`${apiUrl}/api/${coll}`, {
    method: 'POST',
    headers: {
      Authorization: `users API-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: params.title,
      slug,
      content: params.artifactHtml,
      status: params.status ?? 'draft',
      _studio_export: true,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Payload: publish failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { doc?: { id?: string }; id?: string }
  const id = (data.doc?.id ?? data.id ?? 'unknown') as string

  return {
    id,
    collection: coll,
    title: params.title,
    adminUrl: `${apiUrl}/admin/collections/${coll}/${id}`,
    previewUrl: `${apiUrl}/${coll}/${slug}`,
  }
}
