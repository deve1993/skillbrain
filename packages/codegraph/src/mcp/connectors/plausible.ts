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

export interface PlausibleInjectResult {
  injected: boolean
  siteId: string
  scriptSrc: string
  html: string
}

export function injectPlausible(
  html: string,
  ctx: ConnectorCtx,
): PlausibleInjectResult {
  const siteId = getConnectorEnv('PLAUSIBLE_SITE_ID', ctx)

  let host = 'https://plausible.io'
  try { host = getConnectorEnv('PLAUSIBLE_HOST', ctx).replace(/\/$/, '') } catch { /* use default */ }

  const scriptSrc = `${host}/js/script.js`
  const scriptTag = `<script defer data-domain="${siteId}" src="${scriptSrc}"></script>`

  let injected = false
  let result = html

  if (html.includes('</head>')) {
    result = html.replace('</head>', `  ${scriptTag}\n</head>`)
    injected = true
  } else if (html.includes('<body')) {
    result = html.replace(/<body([^>]*)>/, `<body$1>\n  ${scriptTag}`)
    injected = true
  }

  return { injected, siteId, scriptSrc, html: result }
}
