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

export interface UnsplashPhoto {
  id: string
  description: string | null
  urls: { small: string; regular: string; full: string }
  links: { download_location: string }
  user: { name: string; username: string }
}

export async function searchUnsplash(
  params: { query: string; perPage?: number; orientation?: 'landscape' | 'portrait' | 'squarish' },
  ctx: ConnectorCtx,
): Promise<UnsplashPhoto[]> {
  const accessKey = getConnectorEnv('UNSPLASH_ACCESS_KEY', ctx)
  const perPage = params.perPage ?? 12

  const qs = new URLSearchParams({
    query: params.query,
    per_page: String(perPage),
    orientation: params.orientation ?? 'landscape',
  })

  const res = await fetch(`https://api.unsplash.com/search/photos?${qs}`, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  })

  if (!res.ok) throw new Error(`Unsplash: search failed (${res.status})`)
  const data = await res.json() as { results: UnsplashPhoto[] }
  return data.results
}

// Traccia download (obbligatorio per Unsplash API guidelines)
export async function trackUnsplashDownload(
  downloadLocation: string,
  ctx: ConnectorCtx,
): Promise<void> {
  const accessKey = getConnectorEnv('UNSPLASH_ACCESS_KEY', ctx)
  await fetch(`${downloadLocation}?client_id=${accessKey}`).catch(() => {})
}
