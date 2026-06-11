import { NextResponse } from 'next/server';
import { getCommunity, getCommunities, setCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { migrateLegacyPoidhAgentPool } from '@/lib/agent-pool-legacy-poidh';
import {
  bountyPublicUrl,
  POIDH_BOUNTY_GUIDE_URL,
} from '@/lib/poidh-community-bounties';
import { fetchPoidhBountyById } from '@/lib/poidh-api';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const migrated = migrateLegacyPoidhAgentPool(community);
    if (migrated.changed) {
      const communities = await getCommunities();
      const idx = communities.findIndex(
        (c) => c.tokenAddress.toLowerCase() === tokenAddress
      );
      if (idx !== -1) {
        communities[idx] = migrated.community;
        await setCommunities(communities);
      }
    }
    const merged = mergeCommunityDefaults(migrated.community);
    const state = merged.poidhBounties;

    const bounties = await Promise.all(
      (state?.bounties ?? []).map(async (b) => {
        let amountWei: string | null = null;
        if (b.poidhBountyId != null) {
          const onChain = await fetchPoidhBountyById(b.poidhBountyId).catch(() => null);
          amountWei = onChain?.amountWei.toString() ?? null;
        }
        return {
          id: b.id,
          kind: b.kind,
          title: b.title,
          description: b.description,
          status: b.poidhBountyId != null ? 'live' : b.status,
          poidhBountyId: b.poidhBountyId,
          url: bountyPublicUrl(b),
          amountWei,
          requestedBy: b.requestedBy,
          createdAt: b.createdAt,
        };
      })
    );

    return NextResponse.json({
      bounties,
      total: bounties.length,
      symbol: merged.symbol,
      enabled: state?.enabled !== false,
      pendingSpinUp: Boolean(state?.spinUpAt || state?.bankrAgentJobId),
      links: {
        poidh: 'https://poidh.xyz/base',
        openBountyGuide: POIDH_BOUNTY_GUIDE_URL,
        skill: 'https://github.com/picsoritdidnthappen/poidh-app/blob/prod/SKILL.md',
      },
    });
  } catch (err) {
    console.error('GET poidh', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
