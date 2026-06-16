/**
 * GET /api/telegram/info
 * Public bot username for profile links (from server env — no NEXT_PUBLIC_ duplicate needed).
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim();
  if (!token || !username) {
    return NextResponse.json({
      configured: false,
      botUsername: null,
      botUrl: null,
      error: 'Telegram bot is not configured on the server (TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_USERNAME).',
    });
  }

  // Prefer live username from Telegram (matches @BotFather)
  let botUsername = username;
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = (await meRes.json()) as { ok?: boolean; result?: { username?: string } };
    if (me.ok && me.result?.username) {
      botUsername = me.result.username;
    }
  } catch {
    // fall back to env
  }

  return NextResponse.json({
    configured: true,
    botUsername,
    botUrl: `https://t.me/${botUsername}`,
  });
}
