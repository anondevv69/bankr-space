import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { resolveSpacePermissions } from '@/lib/community-owner';
import { fetchPoidhBountyById, poidhDisplayBountyId } from '@/lib/poidh-api';
import {
  resolveSpacePoidhBounty,
  spaceBountiesTabUrl,
} from '@/lib/poidh-community-bounties';
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
    const match = resolveSpacePoidhBounty(merged.poidhBounties, {
      bountyId: body.bountyId,
      title: body.title,
    });

    if (!match?.poidhBountyId) {
      return NextResponse.json(
        {
          error:
            'Bounty not found — use on-chain poidhBountyId (e.g. 243) or poidh.xyz display id (e.g. 1229), or title',
        },
        { status: 404 }
      );
    }

    const onChainId = match.poidhBountyId;
    const onChain = await fetchPoidhBountyById(onChainId);
    if (!onChain) {
      return NextResponse.json(
        {
          error:
            'Could not read bounty on-chain (RPC busy) — retry in a few seconds. This is not the same as inactive.',
          poidhBountyId: onChainId,
          poidhDisplayId: poidhDisplayBountyId(onChainId),
          title: match.title,
        },
        { status: 503 }
      );
    }
    if (!onChain.active) {
      return NextResponse.json(
        {
          error: 'Bounty is closed on-chain (already paid out)',
          poidhBountyId: onChainId,
          poidhDisplayId: poidhDisplayBountyId(onChainId),
          title: match.title,
        },
        { status: 400 }
      );
    }

    if (!isPoidhIssuerConfigured()) {
      return NextResponse.json(
        { error: 'POIDH issuer not configured — try again later' },
        { status: 503 }
      );
    }

    const { txHash } = await poidhIssuerJoinBounty({ bountyId: onChainId, ethAmount });

    return NextResponse.json({
      success: true,
      txHash,
      bountyId: onChainId,
      poidhDisplayId: poidhDisplayBountyId(onChainId),
      title: match.title,
      ethAmount,
      mode: 'issuer_seed',
      message: `Added ${ethAmount} ETH to "${match.title}" (on-chain #${onChainId}). Refresh the Bounties tab.`,
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
