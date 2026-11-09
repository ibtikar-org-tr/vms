import { Environment } from '../types';
import { WorkerMailer } from 'worker-mailer';

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

const DEFAULT_AUTHDEEP_API_BASE = 'https://api.authdeep.com';
const DEFAULT_AUTHDEEP_TENANT_ID = '0bc3ef3f-d5ed-4281-8e1c-fd6e8519f77a';
const AUTHDEEP_NOTIFY_PATH = '/api/gateway/notifications/email';

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toHex(digest);
}

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toHex(signature);
}

async function authDeepHmacHeader(method: string, path: string, body: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyHash = await sha256Hex(body);
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = await hmacSha256Hex(secret, payload);
  return `t=${timestamp},v1=${signature}`;
}

export class EmailService {
  private config: EmailConfig;
  private env: Environment;

  constructor(env: Environment) {
    this.env = env;
    this.config = {
      host: env.SMTP_HOST,
      port: parseInt(String(env.SMTP_PORT || '587'), 10),
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    };
  }

  async sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
    try {
      if (this.env.AUTHDEEP_API_TOKEN?.trim()) {
        await this.sendViaAuthDeep(to, subject, text, html);
        return;
      }

      const mailer = await WorkerMailer.connect({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.port === 465,
        startTls: this.config.port !== 465,
        credentials: {
          username: this.config.user,
          password: this.config.pass,
        },
        authType: 'plain',
      });

      const emailOptions = {
        from: this.config.user,
        to,
        subject,
        text,
        html: html || text,
      };

      await mailer.send(emailOptions);
      await mailer.close();
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  private async sendViaAuthDeep(to: string, subject: string, text: string, html?: string): Promise<void> {
    const token = this.env.AUTHDEEP_API_TOKEN!.trim();
    const hmacSecret = this.env.AUTHDEEP_HMAC_SECRET?.trim() || '';
    const base = (this.env.AUTHDEEP_API_BASE || DEFAULT_AUTHDEEP_API_BASE).replace(/\/+$/, '');
    const tenantId = this.env.AUTHDEEP_TENANT_ID?.trim() || DEFAULT_AUTHDEEP_TENANT_ID;
    const body = JSON.stringify({
      to,
      subject,
      text_body: text,
      html_body: html || text,
    });
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-API-Key': token,
      'X-AuthDeep-Tenant-ID': tenantId,
    };

    if (token.startsWith('sak_')) {
      if (!hmacSecret) {
        throw new Error('AUTHDEEP_HMAC_SECRET is required for AuthDeep service API keys.');
      }
      headers['X-HMAC-Signature'] = await authDeepHmacHeader('POST', AUTHDEEP_NOTIFY_PATH, body, hmacSecret);
    }

    const response = await fetch(`${base}${AUTHDEEP_NOTIFY_PATH}`, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok && response.status !== 202) {
      let detail = `AuthDeep notification failed (${response.status}).`;
      try {
        const payload = (await response.json()) as { error?: string; message?: string };
        detail = payload.error || payload.message || detail;
      } catch {
        // Keep the status fallback when AuthDeep returns a non-JSON body.
      }
      throw new Error(detail);
    }
  }

  async sendVerificationEmail(email: string, verificationLink: string, verificationCode?: string): Promise<void> {
    const subject = 'Telegram Bot Verification - تجمّع إبتكار';

    const codeSection = verificationCode ? `
رمز التحقق الخاص بك: ${verificationCode}

يمكنك إدخال هذا الرمز في التليجرام، أو استخدام الرابط أدناه.
` : '';

    const text = `
مرحباً،

${codeSection}
يرجى النقر على الرابط أدناه للتحقق من حساب التليجرام الخاص بك:

${verificationLink}

سيؤدي هذا الرابط إلى تسجيل حساب التليجرام الخاص بك تلقائياً في نظامنا.

مع خالص التحية،
فريق تجمّع إبتكار
    `.trim();

    const codeHtml = verificationCode ? `
            <div style="text-align: center; background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p style="font-size: 14px; color: #666; margin-bottom: 10px;">رمز التحقق الخاص بك:</p>
                <p style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; margin: 0;">${verificationCode}</p>
            </div>
            <p style="text-align: center; color: #666; font-size: 14px;">يمكنك إدخال هذا الرمز في التليجرام</p>
            <p style="text-align: center; margin: 20px 0;"><strong>أو</strong></p>
` : '';

    const html = `
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px; }
        .content { padding: 20px 0; }
        .button { 
            display: inline-block; 
            background-color: #28a745; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0; 
            font-weight: bold;
        }
        .footer { font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>التحقق من حساب التليجرام</h2>
        </div>
        <div class="content">
            <p>مرحباً،</p>
            ${codeHtml}
            <p>يرجى النقر على الزر أدناه للتحقق من حساب التليجرام الخاص بك:</p>
            <p style="text-align: center;">
                <a href="${verificationLink}" class="button">تحقق من الحساب</a>
            </p>
            <p>سيؤدي هذا الرابط إلى تسجيل حساب التليجرام الخاص بك تلقائياً في نظامنا.</p>
            <p>إذا لم تطلب هذا التحقق، يرجى تجاهل هذا البريد الإلكتروني.</p>
        </div>
        <div class="footer">
            <p>مع خالص التحية،<br>فريق تجمّع إبتكار</p>
        </div>
    </div>
</body>
</html>
    `.trim();

    await this.sendEmail(email, subject, text, html);
  }
}
