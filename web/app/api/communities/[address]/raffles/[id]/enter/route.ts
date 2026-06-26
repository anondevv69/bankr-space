import { NextResponse } from 'next/server';
import { enterCommunityRaffle, raffleX402CampaignId } from '@/lib/community-raffles';
import { getCommunity } from '@/lib/db';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string; id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { address, id: raffleId } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const raffle = await enterCommunityRaffle(
      tokenAddress,
      raffleId,
      wallet,
      community.chain || 'base'
    );

    return NextResponse.json({
      success: true,
      raffle: {
        id: raffle.id,
        status: raffle.status,
        entryCount: raffle.entries.length,
        totalTickets: raffle.totalTickets,
        endsAt: raffle.endsAt,
        x402CampaignId: raffleX402CampaignId(raffle.id),
      },
      tickets: raffle.entries.find((e) => e.wallet === wallet.toLowerCase())?.tickets ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enter raffle';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
