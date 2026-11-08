export { TelegramUpdate, InlineKeyboardButton, InlineKeyboardMarkup, SendMessageRequest, SendPhotoRequest, TelegramUserState } from './telegram';

export interface Environment {
  TELEGRAM_DB: D1Database;
  TELEGRAM_MESSAGES_DB: D1Database;
  MEMBERS_DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  INTERNAL_SECRET: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  AUTHDEEP_API_TOKEN?: string;
  AUTHDEEP_HMAC_SECRET?: string;
  AUTHDEEP_API_BASE?: string;
  AUTHDEEP_TENANT_ID?: string;
  AUTHDEEP_MAIL_FROM?: string;
  TELEGRAM_MS: string;
  MEMBERSHIP_MS: string;
  MEMBERSHIP_MS_SERVICE?: Fetcher;
  DEEPSEEK_API_KEY: string;
  AI: any; // Cloudflare AI binding
  MAIN_CHANNEL: string; // Main Telegram channel username (without @)
}
