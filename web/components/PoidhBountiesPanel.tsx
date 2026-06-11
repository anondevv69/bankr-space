'use client';

import { useCallback, useEffect, useState } from 'react';
import { PoidhOpenBountyGuide } from '@/components/PoidhOpenBountyGuide';

type PoidhBountyView = {
  id: number;
  frontendId: number;
  name: string;
  description: string;
  issuer: string;
  amountWei: string;
  url: string;
  openBounty?: boolean;
};

function formatEth(wei: string): string {
  try {
    const eth = Number(BigInt(wei)) / 1e18;
    if (eth < 0.001) return `${eth.toFixed(4)} ETH`;
    if (eth < 1) return `${eth.toFixed(3)} ETH`;
    return `${eth.toFixed(2)} ETH`;
  } catch {
    return 'ETH bounty';
  }
}

function bountyTitle(bounty: PoidhBountyView): string {
  const line = bounty.name?.trim() || bounty.description.split('\n')[0]?.trim() || 'Open bounty';
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}

export function PoidhBountiesPanel({
  tokenAddress,
  symbol,
  embedded = false,
}: {
  tokenAddress: string;
  symbol: string;
  embedded?: boolean;
}) {
  const [bounties, setBounties] = useState<PoidhBountyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/communities/${tokenAddress}/poidh`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load bounties');
      setBounties(data.bounties || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bounties');
      setBounties([]);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p
        className={`text-center text-muted py-12 border border-dashed border-border rounded-xl bg-surface ${
          embedded ? 'py-8' : ''
        }`}
      >
        Loading POIDH bounties…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-center text-red-400 py-12 border border-dashed border-border rounded-xl bg-surface">
        {error}
      </p>
    );
  }

  if (!bounties.length) {
    if (embedded) return null;
    return (
      <div className="text-center py-12 px-6 border border-dashed border-border rounded-xl bg-surface space-y-3">
        <p className="text-muted text-sm">No open POIDH bounties for ${symbol} yet.</p>
        <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
          Propose a POIDH community task in the sidebar. When funded, the agent posts on{' '}
          <a
            href="https://poidh.xyz/base"
            target="_blank"
            rel="noreferrer"
            className="text-accent-hover hover:underline"
          >
            poidh.xyz
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PoidhOpenBountyGuide compact={embedded} />
      {bounties.map((bounty) => (
        <div
          key={bounty.id}
          className="p-4 rounded-xl border border-border bg-surface hover:border-accent/40 transition-colors space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium leading-snug">{bountyTitle(bounty)}</div>
              <p className="text-xs text-muted mt-1 line-clamp-3 whitespace-pre-wrap">
                {bounty.description}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold tabular-nums">{formatEth(bounty.amountWei)}</div>
              <div className="text-[10px] uppercase tracking-wide text-green-600 dark:text-green-400 mt-0.5">
                Open pool
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={bounty.url}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg"
            >
              Do task / submit proof ↗
            </a>
            <a
              href={bounty.url}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-accent bg-surface-2"
            >
              Add funds (voting power) ↗
            </a>
          </div>
          <p className="text-[10px] text-muted leading-relaxed">
            Worker submits proof on POIDH → creator proposes winner → contributors vote 48h →
            payout if yes wins.
          </p>
        </div>
      ))}
    </div>
  );
}
