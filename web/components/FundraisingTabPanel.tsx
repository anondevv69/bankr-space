'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FundraisingCampaign } from '@/lib/types';
import { FundraisingWidget } from '@/components/FundraisingWidget';
import { AgentPoolWidget } from '@/components/AgentPoolWidget';

type CampaignView = FundraisingCampaign & {
  progressPct: number;
  remainingUsd: number;
  funded: boolean;
};

function CampaignCard({
  campaign,
  completed = false,
}: {
  campaign: CampaignView;
  completed?: boolean;
}) {
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
  showAgentPool,
  refreshKey,
}: {
  tokenAddress: string;
  symbol: string;
  showAgentPool?: boolean;
  refreshKey?: string;
}) {
  const [open, setOpen] = useState<CampaignView[]>([]);
  const [completed, setCompleted] = useState<CampaignView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/communities/${tokenAddress}/fundraising`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setOpen(data.open || data.campaigns || []);
      setCompleted(data.completed || []);
    } catch {
      setOpen([]);
      setCompleted([]);
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

  const hasBeneficiary = open.length > 0 || completed.length > 0;
  const hasAgent = !!showAgentPool;

  if (!hasBeneficiary && !hasAgent) {
    return (
      <p className="text-center text-muted py-12 border border-dashed border-border rounded-xl bg-surface">
        No fundraisers on this space yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {hasAgent ? (
        <section>
          <h2 className="text-sm font-semibold mb-1">Community agent goals</h2>
          <p className="text-xs text-muted mb-3 leading-snug">
            Holders fund QRCoin or 0xWork tasks for the Bankr Space Agent.
          </p>
          <AgentPoolWidget
            tokenAddress={tokenAddress}
            symbol={symbol}
            refreshKey={refreshKey}
            layout="horizontal"
          />
        </section>
      ) : null}

      {open.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold mb-1">Open fundraisers</h2>
          <p className="text-xs text-muted mb-3 leading-snug">
            Fee-recipient programs — optional $Space contributions via x402 (~$1 toward the goal
            per click).
          </p>
          <div className="space-y-3 mb-4">
            {open.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
          <FundraisingWidget
            tokenAddress={tokenAddress}
            symbol={symbol}
            refreshKey={refreshKey}
            layout="horizontal"
          />
        </section>
      ) : null}

      {completed.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold mb-1">
            {open.length > 0 ? 'Completed fundraisers' : 'Fundraisers'}
          </h2>
          {open.length === 0 ? (
            <p className="text-xs text-muted mb-3 leading-snug">
              Past fee-recipient goals that reached their target.
            </p>
          ) : null}
          <div className="space-y-3">
            {completed.map((c) => (
              <CampaignCard key={c.id} campaign={c} completed />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
