import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { openCampaigns, completedCampaigns, cancelledCampaigns, campaignProgress, isCampaignFunded } from '@/lib/fundraising';
import { getTokenBeneficiaryWallet } from '@/lib/community-owner';
import { resolveSpaceX402FundUrl } from '@/lib/x402-fund-url';
import { normalizeAddr } from '@/lib/utils';
import {
  X402_PAYMENT_TOKEN_ADDRESS,
  X402_PAYMENT_TOKEN_SYMBOL,
  X402_PAYMENT_TOKEN_DECIMALS,
  SPACE_FUND_X402_CREDIT_USD,
} from '@/lib/x402-config';

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
    const cancelled = cancelledCampaigns(normalized.fundraising!);
    const mapCampaign = (c: (typeof campaigns)[number]) => ({
      ...c,
      progressPct: campaignProgress(c),
      remainingUsd: Math.max(0, Math.round((c.goalUsd - c.raisedUsd) * 100) / 100),
      funded: isCampaignFunded(c),
    });
    const beneficiaryWallet = await getTokenBeneficiaryWallet(tokenAddress);
    const x402Cfg = normalized.x402Config;
    const x402BaseUrl = resolveSpaceX402FundUrl(x402Cfg?.fundUrl, beneficiaryWallet);

    // Expose per-space token config for the widget
    const paymentToken = {
      address: x402Cfg?.tokenAddress || X402_PAYMENT_TOKEN_ADDRESS,
      symbol: x402Cfg?.tokenSymbol || X402_PAYMENT_TOKEN_SYMBOL,
      decimals: x402Cfg?.tokenDecimals ?? X402_PAYMENT_TOKEN_DECIMALS,
      isCustom: !!(x402Cfg?.tokenAddress),
      priceLabel: x402Cfg?.priceLabel || null,
      creditUsd: x402Cfg?.creditUsd || SPACE_FUND_X402_CREDIT_USD,
    };

    return NextResponse.json({
      tokenAddress,
      symbol: normalized.symbol,
      beneficiaryWallet,
      x402BaseUrl,
      paymentToken,
      campaigns: campaigns.map(mapCampaign),
      open: campaigns.map(mapCampaign),
      completed: completed.map(mapCampaign),
      cancelled: cancelled.map(mapCampaign),
    });
  } catch (err) {
    console.error('GET fundraising', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
