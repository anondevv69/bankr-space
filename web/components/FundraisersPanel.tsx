'use client';

import type { Community } from '@/lib/types';
import {
  cancelledCampaigns,
  hasCompletedFundraising,
  hasPublicFundraising,
} from '@/lib/fundraising';
import { hasPublicAgentPool } from '@/lib/agent-pool';
import { AgentPoolWidget } from '@/components/AgentPoolWidget';

export function FundraisersPanel({
  community,
  refreshKey,
}: {
  community: Community;
  refreshKey?: string;
  /** @deprecated sidebar propose form hidden — use Bounties / Jobs tabs */
  canProposeCommunityGoal?: boolean;
  /** @deprecated */
  onRefresh?: () => void;
}) {
  const agentOpen = community.usePlatformAgent && hasPublicAgentPool(community.agentPool);
  const beneficiaryOpen = hasPublicFundraising(community.fundraising);
  const beneficiaryHistory =
    beneficiaryOpen ||
    hasCompletedFundraising(community.fundraising) ||
    cancelledCampaigns(community.fundraising).length > 0;
  const showCommunity = !!community.usePlatformAgent && community.verified && agentOpen;
  const showBeneficiary = beneficiaryHistory;

  if (!showCommunity && !showBeneficiary) {
    return null;
  }

  const poolRefresh = refreshKey ?? JSON.stringify(community.agentPool?.campaigns);

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      {showCommunity ? (
        <AgentPoolWidget
          tokenAddress={community.tokenAddress}
          symbol={community.symbol}
          refreshKey={poolRefresh}
          layout="sidebar"
        />
      ) : null}

      {showBeneficiary ? (
        <div className="p-4 rounded-xl border border-border bg-surface">
          <h2 className="text-sm font-semibold">Beneficiary fundraisers</h2>
          <p className="text-[11px] text-muted mt-1 leading-snug">
            Optional goals set by the token&apos;s fee recipient — for example DexScreener boosts
            or promos they run on their own. $Space via x402 goes to them, not the community agent.
          </p>
          <p className="text-[11px] text-muted mt-2 leading-snug">
            {beneficiaryOpen
              ? 'Open the Fundraisers tab to view progress and contribute.'
              : 'Open, completed, and cancelled fundraisers are in the Fundraisers tab.'}
          </p>
        </div>
      ) : null}
    </aside>
  );
}
