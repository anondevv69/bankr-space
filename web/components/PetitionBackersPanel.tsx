'use client';

import { useEffect, useState } from 'react';
import { shortAddr } from '@/lib/utils';

type HolderRow = {
  wallet: string;
  units: string;
  sharePct?: number;
};

export function PetitionBackersPanel({ tokenAddress }: { tokenAddress: string }) {
  const [holders, setHolders] = useState<HolderRow[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/communities/${tokenAddress}/holders`);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setHolders(data.holders || []);
          setSource(data.source || null);
        }
      } catch {
        if (!cancelled) setHolders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenAddress]);

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-border bg-surface text-xs text-muted">
        Loading backers…
      </div>
    );
  }

  if (!holders.length) {
    return null;
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-surface space-y-2">
      <div className="text-sm font-semibold">Petition backers</div>
      <p className="text-[10px] text-muted">
        {source === 'cap_table'
          ? 'Fee-right unit holders (from Token Marketplace)'
          : 'Pre-launch backers who funded the petition'}
      </p>
      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {holders.map((h) => (
          <li key={h.wallet} className="text-xs flex justify-between gap-2 text-muted">
            <span>{shortAddr(h.wallet)}</span>
            <span className="tabular-nums shrink-0">
              {h.units} units
              {h.sharePct ? ` · ${h.sharePct}%` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
