/**
 * Telegram Bot API helpers — send messages and handle webhook payloads.
 */

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number; type: string };
  text?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return token;
}

export function getTelegramBotUsername(): string {
  return process.env.TELEGRAM_BOT_USERNAME?.trim() || 'bankrspacebot';
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyToMessageId?: number;
    disableWebPagePreview?: boolean;
  } = {}
): Promise<void> {
  const token = getBotToken();
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: options.disableWebPagePreview ?? true,
  };
  if (options.parseMode) body.parse_mode = options.parseMode;
  if (options.replyToMessageId) body.reply_to_message_id = options.replyToMessageId;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Register the webhook URL with Telegram (call once after deploy). */
export async function setTelegramWebhook(siteUrl: string): Promise<unknown> {
  const token = getBotToken();
  const webhookUrl = `${siteUrl.replace(/\/$/, '')}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const body: Record<string, unknown> = { url: webhookUrl };
  if (secret) body.secret_token = secret;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function validateTelegramWebhookSecret(req: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret) return true; // not configured — allow (register secret via setWebhook)
  return req.headers.get('X-Telegram-Bot-Api-Secret-Token') === secret;
}

export function parseTelegramCommand(text: string): {
  command: string;
  args: string;
} | null {
  const match = text.trim().match(/^\/([a-zA-Z0-9_]+)(?:@\S+)?(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  return { command: match[1].toLowerCase(), args: (match[2] || '').trim() };
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}
