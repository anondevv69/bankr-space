import { NextResponse } from 'next/server';
import { getCommunities } from '@/lib/db';
import { communityUrl } from '@/lib/site-url';
import { findMatchingCommunities, normalizeCommunityQuery } from '@/lib/resolve-community';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || searchParams.get('symbol') || '';

  try {
    const query = normalizeCommunityQuery(q);
    if (!query) {
      return NextResponse.json({ ok: true, query: '', communities: [], count: 0 });
    }

    const communities = await getCommunities();
    const matches = findMatchingCommunities(communities, query);

    return NextResponse.json({
      ok: true,
      query,
      count: matches.length,
      communities: matches.map((c) => ({
        symbol: c.symbol,
        name: c.name,
        tokenAddress: c.tokenAddress,
        verified: c.verified,
        postCount: c.postCount,
        memberCount: c.memberCount,
        communityLink: communityUrl(c.tokenAddress),
      })),
    });
  } catch (err) {
    console.error('GET /api/agent/search-communities', err);
    return NextResponse.json({ ok: false, error: 'Search failed' }, { status: 500 });
  }
}
