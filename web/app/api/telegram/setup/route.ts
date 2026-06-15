/**
 * GET /api/telegram/setup?secret=SITE_ADMIN_SECRET
 * Registers the bot webhook with Telegram. Call once after each deploy.
 */
import { NextResponse } from 'next/server';
import { setTelegramWebhook } from '@/lib/telegram-bot';
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
    const result = await setTelegramWebhook(getSiteUrl());
    return NextResponse.json({ ok: true, telegram: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
