'use client';

import { useCallback, useEffect, useState } from 'react';
import { OxWorkJobsPanel } from '@/components/OxWorkJobsPanel';

export function CommunityJobsPanel({
  tokenAddress,
  symbol,
}: {
  tokenAddress: string;
  symbol: string;
}) {
  const [hasOxWork, setHasOxWork] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const oxRes = await fetch(`/api/communities/${tokenAddress}/oxwork`);
      const oxData = oxRes.ok ? await oxRes.json() : { tasks: [] };
      setHasOxWork((oxData.tasks?.length ?? 0) > 0);
    } catch {
      setHasOxWork(false);
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
        Loading jobs…
      </p>
    );
  }

  if (!hasOxWork) {
    return (
      <div className="text-center py-12 px-6 border border-dashed border-border rounded-xl bg-surface space-y-2">
        <p className="text-muted text-sm">No open 0xWork jobs for ${symbol} yet.</p>
        <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
          Fund a community goal in the sidebar to have the agent post agent-oriented tasks on
          0xWork. For custom crowdfunded tasks, use the Bounties tab — any holder can create one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">0xWork jobs</h3>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">
          Agent-oriented tasks on 0xWork — claim via wallet or CLI.
        </p>
      </div>
      <OxWorkJobsPanel tokenAddress={tokenAddress} symbol={symbol} embedded />
    </div>
  );
}
