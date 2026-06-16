/**
 * POST /api/telegram/link/prepare
 * Start Telegram link from bankr.space profile — wallet must be connected.
 * Returns a deep link to open the real bot (not a hardcoded username).
 */
import { NextResponse } from 'next/server';
import { getTelegramBotUsername } from '@/lib/telegram-bot';
import { setTelegramLinkCodeForWallet } from '@/lib/telegram-kv';
import { getSiteUrl } from '@/lib/site-url';
import { getWalletFromRequest } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: Request) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    return NextResponse.json({ error: 'Telegram bot is not configured on the server' }, { status: 503 });
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim() || getTelegramBotUsername();
  if (!botUsername) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_USERNAME is not set in Vercel' },
      { status: 503 }
    );
  }

  const code = randomCode();
  await setTelegramLinkCodeForWallet(code, wallet);

  const signUrl = `${getSiteUrl()}/link-telegram?code=${code}`;
  const deepLink = `https://t.me/${botUsername}?start=wl_${code}`;

  return NextResponse.json({
    code,
    botUsername,
    deepLink,
    signUrl,
    expiresInSec: 600,
  });
}
