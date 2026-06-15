/**
 * GET /api/telegram/me?wallet=0x…
 * Returns the Telegram link for a wallet, if any.
 */
import { NextResponse } from 'next/server';
import { getTelegramLinkByWallet } from '@/lib/telegram-kv';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet')?.trim().toLowerCase();
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  }

  const link = await getTelegramLinkByWallet(wallet);
  if (!link) {
    return NextResponse.json({ linked: false });
  }

  return NextResponse.json({
    linked: true,
    telegramId: link.telegramId,
    telegramUsername: link.telegramUsername,
    linkedAt: link.linkedAt,
  });
}
