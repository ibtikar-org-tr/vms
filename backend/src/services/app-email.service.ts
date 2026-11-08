import { WorkerMailer } from 'worker-mailer'
import type { AppBindings } from '../types/bindings'

export interface AppEmailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

const DEFAULT_AUTHDEEP_API_BASE = 'https://api.authdeep.com'
const DEFAULT_AUTHDEEP_TENANT_ID = '0bc3ef3f-d5ed-4281-8e1c-fd6e8519f77a'

function authDeepToken(bindings: AppBindings) {
  return bindings.AUTHDEEP_API_TOKEN?.trim() || ''
}

function authDeepApiBase(bindings: AppBindings) {
  return (bindings.AUTHDEEP_API_BASE || DEFAULT_AUTHDEEP_API_BASE).replace(/\/+$/, '')
}

function authDeepTenantId(bindings: AppBindings) {
  return bindings.AUTHDEEP_TENANT_ID?.trim() || DEFAULT_AUTHDEEP_TENANT_ID
}

export function isAppEmailConfigured(bindings: AppBindings) {
  if (authDeepToken(bindings)) {
    return true
  }

  return Boolean(bindings.SMTP_HOST && bindings.SMTP_USER && bindings.SMTP_PASS)
}

function htmlFromText(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')
  return `<div dir="rtl" style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.8;">${escaped}</div>`
}

async function readErrorMessage(response: Response) {
  const fallback = `AuthDeep notification failed (${response.status}).`
  try {
    const payload = (await response.json()) as { error?: string; message?: string; code?: string }
    return payload.error || payload.message || fallback
  } catch {
    return fallback
  }
}

async function sendViaAuthDeep(bindings: AppBindings, message: AppEmailMessage): Promise<void> {
  const token = authDeepToken(bindings)
  const url = `${authDeepApiBase(bindings)}/api/gateway/notifications/email`
  const body = JSON.stringify({
    to: message.to,
    subject: message.subject,
    text_body: message.text,
    html_body: message.html?.trim() || htmlFromText(message.text),
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-AuthDeep-Tenant-ID': authDeepTenantId(bindings),
    },
    body,
  })

  if (response.ok || response.status === 202) {
    return
  }

  throw new Error(await readErrorMessage(response))
}

async function sendViaSmtp(bindings: AppBindings, message: AppEmailMessage): Promise<void> {
  if (!bindings.SMTP_HOST || !bindings.SMTP_USER || !bindings.SMTP_PASS) {
    throw new Error('Email configuration is incomplete.')
  }

  const smtpPort = Number.parseInt(String(bindings.SMTP_PORT ?? '587'), 10)
  if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
    throw new Error('SMTP_PORT must be a valid positive number.')
  }

  let mailer: Awaited<ReturnType<typeof WorkerMailer.connect>> | null = null
  try {
    mailer = await WorkerMailer.connect({
      host: bindings.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      startTls: smtpPort !== 465,
      credentials: {
        username: bindings.SMTP_USER,
        password: bindings.SMTP_PASS,
      },
      authType: 'plain',
    })
    await mailer.send({
      from: bindings.SMTP_USER,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
  } finally {
    if (mailer) {
      try {
        await mailer.close()
      } catch {
        // WorkerMailer can throw while tearing down a broken SMTP socket.
      }
    }
  }
}

export async function sendAppEmail(bindings: AppBindings, message: AppEmailMessage): Promise<void> {
  if (authDeepToken(bindings)) {
    await sendViaAuthDeep(bindings, message)
    return
  }

  await sendViaSmtp(bindings, message)
}
