import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { resolveSpacePermissions } from '@/lib/community-owner';
import { fetchPoidhBountyById } from '@/lib/poidh-api';
import { spaceBountiesTabUrl } from '@/lib/poidh-community-bounties';
import {
  isPoidhIssuerConfigured,
  poidhIssuerJoinBounty,
} from '@/lib/poidh-issuer';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RouteParams = { params: Promise<{ address: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const wallet = req.headers.get('x-wallet-address')?.trim().toLowerCase();

  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'x-wallet-address header required' }, { status: 401 });
  }

  let body: { bountyId?: number; ethAmount?: string | number; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ethAmount = String(body.ethAmount ?? '').trim();
  const eth = Number(ethAmount);
  if (!Number.isFinite(eth) || eth <= 0) {
    return NextResponse.json({ error: 'ethAmount required (e.g. 0.01)' }, { status: 400 });
  }

  try {
    const permissions = await resolveSpacePermissions(wallet, tokenAddress);
    if (!permissions.canPost) {
      return NextResponse.json(
        { error: 'Hold this token to seed bounties for this space.' },
        { status: 403 }
      );
    }

    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const merged = mergeCommunityDefaults(community);
    const titleQuery = String(body.title || '').trim().toLowerCase();
    let bountyId = Number(body.bountyId);

    if (!Number.isFinite(bountyId) || bountyId <= 0) {
      const match = merged.poidhBounties?.bounties.find((b) => {
        if (b.poidhBountyId == null) return false;
        if (!titleQuery) return true;
        return b.title.toLowerCase().includes(titleQuery);
      });
      bountyId = match?.poidhBountyId ?? 0;
    }

    if (!bountyId) {
      return NextResponse.json(
        { error: 'bountyId required, or title matching a live bounty' },
        { status: 400 }
      );
    }

    const known = merged.poidhBounties?.bounties.some((b) => b.poidhBountyId === bountyId);
    if (!known) {
      return NextResponse.json({ error: 'Bounty not found for this space' }, { status: 404 });
    }

    const onChain = await fetchPoidhBountyById(bountyId);
    if (!onChain?.active) {
      return NextResponse.json({ error: 'Bounty is not active on-chain' }, { status: 400 });
    }

    if (!isPoidhIssuerConfigured()) {
      return NextResponse.json(
        { error: 'POIDH issuer not configured — try again later' },
        { status: 503 }
      );
    }

    const { txHash } = await poidhIssuerJoinBounty({ bountyId, ethAmount });

    return NextResponse.json({
      success: true,
      txHash,
      bountyId,
      ethAmount,
      mode: 'issuer_seed',
      message: `Added ${ethAmount} ETH to bounty #${bountyId} from the platform issuer wallet. Refresh the Bounties tab to see the pool.`,
      bountiesUrl: spaceBountiesTabUrl(tokenAddress),
    });
  } catch (err) {
    console.error('POST poidh/seed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
