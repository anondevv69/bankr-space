import { NextResponse } from 'next/server';
import {
  createCommunityRaffle,
  getRaffles,
  isRaffleOpen,
  isRaffleFunded,
  processExpiredRaffles,
  raffleX402CampaignId,
} from '@/lib/community-raffles';
import { communityRaffleUrl } from '@/lib/site-url';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

function publicRaffleView(
  raffle: Awaited<ReturnType<typeof getRaffles>>[number],
  wallet: string | null
) {
  const entered = wallet
    ? raffle.entries.some((e) => e.wallet === wallet.toLowerCase())
    : false;
  return {
    id: raffle.id,
    tokenAddress: raffle.tokenAddress,
    title: raffle.title,
    prizeLabel: raffle.prizeLabel,
    productHint: raffle.productHint,
    country: raffle.country,
    prizeUsd: raffle.prizeUsd,
    goalUsd: raffle.goalUsd,
    raisedUsd: raffle.raisedUsd,
    entryRule: raffle.entryRule,
    minBalance: raffle.minBalance ?? null,
    durationHours: raffle.durationHours,
    startsAt: raffle.startsAt,
    endsAt: raffle.endsAt,
    status: raffle.status,
    entryCount: raffle.entries.length,
    totalTickets: raffle.totalTickets,
    funded: isRaffleFunded(raffle),
    open: isRaffleOpen(raffle),
    entered,
    winnerWallet: raffle.winnerWallet,
    drawnAt: raffle.drawnAt,
    drawSeedCommitment: raffle.drawSeedCommitment,
    createdAt: raffle.createdAt,
    fundedAt: raffle.fundedAt,
    x402CampaignId: raffleX402CampaignId(raffle.id),
    fulfillmentNote: raffle.fulfillmentNote,
    bankrAgentJobId: raffle.bankrAgentJobId,
    shareUrl: communityRaffleUrl(raffle.tokenAddress, raffle.id),
  };
}

export async function GET(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet')?.toLowerCase() || null;

  try {
    await processExpiredRaffles();
    const raffles = await getRaffles(tokenAddress);
    return NextResponse.json({
      raffles: raffles.map((r) => publicRaffleView(r, wallet)),
    });
  } catch (err) {
    console.error('GET raffles', err);
    return NextResponse.json({ error: 'Failed to load raffles' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const body = await req.json().catch(() => ({}));

  try {
    const raffle = await createCommunityRaffle({
      tokenAddress,
      wallet,
      title: String(body.title || ''),
      prizeLabel: String(body.prizeLabel || ''),
      productHint: String(body.productHint || body.prizeLabel || ''),
      country: body.country != null ? String(body.country) : 'US',
      prizeUsd: Number(body.prizeUsd),
      entryRule: body.entryRule === 'one_per_unit' ? 'one_per_unit' : 'one_per_wallet',
      minBalance: body.minBalance != null ? Number(body.minBalance) : null,
      durationHours: body.durationHours != null ? Number(body.durationHours) : undefined,
    });

    return NextResponse.json({
      success: true,
      raffle: publicRaffleView(raffle, wallet),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create raffle';
    const status = message.includes('fee recipient') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
