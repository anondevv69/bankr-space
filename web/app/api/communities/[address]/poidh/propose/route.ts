import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { resolveSpacePermissions } from '@/lib/community-owner';
import { fetchPoidhBountyDetail } from '@/lib/poidh-contract';
import {
  isPoidhIssuerConfigured,
  poidhIssuerSubmitClaimForVote,
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

  let body: { bountyId?: number; claimId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bountyId = Number(body.bountyId);
  const claimId = Number(body.claimId);
  if (!Number.isFinite(bountyId) || bountyId <= 0) {
    return NextResponse.json({ error: 'bountyId required' }, { status: 400 });
  }
  if (!Number.isFinite(claimId) || claimId <= 0) {
    return NextResponse.json({ error: 'claimId required' }, { status: 400 });
  }

  try {
    const permissions = await resolveSpacePermissions(wallet, tokenAddress);
    if (!permissions.canPost) {
      return NextResponse.json(
        { error: 'Hold this token to interact with bounties.' },
        { status: 403 }
      );
    }

    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const merged = mergeCommunityDefaults(community);
    const known = merged.poidhBounties?.bounties.some((b) => b.poidhBountyId === bountyId);
    if (!known) {
      return NextResponse.json({ error: 'Bounty not found for this space' }, { status: 404 });
    }

    const detail = await fetchPoidhBountyDetail(bountyId);
    if (!detail) {
      return NextResponse.json({ error: 'On-chain bounty not found' }, { status: 404 });
    }
    if (!detail.active) {
      return NextResponse.json({ error: 'Bounty is already resolved' }, { status: 400 });
    }
    if (detail.voteActive || detail.votingClaimId > 0) {
      return NextResponse.json({ error: 'A vote is already in progress' }, { status: 400 });
    }

    const claim = detail.claims.find((c) => c.id === claimId);
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found on-chain' }, { status: 404 });
    }
    if (claim.issuer !== wallet) {
      return NextResponse.json({ error: 'Only the claim submitter can request a vote' }, { status: 403 });
    }

    if (!isPoidhIssuerConfigured()) {
      return NextResponse.json(
        { error: 'POIDH issuer not configured — try again later' },
        { status: 503 }
      );
    }

    const { txHash } = await poidhIssuerSubmitClaimForVote({ bountyId, claimId });

    return NextResponse.json({
      success: true,
      txHash,
      message: 'Your claim is now up for a 48h contributor vote. Refresh to see voting status.',
    });
  } catch (err) {
    console.error('POST poidh/propose', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
