'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header, Footer } from '@/components/Header';
import { CommunityCard } from '@/components/CommunityCard';
import { CreateCommunity } from '@/components/CreateCommunity';
import type { Community } from '@/lib/types';

export default function HomePage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [syncAt, setSyncAt] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/communities');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setCommunities(data.communities || []);
      setSyncAt(data.syncUpdatedAt || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load communities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = communities.filter((c) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q) ||
      c.tokenAddress.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-[1100px] mx-auto px-5 pb-16">
      <Header syncUpdatedAt={syncAt} />

      <section>
        <div className="mb-5">
          <div className="text-lg font-semibold">Communities</div>
          <div className="text-sm text-muted">Browse active token communities</div>
        </div>
        <input
          className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm mb-5"
          placeholder="Filter communities…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {loading ? (
          <p className="text-muted text-sm">Loading communities…</p>
        ) : error ? (
          <div className="text-red-400 text-sm p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted text-sm p-8 text-center border border-dashed border-border rounded-xl">
            {communities.length === 0
              ? 'No communities yet. Use Create Community below to search for a token and start one.'
              : 'No communities match your search.'}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {filtered.map((c) => (
              <CommunityCard key={c.tokenAddress} community={c} />
            ))}
          </div>
        )}
      </section>

      <CreateCommunity communities={communities} onCreated={load} />
      <Footer />
    </div>
  );
}
