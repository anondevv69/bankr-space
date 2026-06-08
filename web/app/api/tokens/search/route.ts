import { NextResponse } from 'next/server';
import {
  fetchLaunchByAddress,
  searchBankrTokens,
} from '@/lib/bankr-api';
import { getLaunches, setLaunches } from '@/lib/db';
import { enrichLaunchWithImageUrl } from '@/lib/community-image';
import type { TokenLaunch } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = String(searchParams.get('q') || '').trim();
  if (!query) {
    return NextResponse.json({ launches: [], query: '' });
  }

  const q = query.toLowerCase();
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(query);
  const results: TokenLaunch[] = [];
  const seen = new Set<string>();

  function addLaunch(launch: TokenLaunch | null) {
    if (!launch?.tokenAddress) return;
    const key = launch.tokenAddress.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push(launch);
  }

  try {
    if (isAddress) {
      addLaunch(await fetchLaunchByAddress(query));
    }

    const tokens = await searchBankrTokens(query);
    for (const token of tokens.slice(0, 12)) {
      if (!token?.address || seen.has(token.address.toLowerCase())) continue;
      addLaunch(await fetchLaunchByAddress(token.address));
    }

    const cached = await getLaunches();
    for (const launch of cached) {
      if (
        launch.tokenName?.toLowerCase().includes(q) ||
        launch.tokenSymbol?.toLowerCase().includes(q) ||
        launch.tokenAddress?.toLowerCase().includes(q)
      ) {
        addLaunch(launch);
      }
    }

    if (results.length) {
      const merged = [...cached];
      const mergedIds = new Set(merged.map((l) => l.activityId));
      for (const launch of results) {
        if (!mergedIds.has(launch.activityId)) {
          merged.unshift(launch);
          mergedIds.add(launch.activityId);
        }
      }
      await setLaunches(
        merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      );
    }

    return NextResponse.json({
      ok: true,
      query,
      launches: results
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .map(enrichLaunchWithImageUrl),
      count: results.length,
    });
  } catch (err) {
    console.error('GET /api/tokens/search', err);
    return NextResponse.json({ launches: [], query, error: 'Search failed' });
  }
}
