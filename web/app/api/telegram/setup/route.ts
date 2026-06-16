/**
 * GET /api/telegram/setup?secret=SITE_ADMIN_SECRET
 * Registers the bot webhook with Telegram. Call once after each deploy.
 */
import { NextResponse } from 'next/server';
import { getTelegramBotMe, setTelegramWebhook } from '@/lib/telegram-bot';
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
    const registration = await setTelegramWebhook(siteUrl);
    const bot = await getTelegramBotMe();

    return NextResponse.json({
      ok: registration.verified,
      webhookUrl: registration.expectedUrl,
      webhookVerified: registration.verified,
      webhookSecretConfigured: !!process.env.TELEGRAM_WEBHOOK_SECRET?.trim(),
      botTokenConfigured: !!process.env.TELEGRAM_BOT_TOKEN?.trim(),
      telegram: registration.setResult,
      delete: registration.deleteResult,
      webhook: registration.infoResult,
      bot,
      hint: registration.verified
        ? 'Webhook registered on www. Send /start to @Bankrspace_bot to test.'
        : 'Webhook URL mismatch — set NEXT_PUBLIC_SITE_URL=https://www.bankr.space in Vercel, redeploy, run setup again.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
