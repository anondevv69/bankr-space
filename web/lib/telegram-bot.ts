/**
 * Telegram Bot API helpers — send messages and handle webhook payloads.
 */
import { getSiteUrl } from '@/lib/site-url';

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

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || !data.ok) {
    console.error('[telegram] sendMessage failed', { chatId, status: res.status, data });
    throw new Error(data.description || `Telegram sendMessage failed (${res.status})`);
  }
}

export async function getTelegramWebhookInfo(): Promise<unknown> {
  const token = getBotToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  return res.json();
}

export async function getTelegramBotMe(): Promise<unknown> {
  const token = getBotToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  return res.json();
}

export function getTelegramWebhookUrl(siteUrl?: string): string {
  let base = (siteUrl || getSiteUrl()).replace(/\/$/, '');
  // Apex 308-redirects to www — Telegram rejects redirect responses
  if (/^https:\/\/bankr\.space$/i.test(base)) {
    base = 'https://www.bankr.space';
  }
  return `${base}/api/telegram/webhook`;
}

/** Clear and re-register webhook URL with Telegram. */
export async function setTelegramWebhook(siteUrl?: string): Promise<{
  expectedUrl: string;
  deleteResult: unknown;
  setResult: unknown;
  infoResult: unknown;
  verified: boolean;
}> {
  const token = getBotToken();
  const webhookUrl = getTelegramWebhookUrl(siteUrl);
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  const deleteRes = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drop_pending_updates: true }),
  });
  const deleteResult = await deleteRes.json();

  const body: Record<string, unknown> = {
    url: webhookUrl,
    drop_pending_updates: true,
    allowed_updates: ['message'],
  };
  if (secret) body.secret_token = secret;

  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const setResult = await setRes.json();

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const infoResult = (await infoRes.json()) as {
    ok?: boolean;
    result?: { url?: string; last_error_message?: string; pending_update_count?: number };
  };

  const registeredUrl = infoResult.result?.url || '';
  const verified =
    registeredUrl.replace(/\/$/, '') === webhookUrl.replace(/\/$/, '');

  return {
    expectedUrl: webhookUrl,
    deleteResult,
    setResult,
    infoResult,
    verified,
  };
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
