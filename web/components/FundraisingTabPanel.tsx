'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AgentPoolSkillId, FundraisingCampaign } from '@/lib/types';
import { FundraisingWidget } from '@/components/FundraisingWidget';
import { AgentPoolWidget } from '@/components/AgentPoolWidget';

type BeneficiaryCampaignView = FundraisingCampaign & {
  progressPct: number;
  remainingUsd: number;
  funded: boolean;
};

type AgentCampaignView = {
  skillId: AgentPoolSkillId;
  label: string;
  goalUsd: number;
  raisedUsd: number;
  progressPct: number;
  remainingUsd: number;
  funded: boolean;
  executedAt?: number | null;
};

function BeneficiaryCampaignCard({
  campaign,
  status = 'open',
}: {
  campaign: BeneficiaryCampaignView;
  status?: 'open' | 'completed' | 'cancelled';
}) {
  const completed = status === 'completed';
  const cancelled = status === 'cancelled';

  return (
    <div
      className={`p-4 rounded-xl border bg-surface ${
        cancelled
          ? 'border-amber-500/40 bg-amber-500/[0.04]'
          : completed
            ? 'border-green-500/25'
            : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{campaign.label}</div>
          <div className="text-xs text-muted mt-0.5 tabular-nums">
            ${campaign.raisedUsd.toLocaleString()} raised · goal ${campaign.goalUsd.toLocaleString()}
          </div>
        </div>
        {cancelled ? (
          <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400">
            Cancelled
          </span>
        ) : completed ? (
          <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
            Completed
          </span>
        ) : (
          <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md bg-accent/10 text-accent">
            Open
          </span>
        )}
      </div>
      <div className="h-2 rounded-full bg-surface-2 border border-border overflow-hidden">
        <div
          className={`h-full transition-all ${
            cancelled ? 'bg-amber-500' : completed ? 'bg-green-500' : 'bg-accent'
          }`}
          style={{ width: `${campaign.progressPct}%` }}
        />
      </div>
      {!completed && !cancelled && campaign.remainingUsd > 0 ? (
        <p className="text-[11px] text-muted mt-1.5">
          ${campaign.remainingUsd.toLocaleString()} remaining
        </p>
      ) : null}
      {cancelled ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2 leading-snug">
          Closed by the fee recipient before the goal was met. ${campaign.raisedUsd.toLocaleString()}{' '}
          was contributed — bankr.space does not verify how these funds were used.
        </p>
      ) : null}
    </div>
  );
}

function AgentCampaignCard({
  campaign,
  completed = false,
}: {
  campaign: AgentCampaignView;
  completed?: boolean;
}) {
  const executed = completed && Boolean(campaign.executedAt);
  return (
    <div className="p-4 rounded-xl border border-border bg-surface">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{campaign.label}</div>
          <div className="text-xs text-muted mt-0.5 tabular-nums">
            ${campaign.raisedUsd.toLocaleString()} raised · goal ${campaign.goalUsd.toLocaleString()}
          </div>
        </div>
        {completed ? (
          <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
            {executed ? 'Executed' : 'Completed'}
          </span>
        ) : (
          <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md bg-accent/10 text-accent">
            Open
          </span>
        )}
      </div>
      <div className="h-2 rounded-full bg-surface-2 border border-border overflow-hidden">
        <div
          className={`h-full transition-all ${completed ? 'bg-green-500' : 'bg-accent'}`}
          style={{ width: `${campaign.progressPct}%` }}
        />
      </div>
      {!completed && campaign.remainingUsd > 0 ? (
        <p className="text-[11px] text-muted mt-1.5">
          ${campaign.remainingUsd.toLocaleString()} remaining
        </p>
      ) : null}
    </div>
  );
}

export function FundraisingTabPanel({
  tokenAddress,
  symbol,
  refreshKey,
}: {
  tokenAddress: string;
  symbol: string;
  refreshKey?: string;
}) {
  const [beneficiaryOpen, setBeneficiaryOpen] = useState<BeneficiaryCampaignView[]>([]);
  const [beneficiaryCompleted, setBeneficiaryCompleted] = useState<BeneficiaryCampaignView[]>([]);
  const [beneficiaryCancelled, setBeneficiaryCancelled] = useState<BeneficiaryCampaignView[]>([]);
  const [agentOpen, setAgentOpen] = useState<AgentCampaignView[]>([]);
  const [agentCompleted, setAgentCompleted] = useState<AgentCampaignView[]>([]);
  const [agentConfigured, setAgentConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fundRes, agentRes] = await Promise.all([
        fetch(`/api/communities/${tokenAddress}/fundraising`),
        fetch(`/api/communities/${tokenAddress}/agent-pool`),
      ]);
      const fundData = await fundRes.json();
      const agentData = await agentRes.json();

      if (fundRes.ok) {
        setBeneficiaryOpen(fundData.open || fundData.campaigns || []);
        setBeneficiaryCompleted(fundData.completed || []);
        setBeneficiaryCancelled(fundData.cancelled || []);
      } else {
        setBeneficiaryOpen([]);
        setBeneficiaryCompleted([]);
        setBeneficiaryCancelled([]);
      }

      if (agentRes.ok) {
        setAgentOpen(agentData.open || agentData.campaigns || []);
        setAgentCompleted(agentData.completed || []);
        setAgentConfigured(Boolean(agentData.usePlatformAgent && agentData.verified));
      } else {
        setAgentOpen([]);
        setAgentCompleted([]);
        setAgentConfigured(false);
      }
    } catch {
      setBeneficiaryOpen([]);
      setBeneficiaryCompleted([]);
      setBeneficiaryCancelled([]);
      setAgentOpen([]);
      setAgentCompleted([]);
      setAgentConfigured(false);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <p className="text-center text-muted py-12 border border-dashed border-border rounded-xl bg-surface">
        Loading fundraisers…
      </p>
    );
  }

  const hasBeneficiary =
    beneficiaryOpen.length > 0 ||
    beneficiaryCompleted.length > 0 ||
    beneficiaryCancelled.length > 0;
  const hasAgent = agentOpen.length > 0 || agentCompleted.length > 0;

  if (!hasBeneficiary && !hasAgent) {
    return (
      <p className="text-center text-muted py-12 border border-dashed border-border rounded-xl bg-surface">
        No fundraisers on this space yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {beneficiaryOpen.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold mb-1">Open fundraisers</h2>
          <p className="text-xs text-muted mb-3 leading-snug">
            Fee-recipient programs — optional $Space contributions via x402 (~$1 toward the goal
            per click).
          </p>
          <FundraisingWidget
            tokenAddress={tokenAddress}
            symbol={symbol}
            refreshKey={refreshKey}
            layout="horizontal"
            showHeader={false}
          />
        </section>
      ) : null}

      {agentOpen.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold mb-1">Community agent goals</h2>
          <p className="text-xs text-muted mb-3 leading-snug">
            Holders fund QRCoin or 0xWork tasks for the Bankr Space Agent.
          </p>
          {agentConfigured ? (
            <AgentPoolWidget
              tokenAddress={tokenAddress}
              symbol={symbol}
              refreshKey={refreshKey}
              layout="horizontal"
              showHeader={false}
            />
          ) : (
            <div className="space-y-3">
              {agentOpen.map((c) => (
                <AgentCampaignCard key={c.skillId} campaign={c} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {beneficiaryCancelled.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold mb-1">Cancelled fundraisers</h2>
          <p className="text-xs text-muted mb-3 leading-snug">
            These goals were closed by the fee recipient before reaching their target. Funds may
            have been collected — bankr.space cannot confirm how they were used.
          </p>
          <div className="space-y-3">
            {beneficiaryCancelled.map((c) => (
              <BeneficiaryCampaignCard key={c.id} campaign={c} status="cancelled" />
            ))}
          </div>
        </section>
      ) : null}

      {beneficiaryCompleted.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold mb-1">Completed fundraisers</h2>
          <p className="text-xs text-muted mb-3 leading-snug">
            Past fee-recipient goals that reached their target.
          </p>
          <div className="space-y-3">
            {beneficiaryCompleted.map((c) => (
              <BeneficiaryCampaignCard key={c.id} campaign={c} status="completed" />
            ))}
          </div>
        </section>
      ) : null}

      {agentCompleted.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold mb-1">Completed community agent goals</h2>
          <p className="text-xs text-muted mb-3 leading-snug">
            Past QRCoin or 0xWork goals funded by holders.
          </p>
          <div className="space-y-3">
            {agentCompleted.map((c) => (
              <AgentCampaignCard key={c.skillId} campaign={c} completed />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
