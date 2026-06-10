import { NextResponse } from 'next/server';
import { getCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { openCampaigns } from '@/lib/fundraising';
import { getPlatformAgentWallet } from '@/lib/platform-agent';
import { communityUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

/**
 * List spaces that opted in to the platform agent (for cron / worker).
 * Protected by CRON_SECRET when set.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const communities = await getCommunities();
    const platformWallet = getPlatformAgentWallet();

    const spaces = communities
      .filter((c) => c.usePlatformAgent && c.verified)
      .map((c) => {
        const normalized = mergeCommunityDefaults(c);
        const open = openCampaigns(normalized.fundraising);
        return {
          tokenAddress: normalized.tokenAddress,
          symbol: normalized.symbol,
          communityLink: communityUrl(normalized.tokenAddress),
          platformAgentSkills: !!normalized.platformAgentSkills,
          feeRecipientWallet: normalized.ownerWallet,
          openFundraisers: open.map((campaign) => ({
            id: campaign.id,
            label: campaign.label,
            raisedUsd: campaign.raisedUsd,
            goalUsd: campaign.goalUsd,
            remainingUsd: Math.max(
              0,
              Math.round((campaign.goalUsd - campaign.raisedUsd) * 100) / 100
            ),
          })),
        };
      });

    return NextResponse.json({
      platformAgentWallet: platformWallet,
      count: spaces.length,
      spaces,
    });
  } catch (err) {
    console.error('GET /api/agent/platform-spaces', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
