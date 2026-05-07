/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import nodemailer from 'nodemailer'
import { getConnectorEnv, type ConnectorCtx } from './index.js'

export interface SmtpEmailResult {
  messageId: string
  to: string
  subject: string
}

export async function sendSmtpEmail(
  params: {
    to: string
    subject: string
    html: string
    text?: string
    attachments?: Array<{ filename: string; content: string | Buffer }>
  },
  ctx: ConnectorCtx,
): Promise<SmtpEmailResult> {
  const host = getConnectorEnv('SMTP_HOST', ctx)
  const user = getConnectorEnv('SMTP_USER', ctx)
  const pass = getConnectorEnv('SMTP_PASS', ctx)
  const port = parseInt(
    (() => { try { return getConnectorEnv('SMTP_PORT', ctx) } catch { return '587' } })(),
    10,
  )
  const secure = (() => {
    try { return getConnectorEnv('SMTP_SECURE', ctx) === 'true' } catch { return false }
  })()
  const from = (() => {
    try { return getConnectorEnv('SMTP_FROM', ctx) }
    catch { return `Synapse Studio <${user}>` }
  })()

  const transport = nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
  })

  const info = await transport.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    attachments: params.attachments,
  })

  return {
    messageId: info.messageId,
    to: params.to,
    subject: params.subject,
  }
}
