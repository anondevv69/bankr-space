import { NextResponse } from 'next/server';
import { fetchTokenMarketStatsBatch } from '@/lib/dexscreener';
import { getCommunities } from '@/lib/db';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const addressesParam = searchParams.get('addresses');

  try {
    if (addressesParam) {
      const addresses = addressesParam
        .split(',')
        .map((value) => normalizeAddr(value.trim()))
        .filter(Boolean);

      const communities = await getCommunities();
      const byAddress = new Map(
        communities.map((community) => [community.tokenAddress.toLowerCase(), community])
      );

      const items = addresses.map((tokenAddress) => ({
        tokenAddress,
        chain: byAddress.get(tokenAddress)?.chain || 'base',
      }));

      const markets = await fetchTokenMarketStatsBatch(items);
      return NextResponse.json({ markets });
    }

    const communities = await getCommunities();
    const markets = await fetchTokenMarketStatsBatch(
      communities.map((community) => ({
        tokenAddress: community.tokenAddress,
        chain: community.chain,
      }))
    );

    return NextResponse.json({ markets });
  } catch (err) {
    console.error('GET /api/market', err);
    return NextResponse.json({ error: 'Failed to load market data' }, { status: 500 });
  }
}
