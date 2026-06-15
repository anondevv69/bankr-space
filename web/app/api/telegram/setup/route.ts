/**
 * GET /api/telegram/setup?secret=SITE_ADMIN_SECRET
 * Registers the bot webhook with Telegram. Call once after each deploy.
 */
import { NextResponse } from 'next/server';
import {
  getTelegramBotMe,
  getTelegramWebhookInfo,
  setTelegramWebhook,
} from '@/lib/telegram-bot';
import { getSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const adminSecret = process.env.SITE_ADMIN_SECRET?.trim();
  if (adminSecret) {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('secret') !== adminSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const siteUrl = getSiteUrl();
    const webhookUrl = `${siteUrl}/api/telegram/webhook`;
    const setResult = await setTelegramWebhook(siteUrl);
    const [bot, webhook] = await Promise.all([
      getTelegramBotMe(),
      getTelegramWebhookInfo(),
    ]);

    return NextResponse.json({
      ok: true,
      webhookUrl,
      webhookSecretConfigured: !!process.env.TELEGRAM_WEBHOOK_SECRET?.trim(),
      botTokenConfigured: !!process.env.TELEGRAM_BOT_TOKEN?.trim(),
      telegram: setResult,
      bot,
      webhook,
      hint:
        'If the bot is silent, re-run this after changing TELEGRAM_* env vars, then send /start again.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
