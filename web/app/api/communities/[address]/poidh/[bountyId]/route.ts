import { NextResponse } from 'next/server';
import { fetchPoidhBountyDetail } from '@/lib/poidh-contract';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string; bountyId: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const { address, bountyId: rawId } = await params;
  normalizeAddr(address);
  const bountyId = Number(rawId);
  if (!Number.isFinite(bountyId) || bountyId <= 0) {
    return NextResponse.json({ error: 'Invalid bounty id' }, { status: 400 });
  }

  const wallet = new URL(req.url).searchParams.get('wallet')?.trim().toLowerCase();

  try {
    const detail = await fetchPoidhBountyDetail(bountyId);
    if (!detail) {
      return NextResponse.json({ error: 'Bounty not found on-chain' }, { status: 404 });
    }

    let pendingWithdrawWei: string | null = null;
    if (wallet && /^0x[a-f0-9]{40}$/.test(wallet)) {
      const { readPendingWithdrawal } = await import('@/lib/poidh-contract');
      const pending = await readPendingWithdrawal(wallet as `0x${string}`);
      pendingWithdrawWei = pending > 0n ? pending.toString() : null;
    }

    return NextResponse.json({
      detail: {
        ...detail,
        amountWei: detail.amountWei.toString(),
        voteYes: detail.voteYes.toString(),
        voteNo: detail.voteNo.toString(),
        minContributionWei: detail.minContributionWei.toString(),
        participants: detail.participants.map((p) => ({
          ...p,
          amountWei: p.amountWei.toString(),
        })),
      },
      pendingWithdrawWei,
    });
  } catch (err) {
    console.error('GET poidh bounty detail', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
