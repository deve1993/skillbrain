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

export interface DriveUploadResult {
  fileId: string
  name: string
  webViewLink: string
  mimeType: string
  size: number
}

export async function uploadToGoogleDrive(
  params: {
    filename: string
    content: Buffer | string
    mimeType?: string
    folderId?: string
    description?: string
  },
  ctx: ConnectorCtx,
): Promise<DriveUploadResult> {
  const token    = getConnectorEnv('GOOGLE_DRIVE_TOKEN', ctx)
  const mimeType = params.mimeType ?? 'application/octet-stream'
  const folderId = params.folderId
    ?? (() => { try { return getConnectorEnv('GOOGLE_DRIVE_FOLDER_ID', ctx) } catch { return undefined } })()

  const content = typeof params.content === 'string'
    ? Buffer.from(params.content, 'utf-8')
    : params.content

  const metadata: Record<string, unknown> = {
    name: params.filename,
    description: params.description ?? 'Uploaded by Synapse Studio',
  }
  if (folderId) metadata['parents'] = [folderId]

  const boundary = `studio_boundary_${Date.now()}`
  const metaPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + '\r\n',
    'utf-8',
  )
  const filePart = Buffer.from(
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    'utf-8',
  )
  const closing  = Buffer.from(`\r\n--${boundary}--`, 'utf-8')
  const body     = Buffer.concat([metaPart, filePart, content, closing])

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Drive: upload failed (${res.status}): ${text}`)
  }

  const data = await res.json() as {
    id: string; name: string; webViewLink: string; mimeType: string; size: string
  }

  return {
    fileId: data.id,
    name: data.name,
    webViewLink: data.webViewLink,
    mimeType: data.mimeType,
    size: parseInt(data.size ?? '0', 10),
  }
}
