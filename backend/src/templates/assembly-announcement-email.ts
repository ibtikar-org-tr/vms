function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toHtmlParagraphs(value: string) {
  const escaped = escapeHtml(value.trim())
  if (!escaped) {
    return ''
  }

  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.9; color: #334155;">${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('')
}

export function buildAssemblyAnnouncementEmailText(input: {
  displayName: string
  subject: string
  body: string
  siteUrl: string
}) {
  return [
    `السلام عليكم ${input.displayName}،`,
    '',
    input.subject,
    '',
    input.body.trim(),
    '',
    '────────',
    'مجلس الإدارة',
    'تجمّع إبتكار',
    input.siteUrl,
    '',
    'وصلكم هذا البريد لأنكم أعضاء في تجمّع إبتكار.',
  ].join('\n')
}

export function buildAssemblyAnnouncementTelegramText(input: {
  subject: string
  body: string
  siteUrl: string
}) {
  return [
    '📢 رسالة من تجمّع إبتكار',
    '',
    input.subject.trim(),
    '',
    input.body.trim(),
    '',
    '────────',
    'مجلس الإدارة',
    'تجمّع إبتكار',
    input.siteUrl,
  ].join('\n')
}

export function buildAssemblyAnnouncementEmailHtml(input: {
  displayName: string
  subject: string
  body: string
  siteUrl: string
}) {
  const subject = escapeHtml(input.subject.trim())
  const name = escapeHtml(input.displayName)
  const siteUrl = escapeHtml(input.siteUrl)
  const bodyHtml = toHtmlParagraphs(input.body)

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
              <p style="margin: 12px 0 0; font-size: 13px; color: #e0f2fe;">رسالة من مجلس الإدارة إلى أعضاء التجمّع</p>
            </td>
          </tr>
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
                    <p style="margin: 0 0 4px; font-size: 14px; font-weight: 800; color: #0f766e;">مجلس الإدارة</p>
                    <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #334155;">تجمّع إبتكار</p>
                    <a href="${siteUrl}" style="color: #0369a1; font-size: 12px; font-weight: 700; text-decoration: none;">${siteUrl.replace(/^https?:\/\//, '')}</a>
                    <p style="margin: 14px 0 0; font-size: 11px; line-height: 1.7; color: #94a3b8;">وصلكم هذا البريد لأنكم أعضاء في تجمّع إبتكار.</p>
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

export function assemblySiteUrl(frontendBaseUrl: string | undefined) {
  return (frontendBaseUrl?.trim() || 'https://vms.ibtikar.tr').replace(/\/+$/, '')
}
