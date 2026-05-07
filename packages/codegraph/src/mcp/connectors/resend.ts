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

export interface ResendEmailResult {
  id: string
  to: string
  subject: string
}

export async function sendPreviewEmail(
  params: {
    to: string
    convTitle: string
    previewUrl?: string
    artifactHtml?: string
    senderName?: string
  },
  ctx: ConnectorCtx,
): Promise<ResendEmailResult> {
  const apiKey = getConnectorEnv('RESEND_API_KEY', ctx)

  let from = 'SkillBrain Studio <noreply@dvesolutions.eu>'
  try { from = getConnectorEnv('RESEND_FROM', ctx) } catch { /* use default */ }

  const subject = `[Studio Preview] ${params.convTitle}`

  const bodyHtml = buildPreviewEmail({
    convTitle: params.convTitle,
    previewUrl: params.previewUrl,
    senderName: params.senderName ?? 'SkillBrain Studio',
  })

  const payload: Record<string, unknown> = {
    from,
    to: [params.to],
    subject,
    html: bodyHtml,
  }

  if (params.artifactHtml && !params.previewUrl) {
    payload.attachments = [{
      filename: `${params.convTitle.replace(/[^a-z0-9]/gi, '-')}.html`,
      content: Buffer.from(params.artifactHtml).toString('base64'),
    }]
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend: send failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { id: string }
  return { id: data.id, to: params.to, subject }
}

function buildPreviewEmail(params: {
  convTitle: string
  previewUrl?: string
  senderName: string
}): string {
  const cta = params.previewUrl
    ? `<a href="${params.previewUrl}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">View Preview</a>`
    : '<p style="color:#888">No preview URL — artifact attached as HTML file.</p>'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Inter,sans-serif;background:#f5f5f5;padding:40px 0;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#08080d;padding:24px 32px">
      <h1 style="color:#a78bfa;font-size:18px;margin:0">SkillBrain Studio</h1>
    </div>
    <div style="padding:32px">
      <h2 style="font-size:20px;color:#111;margin:0 0 8px">${params.convTitle}</h2>
      <p style="color:#555;margin:0 0 24px">Your design preview is ready.</p>
      ${cta}
      <hr style="margin:32px 0;border:none;border-top:1px solid #eee">
      <p style="font-size:12px;color:#aaa;margin:0">Sent by ${params.senderName}</p>
    </div>
  </div>
</body>
</html>`
}
