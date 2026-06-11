import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import {
  fundedAgentPoolCampaigns,
  openAgentPoolCampaigns,
  readStoredAgentPool,
} from '@/lib/agent-pool';
import { enrichAgentPoolCampaignStatus } from '@/lib/agent-pool-status';
import { verifyAgentPoolForCommunity } from '@/lib/agent-pool-verify';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

/** Funded + open agent pool goals with verification-linked 0xWork task ids. */
export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const merged = mergeCommunityDefaults(community);
    const verified = await verifyAgentPoolForCommunity(merged, { persist: true });
    const pool = readStoredAgentPool(verified.community.agentPool);
    const now = Date.now();

    const open = openAgentPoolCampaigns(pool).map((c) =>
      enrichAgentPoolCampaignStatus(c, now)
    );
    const funded = fundedAgentPoolCampaigns(pool).map((c) =>
      enrichAgentPoolCampaignStatus(c, now)
    );

    return NextResponse.json({
      tokenAddress,
      symbol: merged.symbol,
      open,
      funded,
      verify: {
        tasksLinked: verified.linked,
        statusesUpdated: verified.statusUpdates,
        fundedAtBackfilled: verified.fundedAtBackfilled,
      },
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('GET agent-pool/status', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
