/**
 * GET  /api/telegram/me?wallet=0x…  — returns Telegram link for a wallet
 * DELETE /api/telegram/me           — removes link (wallet from x-wallet header)
 */
import { NextResponse } from 'next/server';
import { getTelegramLinkByWallet, removeTelegramLinkByWallet } from '@/lib/telegram-kv';

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

export async function DELETE(req: Request) {
  const wallet = req.headers.get('x-wallet')?.trim().toLowerCase();
  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'x-wallet header required' }, { status: 400 });
  }

  await removeTelegramLinkByWallet(wallet);
  return NextResponse.json({ ok: true });
}
