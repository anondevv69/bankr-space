/**
 * GET  /api/farcaster/me?wallet=0x…  — returns Farcaster link for a wallet
 * DELETE /api/farcaster/me           — removes link (wallet from x-wallet-address header)
 */
import { NextResponse } from 'next/server';
import { getFarcasterLinkByWallet, removeFarcasterLinkByWallet } from '@/lib/farcaster-kv';
import { getProfiles, setProfiles } from '@/lib/db';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet')?.trim();
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  }
  const link = await getFarcasterLinkByWallet(normalizeAddr(wallet));
  if (!link) return NextResponse.json({ linked: false });
  return NextResponse.json({
    linked: true,
    fid: link.fid,
    username: link.username,
    displayName: link.displayName,
    pfpUrl: link.pfpUrl,
    linkedAt: link.linkedAt,
  });
}

export async function DELETE(req: Request) {
  const wallet = req.headers.get('x-wallet-address')?.trim();
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'x-wallet-address header required' }, { status: 400 });
  }
  const normalized = normalizeAddr(wallet);
  await removeFarcasterLinkByWallet(normalized);

  // Clear farcaster from profile cache
  const profiles = await getProfiles();
  if (profiles[normalized]) {
    profiles[normalized].farcaster = null;
    profiles[normalized].updatedAt = Date.now();
    await setProfiles(profiles);
  }

  return NextResponse.json({ ok: true });
}
