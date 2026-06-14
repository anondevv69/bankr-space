'use client';

import type { Community } from '@/lib/types';
import { hasCompletedFundraising, hasPublicFundraising } from '@/lib/fundraising';
import { hasPublicAgentPool } from '@/lib/agent-pool';
import { FundraisingWidget } from '@/components/FundraisingWidget';
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
  const showCommunity = !!community.usePlatformAgent && community.verified && agentOpen;
  const showBeneficiary = beneficiaryOpen || hasCompletedFundraising(community.fundraising);

  if (!showCommunity && !showBeneficiary) {
    return null;
  }

  const poolRefresh = refreshKey ?? JSON.stringify(community.agentPool?.campaigns);
  const fundraisingRefresh = refreshKey ?? JSON.stringify(community.fundraising?.campaigns);

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
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-border bg-surface">
            <h2 className="text-sm font-semibold">Beneficiary programs</h2>
            <p className="text-[11px] text-muted mt-1 leading-snug">
              Optional goals set by the token&apos;s fee recipient — for example DexScreener boosts
              or promos they run on their own. $Space via x402 goes to them, not the community agent.
              {beneficiaryOpen ? ' Contribute below if a program is open.' : null}
            </p>
          </div>
          {beneficiaryOpen ? (
            <p className="text-[11px] text-muted px-1">
              Open and completed fundraisers also appear in the Fundraisers tab.
            </p>
          ) : hasCompletedFundraising(community.fundraising) ? (
            <p className="text-[11px] text-muted px-1">
              Completed fundraisers are in the Fundraisers tab.
            </p>
          ) : null}
          {beneficiaryOpen ? (
            <FundraisingWidget
              tokenAddress={community.tokenAddress}
              symbol={community.symbol}
              refreshKey={fundraisingRefresh}
              layout="sidebar"
            />
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
