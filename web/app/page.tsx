'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header, Footer } from '@/components/Header';
import { useEmbeddedBankr } from '@/components/EmbeddedBankrProvider';
import { useAppWallet } from '@/hooks/useAppWallet';
import { CommunityCard } from '@/components/CommunityCard';
import { CreateCommunity } from '@/components/CreateCommunity';
import { isNativeSpaceCommunity } from '@/lib/featured-community';
import { isSiteAdminWallet } from '@/lib/site-admin';
import { apiFetch } from '@/lib/wagmi';
import type { Community, PetitionSpace, TokenMarketStats } from '@/lib/types';

type VerifiedFilter = 'all' | 'verified' | 'unverified';

const VERIFIED_FILTERS: Array<{ id: VerifiedFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'verified', label: 'Verified' },
  { id: 'unverified', label: 'Unverified' },
];

export default function HomePage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [petitions, setPetitions] = useState<PetitionSpace[]>([]);
  const [markets, setMarkets] = useState<Record<string, TokenMarketStats>>({});
  const [syncAt, setSyncAt] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);
  const embed = useEmbeddedBankr();
  const { address, isConnected } = useAppWallet();
  const isSiteAdmin = isConnected && isSiteAdminWallet(address);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [commRes, petRes] = await Promise.all([
        fetch('/api/communities'),
        fetch('/api/petitions'),
      ]);
      const data = await commRes.json();
      const petData = petRes.ok ? await petRes.json() : { petitions: [] };
      if (!commRes.ok) throw new Error(data.error || 'Failed to load');
      setCommunities(data.communities || []);
      setPetitions(petData.petitions || []);
      setSyncAt(data.syncUpdatedAt || null);

      const list: Community[] = data.communities || [];
      if (list.length > 0) {
        const addresses = list.map((c) => c.tokenAddress).join(',');
        fetch(`/api/market?addresses=${addresses}`)
          .then((marketRes) => marketRes.json())
          .then((marketData) => setMarkets(marketData.markets || {}))
          .catch(() => setMarkets({}));
      } else {
        setMarkets({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeleteSpace(tokenAddress: string) {
    if (!address || !isSiteAdminWallet(address)) return;
    const community = communities.find(
      (c) => c.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
    );
    if (!community) return;
    if (
      !window.confirm(
        `Delete the $${community.symbol} space and all its posts? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingAddress(tokenAddress);
    try {
      await apiFetch(`/api/communities/${tokenAddress}`, {
        method: 'DELETE',
        wallet: address,
      });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingAddress(null);
    }
  }

  const matchesSearch = (c: Community) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase().replace(/\s+/g, '');
    const name = c.name.toLowerCase().replace(/\s+/g, '');
    const symbol = c.symbol.toLowerCase();
    const address = c.tokenAddress.toLowerCase();
    return name.includes(q) || symbol.includes(q) || address.includes(q);
  };

  const matchesVerifiedTab = (c: Community) => {
    if (verifiedFilter === 'verified') return c.verified;
    if (verifiedFilter === 'unverified') return !c.verified;
    return true;
  };

  const featured = communities.find((c) => isNativeSpaceCommunity(c.tokenAddress));
  const featuredVisible = !!featured && matchesSearch(featured);

  const tabFiltered = communities.filter(
    (c) => matchesSearch(c) && matchesVerifiedTab(c)
  );

  const withoutFeatured = tabFiltered.filter(
    (c) => !isNativeSpaceCommunity(c.tokenAddress)
  );

  const displayList =
    featuredVisible && featured
      ? [featured, ...withoutFeatured]
      : tabFiltered;

  return (
    <div className={`max-w-[1100px] mx-auto px-5 pb-16 ${embed.isEmbedded ? 'pt-4' : ''}`}>
      <Header syncUpdatedAt={syncAt} />

      <section>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <div className="text-lg font-semibold">Spaces</div>
            <div className="text-sm text-muted">Browse active token spaces</div>
          </div>
          <CreateCommunity communities={communities} onCreated={load} />
        </div>

        {petitions.length ? (
          <div className="mb-8">
            <div className="text-sm font-semibold mb-3">Petition spaces (pre-launch)</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {petitions.map((p) => (
                <a
                  key={p.tmpPetitionId}
                  href={`/community/petition/${p.tmpPetitionId}`}
                  className="block p-4 rounded-xl border border-accent/30 bg-surface hover:border-accent transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-accent-hover">${p.tokenSymbol}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                      Petition
                    </span>
                  </div>
                  <div className="text-sm font-medium mt-1">{p.tokenName}</div>
                  <p className="text-xs text-muted mt-2 line-clamp-2">{p.description}</p>
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <input
          className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm mb-4"
          placeholder="Search spaces by name, ticker, or contract…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <div className="flex flex-wrap gap-1 p-1 bg-surface-2 border border-border rounded-xl mb-5 w-fit">
          {VERIFIED_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setVerifiedFilter(item.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                verifiedFilter === item.id
                  ? 'bg-surface text-text shadow-sm border border-border'
                  : 'text-muted hover:text-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted text-sm">Loading spaces…</p>
        ) : error ? (
          <div className="text-red-400 text-sm p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            {error}
          </div>
        ) : displayList.length === 0 ? (
          <p className="text-muted text-sm p-8 text-center border border-dashed border-border rounded-xl">
            {communities.length === 0
              ? 'No spaces yet. Click Create Space to search for a token and start one.'
              : 'No spaces match your search or filter.'}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {displayList.map((c) => (
              <CommunityCard
                key={c.tokenAddress}
                community={c}
                market={markets[c.tokenAddress.toLowerCase()] || null}
                featured={isNativeSpaceCommunity(c.tokenAddress)}
                canDelete={isSiteAdmin}
                onDelete={handleDeleteSpace}
                deleting={deletingAddress === c.tokenAddress}
              />
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
