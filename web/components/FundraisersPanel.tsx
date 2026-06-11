'use client';

import type { Community } from '@/lib/types';
import {
  completedCampaigns,
  fundraiserTypeLabel,
  hasCompletedFundraising,
  hasPublicFundraising,
} from '@/lib/fundraising';
import {
  fundedAgentPoolCampaigns,
  hasAgentPoolHistory,
  hasPublicAgentPool,
} from '@/lib/agent-pool';
import { FundraisingWidget } from '@/components/FundraisingWidget';
import { AgentPoolWidget } from '@/components/AgentPoolWidget';
import { CommunityProposeGoal } from '@/components/CommunityProposeGoal';

function HistoryCard({
  lane,
  title,
  raisedUsd,
  goalUsd,
  status,
  detail,
}: {
  lane: string;
  title: string;
  raisedUsd: number;
  goalUsd: number;
  status: 'completed' | 'funded' | 'executed';
  detail?: string | null;
}) {
  const statusLabel =
    status === 'executed'
      ? 'Executed by agent'
      : status === 'funded'
        ? 'Funded — awaiting agent'
        : 'Goal completed';

  const statusClass =
    status === 'executed'
      ? 'text-green-600 dark:text-green-400'
      : status === 'funded'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-green-600 dark:text-green-400';

  return (
    <div className="p-3 rounded-lg border border-border bg-surface-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{lane}</div>
      <div className="text-sm font-medium mt-1 leading-snug">{title}</div>
      <div className="text-xs text-muted mt-1 tabular-nums">
        Raised ${raisedUsd.toLocaleString()} of ${goalUsd.toLocaleString()} USDC
      </div>
      <div className={`text-[11px] mt-2 font-medium ${statusClass}`}>{statusLabel}</div>
      {detail?.trim() ? (
        <p className="text-[11px] text-muted mt-1.5 line-clamp-3 whitespace-pre-wrap">{detail}</p>
      ) : null}
    </div>
  );
}

export function FundraisersPanel({
  community,
  refreshKey,
  canProposeCommunityGoal,
  onRefresh,
}: {
  community: Community;
  refreshKey?: string;
  canProposeCommunityGoal?: boolean;
  onRefresh?: () => void;
}) {
  const beneficiaryCompleted = completedCampaigns(community.fundraising);
  const agentFunded = community.usePlatformAgent
    ? fundedAgentPoolCampaigns(community.agentPool)
    : [];
  const agentOpen = community.usePlatformAgent && hasPublicAgentPool(community.agentPool);
  const beneficiaryOpen = hasPublicFundraising(community.fundraising);
  const hasHistory =
    hasCompletedFundraising(community.fundraising) ||
    (community.usePlatformAgent && hasAgentPoolHistory(community.agentPool));
  const showCommunity = !!community.usePlatformAgent && community.verified;
  const showBeneficiary = beneficiaryOpen || hasCompletedFundraising(community.fundraising);

  if (!showCommunity && !showBeneficiary) {
    return null;
  }

  const poolRefresh = refreshKey ?? JSON.stringify(community.agentPool?.campaigns);
  const fundraisingRefresh = refreshKey ?? JSON.stringify(community.fundraising?.campaigns);

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <div className="p-4 rounded-xl border border-border bg-surface">
        <h2 className="text-sm font-semibold">Fundraisers</h2>
        <p className="text-[11px] text-muted mt-0.5 leading-snug">
          <strong className="font-medium text-text">Community agent</strong> — holders propose and
          fund platform goals.{' '}
          <strong className="font-medium text-text">Beneficiary</strong> — fee recipient programs
          on their terms.
        </p>
      </div>

      {showCommunity ? (
        <div className="space-y-3">
          <div className="px-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Community agent
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              Bankr Space Agent — spread the word, bagwork, QRCoin. USDC → platform agent wallet.
            </p>
          </div>
          {canProposeCommunityGoal ? (
            <CommunityProposeGoal
              tokenAddress={community.tokenAddress}
              symbol={community.symbol}
              onProposed={() => onRefresh?.()}
            />
          ) : null}
          {agentOpen ? (
            <AgentPoolWidget
              tokenAddress={community.tokenAddress}
              symbol={community.symbol}
              refreshKey={poolRefresh}
              layout="sidebar"
            />
          ) : null}
        </div>
      ) : null}

      {showBeneficiary ? (
        <div className="space-y-3">
          <div className="px-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Beneficiary programs
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              Fee recipient goals — Dex, promos, and token programs they control.
            </p>
          </div>
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

      {hasHistory ? (
        <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
          <div>
            <div className="text-sm font-semibold">Completed</div>
            <p className="text-[11px] text-muted mt-0.5">Past goals and amounts raised.</p>
          </div>
          <div className="space-y-2">
            {beneficiaryCompleted.map((campaign) => (
              <HistoryCard
                key={`beneficiary-${campaign.id}`}
                lane="Beneficiary"
                title={campaign.label}
                raisedUsd={campaign.raisedUsd}
                goalUsd={campaign.goalUsd}
                status="completed"
                detail={fundraiserTypeLabel(campaign.id)}
              />
            ))}
            {agentFunded.map((campaign) => (
              <HistoryCard
                key={`agent-${campaign.skillId}`}
                lane="Community agent"
                title={campaign.label}
                raisedUsd={campaign.raisedUsd}
                goalUsd={campaign.goalUsd}
                status={campaign.executedAt ? 'executed' : 'funded'}
                detail={
                  campaign.executedAt
                    ? campaign.executionNote || campaign.workBrief
                    : campaign.workBrief
                }
              />
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
