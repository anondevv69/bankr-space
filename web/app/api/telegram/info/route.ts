/**
 * GET /api/telegram/info
 * Public bot username for profile links (from server env — no NEXT_PUBLIC_ duplicate needed).
 */
import { NextResponse } from 'next/server';
import { getTelegramBotUsername } from '@/lib/telegram-bot';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim() || getTelegramBotUsername();

  if (!token || !username) {
    return NextResponse.json({
      configured: false,
      botUsername: null,
      botUrl: null,
      error: 'Telegram bot is not configured on the server (TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_USERNAME).',
    });
  }

  return NextResponse.json({
    configured: true,
    botUsername: username,
    botUrl: `https://t.me/${username}`,
  });
}
