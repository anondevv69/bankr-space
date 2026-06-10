import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { openCampaigns, campaignProgress, isCampaignFunded } from '@/lib/fundraising';
import { getTokenBeneficiaryWallet } from '@/lib/community-owner';
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
    const beneficiaryWallet = await getTokenBeneficiaryWallet(tokenAddress);
    const x402BaseUrl =
      process.env.NEXT_PUBLIC_X402_FUND_URL?.trim() ||
      process.env.NEXT_PUBLIC_X402_SPACE_FUND_URL?.trim() ||
      null;

    return NextResponse.json({
      tokenAddress,
      symbol: normalized.symbol,
      beneficiaryWallet,
      x402BaseUrl,
      campaigns: campaigns.map((c) => ({
        ...c,
        progressPct: campaignProgress(c),
        remainingUsd: Math.max(0, Math.round((c.goalUsd - c.raisedUsd) * 100) / 100),
        funded: isCampaignFunded(c),
      })),
    });
  } catch (err) {
    console.error('GET fundraising', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
