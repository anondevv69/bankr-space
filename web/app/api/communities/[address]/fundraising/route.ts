import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { openCampaigns, completedCampaigns, campaignProgress, isCampaignFunded } from '@/lib/fundraising';
import { getTokenBeneficiaryWallet } from '@/lib/community-owner';
import { buildFundraisingX402BaseUrl } from '@/lib/x402-fund-url';
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

    const normalized = mergeCommunityDefaults(community);
    const campaigns = openCampaigns(normalized.fundraising!);
    const completed = completedCampaigns(normalized.fundraising!);
    const mapCampaign = (c: (typeof campaigns)[number]) => ({
      ...c,
      progressPct: campaignProgress(c),
      remainingUsd: Math.max(0, Math.round((c.goalUsd - c.raisedUsd) * 100) / 100),
      funded: isCampaignFunded(c),
    });
    const beneficiaryWallet = await getTokenBeneficiaryWallet(tokenAddress);
    const x402BaseUrl = buildFundraisingX402BaseUrl(beneficiaryWallet);

    return NextResponse.json({
      tokenAddress,
      symbol: normalized.symbol,
      beneficiaryWallet,
      x402BaseUrl,
      campaigns: campaigns.map(mapCampaign),
      open: campaigns.map(mapCampaign),
      completed: completed.map(mapCampaign),
    });
  } catch (err) {
    console.error('GET fundraising', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
