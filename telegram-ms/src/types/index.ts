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
  TELEGRAM_MS: string;
  MEMBERSHIP_MS: string;
  DEEPSEEK_API_KEY: string;
  AI: any; // Cloudflare AI binding
  MAIN_CHANNEL: string; // Main Telegram channel username (without @)
}
