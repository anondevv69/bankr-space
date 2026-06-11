'use client';

import { useCallback, useEffect, useState } from 'react';
import { OxWorkJobsPanel } from '@/components/OxWorkJobsPanel';
import { PoidhBountiesPanel } from '@/components/PoidhBountiesPanel';
import { POIDH_COMMUNITY_TASK_INTRO } from '@/lib/poidh-open-bounty';
import { PoidhOpenBountyGuide } from '@/components/PoidhOpenBountyGuide';

export function CommunityJobsPanel({
  tokenAddress,
  symbol,
}: {
  tokenAddress: string;
  symbol: string;
}) {
  const [hasOxWork, setHasOxWork] = useState(false);
  const [hasPoidh, setHasPoidh] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [oxRes, poidhRes] = await Promise.all([
        fetch(`/api/communities/${tokenAddress}/oxwork`),
        fetch(`/api/communities/${tokenAddress}/poidh`),
      ]);
      const oxData = oxRes.ok ? await oxRes.json() : { tasks: [] };
      const poidhData = poidhRes.ok ? await poidhRes.json() : { bounties: [] };
      setHasOxWork((oxData.tasks?.length ?? 0) > 0);
      setHasPoidh((poidhData.bounties?.length ?? 0) > 0);
    } catch {
      setHasOxWork(false);
      setHasPoidh(false);
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
        Loading community jobs…
      </p>
    );
  }

  if (!hasOxWork && !hasPoidh) {
    return (
      <div className="text-center py-12 px-6 border border-dashed border-border rounded-xl bg-surface space-y-3">
        <p className="text-muted text-sm">No open community jobs for ${symbol} yet.</p>
        <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
          {POIDH_COMMUNITY_TASK_INTRO} Propose a POIDH open bounty in the sidebar.
        </p>
        <PoidhOpenBountyGuide />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {hasPoidh ? (
        <section>
          <div className="mb-3">
            <h3 className="text-sm font-semibold">POIDH open bounties</h3>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Crowdfund + verify on{' '}
              <a
                href="https://poidh.xyz/base"
                target="_blank"
                rel="noreferrer"
                className="text-accent-hover hover:underline"
              >
                poidh.xyz
              </a>{' '}
              — add ETH to the pool, do the task, vote on proof.
            </p>
          </div>
          <PoidhBountiesPanel tokenAddress={tokenAddress} symbol={symbol} embedded />
        </section>
      ) : null}
      {hasOxWork ? (
        <section>
          <div className="mb-3">
            <h3 className="text-sm font-semibold">0xWork jobs</h3>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Agent-oriented tasks on 0xWork — claim via wallet or CLI.
            </p>
          </div>
          <OxWorkJobsPanel tokenAddress={tokenAddress} symbol={symbol} embedded />
        </section>
      ) : null}
    </div>
  );
}
