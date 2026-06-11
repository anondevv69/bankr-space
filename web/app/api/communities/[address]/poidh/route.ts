import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { getPlatformAgentWallet } from '@/lib/platform-agent';
import { fetchPoidhBountiesForSpace, poidhBountyUrl } from '@/lib/poidh-api';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const platformWallet = getPlatformAgentWallet();
    const issuerWallets = [platformWallet, community.ownerWallet].filter(Boolean) as string[];

    if (issuerWallets.length === 0) {
      return NextResponse.json({ bounties: [], total: 0, symbol: community.symbol });
    }

    const data = await fetchPoidhBountiesForSpace({
      issuerWallets,
      symbol: community.symbol,
      tokenAddress,
    });

    const bounties = data.bounties
      .filter((b) => b.active)
      .map((b) => ({
        id: b.id,
        frontendId: b.frontendId,
        name: b.name,
        description: b.description,
        issuer: b.issuer,
        amountWei: b.amountWei.toString(),
        createdAt: b.createdAt,
        url: poidhBountyUrl(b.id),
        openBounty: true,
      }));

    return NextResponse.json({
      bounties,
      total: bounties.length,
      symbol: community.symbol,
      issuerWallet: data.issuerWallet,
      usePlatformAgent: !!community.usePlatformAgent,
      links: {
        poidh: 'https://poidh.xyz/base',
        openBountyGuide: 'https://words.poidh.xyz/poidh-open-bounties-guide',
        skill: 'https://github.com/picsoritdidnthappen/poidh-app/blob/prod/SKILL.md',
        docs: 'https://docs.poidh.xyz/api.html',
      },
    });
  } catch (err) {
    console.error('GET poidh', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
