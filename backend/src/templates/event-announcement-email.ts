function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function linkifyEscaped(value: string) {
  return value.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const href = url.replace(/[).,;:!?]+$/g, '')
    const trailing = url.slice(href.length)
    return `<a href="${href}" style="color: #0f766e; font-weight: 700; word-break: break-all;">${href}</a>${trailing}`
  })
}

function toHtmlParagraphs(value: string) {
  const escaped = linkifyEscaped(escapeHtml(value.trim()))
  if (!escaped) {
    return ''
  }

  return escaped
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.9; color: #334155;">${paragraph.replace(/\n/g, '<br />')}</p>`,
    )
    .join('')
}

export function eventPageUrl(frontendBaseUrl: string | undefined, eventId: string) {
  const base = (frontendBaseUrl?.trim() || 'https://vms.ibtikar.tr').replace(/\/+$/, '')
  return `${base}/event/${encodeURIComponent(eventId)}`
}

export function buildEventAnnouncementEmailText(input: {
  displayName: string
  eventName: string
  subject: string
  body: string
  eventUrl: string
}) {
  return [
    `السلام عليكم ${input.displayName}،`,
    '',
    input.subject,
    '',
    input.body.trim(),
    '',
    '────────',
    input.eventName,
    'تجمّع إبتكار',
    input.eventUrl,
    '',
    'وصلكم هذا البريد لأنكم مسجّلون في هذه الفعالية.',
  ].join('\n')
}

export function buildEventAnnouncementTelegramText(input: {
  eventName: string
  subject: string
  body: string
  eventUrl: string
}) {
  return [
    `📢 رسالة للمسجّلين في ${input.eventName}`,
    '',
    input.subject.trim(),
    '',
    input.body.trim(),
    '',
    '────────',
    'تجمّع إبتكار',
    input.eventUrl,
  ].join('\n')
}

export function buildEventAnnouncementEmailHtml(input: {
  displayName: string
  eventName: string
  subject: string
  body: string
  eventUrl: string
  imageUrl?: string | null
}) {
  const subject = escapeHtml(input.subject.trim())
  const name = escapeHtml(input.displayName)
  const eventName = escapeHtml(input.eventName)
  const eventUrl = escapeHtml(input.eventUrl)
  const bodyHtml = toHtmlParagraphs(input.body)
  const imageUrl = input.imageUrl?.trim()
  const imageHtml = imageUrl
    ? `<tr><td style="padding: 0;"><img src="${escapeHtml(imageUrl)}" alt="" style="display: block; width: 100%; max-height: 360px; object-fit: cover;" /></td></tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ecfeff; font-family: Tahoma, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #ecfeff 0%, #f8fafc 45%, #fffbeb 100%); padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08); overflow: hidden;">
          <tr>
            <td style="padding: 28px 28px 22px; text-align: center; background: linear-gradient(135deg, #0f766e 0%, #0891b2 55%, #0369a1 100%);">
              <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #cffafe; letter-spacing: 0.08em;">تجمّع إبتكار</p>
              <h1 style="margin: 0; font-size: 24px; line-height: 1.45; font-weight: 800; color: #ffffff;">${subject}</h1>
              <p style="margin: 12px 0 0; font-size: 13px; color: #e0f2fe;">رسالة للمسجّلين في ${eventName}</p>
            </td>
          </tr>
          ${imageHtml}
          <tr>
            <td style="padding: 28px 28px 8px;">
              <p style="margin: 0 0 18px; font-size: 15px; line-height: 1.9; color: #0f172a;">السلام عليكم ${name}،</p>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 28px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding-top: 20px; text-align: center;">
                    <p style="margin: 0 0 4px; font-size: 14px; font-weight: 800; color: #0f766e;">${eventName}</p>
                    <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #334155;">تجمّع إبتكار</p>
                    <a href="${eventUrl}" style="color: #0369a1; font-size: 12px; font-weight: 700; text-decoration: none;">صفحة الفعالية</a>
                    <p style="margin: 14px 0 0; font-size: 11px; line-height: 1.7; color: #94a3b8;">وصلكم هذا البريد لأنكم مسجّلون في هذه الفعالية.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
