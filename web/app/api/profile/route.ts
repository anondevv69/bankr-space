/**
 * GET /api/profile?wallet=0x…
 *
 * Returns a summary of everything connected to a wallet on bankr.space:
 *   - Spaces where wallet is fee beneficiary (ownerWallet)
 *   - Spaces where wallet is founder/deployer (founderWallet)
 *   - Spaces where wallet is a trusted delegate
 *   - Author profile (X/Twitter, profile image)
 *   - Telegram link status
 *   - Wallet agent classification (bankrbot, human, etc.)
 */
import { NextResponse } from 'next/server';
import { getCommunities } from '@/lib/db';
import { resolveAuthorProfile } from '@/lib/profiles';
import { resolveAgentWallet } from '@/lib/bankr-agent-wallet';
import { trustedDelegateWallets } from '@/lib/space-delegates';
import { getTelegramLinkByWallet } from '@/lib/telegram-kv';
import { communityUrl } from '@/lib/site-url';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type SpaceSummary = {
  tokenAddress: string;
  name: string;
  symbol: string;
  verified: boolean;
  imageUrl: string | null;
  url: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('wallet')?.trim();
  if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  }

  const wallet = normalizeAddr(raw);

  const [communities, author, agentMeta, telegramLink] = await Promise.all([
    getCommunities(),
    resolveAuthorProfile(wallet),
    resolveAgentWallet(wallet),
    getTelegramLinkByWallet(wallet),
  ]);

  const toSummary = (c: (typeof communities)[number]): SpaceSummary => ({
    tokenAddress: c.tokenAddress,
    name: c.name,
    symbol: c.symbol,
    verified: c.verified,
    imageUrl: c.imageUrl || c.customIconUrl || c.dexIconSrc || null,
    url: communityUrl(c.tokenAddress),
  });

  const owned: SpaceSummary[] = [];
  const founded: SpaceSummary[] = [];
  const delegated: SpaceSummary[] = [];

  for (const c of communities) {
    const isOwner = c.ownerWallet?.toLowerCase() === wallet;
    const isFounder = c.founderWallet?.toLowerCase() === wallet;
    const isDelegate =
      !isOwner &&
      !isFounder &&
      trustedDelegateWallets(c.trustedDelegates ?? []).includes(wallet);

    if (isOwner) owned.push(toSummary(c));
    else if (isFounder) founded.push(toSummary(c));
    if (isDelegate) delegated.push(toSummary(c));
  }

  return NextResponse.json({
    wallet,
    author,
    agentMeta,
    telegram: telegramLink
      ? {
          linked: true,
          telegramId: telegramLink.telegramId,
          telegramUsername: telegramLink.telegramUsername,
          linkedAt: telegramLink.linkedAt,
        }
      : { linked: false },
    spaces: {
      owned,
      founded,
      delegated,
    },
  });
}
