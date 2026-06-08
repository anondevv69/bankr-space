import { NextResponse } from 'next/server';
import { fetchTokenMarketStats } from '@/lib/dexscreener';
import { getCommunity } from '@/lib/db';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const { searchParams } = new URL(req.url);
  const chainParam = searchParams.get('chain');

  try {
    let chain = chainParam || 'base';
    if (!chainParam) {
      const community = await getCommunity(tokenAddress);
      if (community?.chain) chain = community.chain;
    }

    const market = await fetchTokenMarketStats(tokenAddress, chain);
    return NextResponse.json({ market });
  } catch (err) {
    console.error('GET /api/market/[address]', err);
    return NextResponse.json({ error: 'Failed to load market data' }, { status: 500 });
  }
}
