'use client';

import type { Community } from '@/lib/types';
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
  const showCommunity = !!community.usePlatformAgent && community.verified && agentOpen;

  if (!showCommunity) {
    return null;
  }

  const poolRefresh = refreshKey ?? JSON.stringify(community.agentPool?.campaigns);

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <AgentPoolWidget
        tokenAddress={community.tokenAddress}
        symbol={community.symbol}
        refreshKey={poolRefresh}
        layout="sidebar"
      />
    </aside>
  );
}
