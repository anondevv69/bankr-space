import { getCommunities, setCommunities, getCommunity } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import {
  CAMPAIGN_IDS,
  creditCampaignUsd,
  readStoredFundraising,
  type CampaignId,
} from '@/lib/fundraising';
import { normalizeAddr } from '@/lib/utils';

export type ApplyCreditResult =
  | {
      success: true;
      tokenAddress: string;
      campaignId: CampaignId;
      creditedUsd: number;
      raisedUsd: number;
      goalUsd: number;
      funded: boolean;
    }
  | { success: false; error: string; status: number };

export async function applyFundraisingCredit(
  tokenAddress: string,
  campaignId: CampaignId,
  amountUsd: number
): Promise<ApplyCreditResult> {
  const normalized = normalizeAddr(tokenAddress);

  if (!CAMPAIGN_IDS.includes(campaignId)) {
    return { success: false, error: 'Invalid campaignId', status: 400 };
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { success: false, error: 'amountUsd must be positive', status: 400 };
  }

  const community = await getCommunity(normalized);
  if (!community) {
    return { success: false, error: 'Space not found', status: 404 };
  }

  const communities = await getCommunities();
  const index = communities.findIndex(
    (item) => item.tokenAddress.toLowerCase() === normalized
  );
  if (index === -1) {
    return { success: false, error: 'Space not found', status: 404 };
  }

  const stored = readStoredFundraising(communities[index].fundraising);
  const campaign = stored.campaigns.find((c) => c.id === campaignId);
  if (!campaign?.enabled) {
    return {
      success: false,
      error:
        'Campaign is not enabled for this space. Beneficiary must enable fundraising in Edit profile.',
      status: 400,
    };
  }

  const nextFundraising = creditCampaignUsd(stored, campaignId, amountUsd);
  const updated = mergeCommunityDefaults({
    ...mergeCommunityDefaults(communities[index]),
    fundraising: nextFundraising,
  });

  communities[index] = updated;
  await setCommunities(communities);

  const credited = updated.fundraising!.campaigns.find((c) => c.id === campaignId)!;

  return {
    success: true,
    tokenAddress: normalized,
    campaignId,
    creditedUsd: amountUsd,
    raisedUsd: credited.raisedUsd,
    goalUsd: credited.goalUsd,
    funded: credited.raisedUsd >= credited.goalUsd,
  };
}
