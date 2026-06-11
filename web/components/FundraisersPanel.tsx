'use client';

import { useCallback, useEffect, useState } from 'react';
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
import type { AgentPoolCampaignStatusView } from '@/lib/agent-pool-status';
import { agentPoolStatusClass } from '@/lib/agent-pool-status';
import { FundraisingWidget } from '@/components/FundraisingWidget';
import { AgentPoolWidget } from '@/components/AgentPoolWidget';
import { CommunityProposeGoal } from '@/components/CommunityProposeGoal';

function formatWaiting(ms: number | null): string | null {
  if (ms == null || ms < 60_000) return null;
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m waiting`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m waiting` : `${hours}h waiting`;
}

function AgentPoolHistoryCard({ campaign }: { campaign: AgentPoolCampaignStatusView }) {
  const waiting = formatWaiting(campaign.waitingMs);

  return (
    <div className="p-3 rounded-lg border border-border bg-surface-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        Community task
      </div>
      <div className="text-sm font-medium mt-1 leading-snug">{campaign.label}</div>
      <div className="text-xs text-muted mt-1 tabular-nums">
        Raised ${campaign.raisedUsd.toLocaleString()} of ${campaign.goalUsd.toLocaleString()} USDC
      </div>
      <div className={`text-[11px] mt-2 font-medium ${agentPoolStatusClass(campaign.phase)}`}>
        {campaign.statusLabel}
        {waiting && campaign.phase !== 'executed' ? (
          <span className="text-muted font-normal"> · {waiting}</span>
        ) : null}
      </div>
      {campaign.workBrief?.trim() ? (
        <p className="text-[11px] text-muted mt-1.5 line-clamp-3 whitespace-pre-wrap">
          {campaign.workBrief}
        </p>
      ) : null}
      {campaign.poidhUrl ? (
        <a
          href={campaign.poidhUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-[11px] text-accent-hover hover:underline mt-2 font-medium"
        >
          POIDH bounty #{campaign.poidhBountyId} ↗
        </a>
      ) : null}
      {campaign.oxworkUrl ? (
        <a
          href={campaign.oxworkUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-[11px] text-accent-hover hover:underline mt-2 font-medium"
        >
          0xWork task #{campaign.oxworkTaskId}
          {campaign.oxworkTaskStatus ? ` (${campaign.oxworkTaskStatus})` : ''} ↗
        </a>
      ) : null}
      {campaign.executionNote?.trim() ? (
        <p className="text-[11px] text-muted mt-1.5 line-clamp-2">{campaign.executionNote}</p>
      ) : null}
      {campaign.executionTxHash ? (
        <a
          href={`https://basescan.org/tx/${campaign.executionTxHash}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-[11px] text-accent-hover hover:underline mt-1"
        >
          Execution tx ↗
        </a>
      ) : null}
      {campaign.phase === 'pending_job' ? (
        <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-2 leading-snug">
          Bankr agent is posting the bounty
          {campaign.bankrAgentJobId ? ` (job ${campaign.bankrAgentJobId})` : ''}. This usually takes
          a few minutes — refresh shortly.
        </p>
      ) : null}
      {campaign.phase === 'stuck' ? (
        <p className="text-[11px] text-red-700 dark:text-red-300 mt-2 leading-snug">
          Funded but the 0xWork job is not linked yet. The site retries automatically — check back
          soon or open the 0xJobs tab.
        </p>
      ) : campaign.phase === 'funded' ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2 leading-snug">
          Payment recorded. The bankr.space worker will post this to 0xWork automatically — status
          updates when the task is linked.
        </p>
      ) : null}
    </div>
  );
}

function HistoryCard({
  lane,
  title,
  raisedUsd,
  goalUsd,
  detail,
}: {
  lane: string;
  title: string;
  raisedUsd: number;
  goalUsd: number;
  detail?: string | null;
}) {
  return (
    <div className="p-3 rounded-lg border border-border bg-surface-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{lane}</div>
      <div className="text-sm font-medium mt-1 leading-snug">{title}</div>
      <div className="text-xs text-muted mt-1 tabular-nums">
        Raised ${raisedUsd.toLocaleString()} of ${goalUsd.toLocaleString()} USDC
      </div>
      <div className="text-[11px] mt-2 font-medium text-green-600 dark:text-green-400">
        Goal completed
      </div>
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
  const [agentStatus, setAgentStatus] = useState<AgentPoolCampaignStatusView[]>([]);

  const loadAgentStatus = useCallback(async () => {
    if (!community.usePlatformAgent) {
      setAgentStatus([]);
      return;
    }
    try {
      const res = await fetch(`/api/communities/${community.tokenAddress}/agent-pool/status`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.funded)) {
        setAgentStatus(data.funded);
      }
    } catch {
      setAgentStatus(
        fundedAgentPoolCampaigns(community.agentPool).map((c) => ({
          ...c,
          phase: c.executedAt ? 'executed' : 'funded',
          statusLabel: c.executedAt ? 'Executed by agent' : 'Funded — awaiting agent job',
          oxworkUrl: null,
          poidhUrl: null,
          fundedSince: c.fundedAt ?? c.proposedAt ?? null,
          waitingMs: null,
        })) as AgentPoolCampaignStatusView[]
      );
    }
  }, [community.tokenAddress, community.usePlatformAgent, community.agentPool]);

  useEffect(() => {
    void loadAgentStatus();
  }, [loadAgentStatus, refreshKey]);

  const beneficiaryCompleted = completedCampaigns(community.fundraising);
  const agentFundedFallback = community.usePlatformAgent
    ? fundedAgentPoolCampaigns(community.agentPool)
    : [];
  const agentFunded =
    agentStatus.length > 0
      ? agentStatus
      : (agentFundedFallback.map((c) => ({
          ...c,
          phase: c.executedAt ? ('executed' as const) : ('funded' as const),
          statusLabel: c.executedAt ? 'Executed by agent' : 'Funded — awaiting agent job',
          oxworkUrl: null,
          poidhUrl: null,
          fundedSince: c.fundedAt ?? c.proposedAt ?? null,
          waitingMs: null,
        })) as AgentPoolCampaignStatusView[]);
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

  const introCommunity =
    'Holders propose a task and chip in USDC ($1 per click). When funded, the agent seeds a POIDH open bounty on poidh.xyz — others can add ETH to the pool, workers submit proof, contributors vote 48h. One open task at a time.';

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      {showCommunity ? (
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-border bg-surface">
            <h2 className="text-sm font-semibold">Community tasks</h2>
            <p className="text-[11px] text-muted mt-1 leading-snug">{introCommunity}</p>
          </div>
          {canProposeCommunityGoal ? (
            <CommunityProposeGoal
              tokenAddress={community.tokenAddress}
              symbol={community.symbol}
              onProposed={() => {
                onRefresh?.();
                void loadAgentStatus();
              }}
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
          <div className="p-4 rounded-xl border border-border bg-surface">
            <h2 className="text-sm font-semibold">Beneficiary programs</h2>
            <p className="text-[11px] text-muted mt-1 leading-snug">
              Optional goals set by the token&apos;s fee recipient — for example DexScreener boosts
              or promos they run on their own. USDC goes to them, not the community agent.
              {beneficiaryOpen ? ' Contribute below if a program is open.' : null}
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
            <div className="text-sm font-semibold">Past tasks</div>
            <p className="text-[11px] text-muted mt-0.5">
              Funding progress and linked 0xJobs.
            </p>
          </div>
          <div className="space-y-2">
            {beneficiaryCompleted.map((campaign) => (
              <HistoryCard
                key={`beneficiary-${campaign.id}`}
                lane="Beneficiary program"
                title={campaign.label}
                raisedUsd={campaign.raisedUsd}
                goalUsd={campaign.goalUsd}
                detail={fundraiserTypeLabel(campaign.id)}
              />
            ))}
            {agentFunded.map((campaign) => (
              <AgentPoolHistoryCard key={`agent-${campaign.skillId}`} campaign={campaign} />
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
