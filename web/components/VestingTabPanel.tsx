'use client';

import { useCallback, useEffect, useState } from 'react';

type VestingGrant = {
  repoFullName: string;
  githubOwner: string;
  status: string;
  totalLockedFormatted: string;
  progress: {
    verifiedPushCount: number;
    totalPushesRequired: number;
    summary?: string;
  };
  progressPct: number;
  lockUrl: string;
  devUrl: string;
  githubUrl: string;
  streaming?: boolean;
  createdAt?: string;
};

type VestingResponse = {
  ok: boolean;
  symbol: string;
  count: number;
  activeCount: number;
  uniqueDevs: number;
  createLockUrl: string;
  exploreUrl: string;
  grants: VestingGrant[];
};

function StatusBadge({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span
      className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md ${
        active
          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
          : status === 'complete'
            ? 'bg-accent/10 text-accent'
            : 'bg-surface-2 text-muted'
      }`}
    >
      {status}
    </span>
  );
}

function GrantCard({ grant, symbol }: { grant: VestingGrant; symbol: string }) {
  const pct = Math.min(100, Math.max(0, grant.progressPct));

  return (
    <article className="p-4 rounded-xl border border-border bg-surface">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <a
            href={grant.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold hover:text-accent break-all"
          >
            {grant.repoFullName}
          </a>
          <div className="text-xs text-muted mt-0.5">
            <a href={grant.devUrl} target="_blank" rel="noreferrer" className="hover:text-accent">
              @{grant.githubOwner}
            </a>
            {' · '}
            {grant.totalLockedFormatted} {symbol} locked
            {grant.streaming ? ' · streaming' : ''}
          </div>
        </div>
        <StatusBadge status={grant.status} />
      </div>

      <div className="h-2 rounded-full bg-surface-2 border border-border overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>

      <p className="text-xs text-muted mt-2 tabular-nums">
        {grant.progress.verifiedPushCount} / {grant.progress.totalPushesRequired} verified pushes
        {' · '}
        {pct}%
      </p>

      {grant.progress.summary ? (
        <p className="text-[11px] text-muted mt-1 leading-snug">{grant.progress.summary}</p>
      ) : null}

      <div className="flex flex-wrap gap-3 mt-3 text-xs">
        <a
          href={grant.lockUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-accent hover:underline"
        >
          View lock on Proof of Dev →
        </a>
        <a
          href={grant.githubUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted hover:text-text"
        >
          GitHub repo
        </a>
      </div>
    </article>
  );
}

export function VestingTabPanel({
  tokenAddress,
  symbol,
}: {
  tokenAddress: string;
  symbol: string;
}) {
  const [data, setData] = useState<VestingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/communities/${tokenAddress}/vesting`);
      const json = (await res.json()) as VestingResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load vesting');
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p className="text-center text-muted py-12 border border-dashed border-border rounded-xl bg-surface">
        Loading vesting…
      </p>
    );
  }

  if (!data || data.count === 0) {
    return (
      <div className="text-center py-12 px-4 border border-dashed border-border rounded-xl bg-surface">
        <p className="text-muted mb-2">No GitHub vesting locks on {symbol} yet.</p>
        <p className="text-xs text-muted mb-4 max-w-md mx-auto leading-relaxed">
          Developers can lock {symbol} on Proof of Dev and earn tokens back by shipping verified
          pushes to their repos.
        </p>
        <a
          href={`https://www.proofofdev.xyz/create?token=${tokenAddress}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90"
        >
          Create lock on Proof of Dev →
        </a>
      </div>
    );
  }

  const sorted = [...data.grants].sort(
    (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  );

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-border bg-surface-2/50">
        <h2 className="text-sm font-semibold mb-1">Proof of Dev</h2>
        <p className="text-xs text-muted leading-relaxed">
          {data.activeCount} active lock{data.activeCount === 1 ? '' : 's'} across{' '}
          {data.uniqueDevs} developer{data.uniqueDevs === 1 ? '' : 's'}. Tokens release when
          verified code ships to linked GitHub repos.
        </p>
        <a
          href={data.exploreUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2 text-xs font-medium text-accent hover:underline"
        >
          Explore all locks on Proof of Dev →
        </a>
      </div>

      <div className="space-y-3">
        {sorted.map((grant) => (
          <GrantCard key={grant.repoFullName} grant={grant} symbol={symbol} />
        ))}
      </div>
    </div>
  );
}
