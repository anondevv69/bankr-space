import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import {
  devProfileUrl,
  fetchVestingByToken,
  getProofOfDevSiteUrl,
  lockUrlFromRepo,
  type ProofOfDevGrant,
} from '@/lib/proofofdev-api';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

function summarizeGrants(token: string, grants: ProofOfDevGrant[]) {
  const active = grants.filter((g) => g.status === 'active');
  const devs = new Set(grants.map((g) => g.githubOwner));
  const site = getProofOfDevSiteUrl();

  return {
    token,
    count: grants.length,
    activeCount: active.length,
    uniqueDevs: devs.size,
    createLockUrl: `${site}/create?token=${token}`,
    exploreUrl: site,
    grants: grants.map((g) => ({
      ...g,
      lockUrl: lockUrlFromRepo(g.repoFullName, site),
      devUrl: devProfileUrl(g.githubOwner, site),
      githubUrl: `https://github.com/${g.repoFullName}`,
      progressPct:
        g.progress.progressPct ??
        (g.progress.totalPushesRequired > 0
          ? Math.floor((g.progress.verifiedPushCount / g.progress.totalPushesRequired) * 100)
          : 0),
    })),
  };
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const data = await fetchVestingByToken(tokenAddress);
    if (!data.ok) {
      return NextResponse.json({
        ok: true,
        symbol: community.symbol,
        ...summarizeGrants(tokenAddress, []),
        upstreamError: data.error ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      symbol: community.symbol,
      ...summarizeGrants(tokenAddress, data.grants ?? []),
      links: {
        proofofdev: getProofOfDevSiteUrl(),
        createLock: `${getProofOfDevSiteUrl()}/create?token=${tokenAddress}`,
      },
    });
  } catch (err) {
    console.error('GET vesting', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
