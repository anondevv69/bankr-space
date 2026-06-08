'use client';

import { useState } from 'react';
import { useAppWallet } from '@/hooks/useAppWallet';
import { useConnectWallet } from '@/components/WalletButton';
import type { Community, TokenLaunch } from '@/lib/types';
import { shortAddr, formatTime } from '@/lib/utils';
import { apiFetch } from '@/lib/wagmi';
import Link from 'next/link';

export function CreateCommunity({
  communities,
  onCreated,
}: {
  communities: Community[];
  onCreated: () => void;
}) {
  const { address, isConnected } = useAppWallet();
  const { connectWallet } = useConnectWallet();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TokenLaunch[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<TokenLaunch | null>(null);
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);

  async function onSearch(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch(`/api/tokens/search?q=${encodeURIComponent(q.trim())}`);
      setResults(data.launches || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function communityFor(addr: string) {
    return communities.find((c) => c.tokenAddress.toLowerCase() === addr.toLowerCase());
  }

  async function confirmCreate() {
    if (!modal || !address) return;
    setCreating(true);
    try {
      await apiFetch(`/api/communities/${modal.tokenAddress}`, {
        method: 'POST',
        wallet: address,
        body: JSON.stringify({ description: desc }),
      });
      setModal(null);
      setDesc('');
      onCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create community';
      if (message.toLowerCase().includes('already exists') && modal) {
        setModal(null);
        setDesc('');
        onCreated();
        window.location.href = `/community/${modal.tokenAddress}`;
        return;
      }
      alert(message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-5">
        <div className="text-lg font-semibold">Create Community</div>
        <div className="text-sm text-muted">Search for a Bankr token by name or contract address</div>
      </div>
      <input
        className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm mb-5"
        placeholder="Token name, symbol, or contract address…"
        value={query}
        onChange={(e) => onSearch(e.target.value)}
      />
      {!query.trim() ? (
        <p className="text-muted text-sm italic">
          Search above to find a Bankr-deployed token and start a community for it.
        </p>
      ) : loading ? (
        <p className="text-muted text-sm">Searching Bankr tokens…</p>
      ) : results.length === 0 ? (
        <p className="text-muted text-sm">
          No Bankr-launched tokens found for &quot;{query.trim()}&quot;.
        </p>
      ) : (
        <div className="space-y-3">
          {results.map((l) => {
            const comm = communityFor(l.tokenAddress);
            return (
              <div
                key={l.tokenAddress}
                className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface border border-border rounded-xl"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-accent-hover">{l.tokenSymbol}</span>
                    <span className="text-[11px] uppercase text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                      {l.chain || 'base'}
                    </span>
                    {comm ? (
                      <span className="text-[11px] font-semibold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                        Community Live
                      </span>
                    ) : null}
                  </div>
                  <div className="font-semibold mt-1">{l.tokenName}</div>
                  <div className="text-xs text-muted mt-2 flex gap-3 flex-wrap">
                    <span>{shortAddr(l.tokenAddress)}</span>
                    <span>Owner: {shortAddr(l.feeRecipient?.walletAddress)}</span>
                    <span>{formatTime(l.timestamp)}</span>
                  </div>
                </div>
                <div>
                  {comm ? (
                    <Link
                      href={`/community/${l.tokenAddress}`}
                      className="inline-block px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover"
                    >
                      Open Community
                    </Link>
                  ) : isConnected ? (
                    <button
                      onClick={() => setModal(l)}
                      className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover"
                    >
                      Start Community
                    </button>
                  ) : (
                    <button
                      onClick={connectWallet}
                      className="px-4 py-2 text-sm font-medium bg-surface-2 border border-border rounded-lg"
                    >
                      Connect to Start
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal ? (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-5 z-50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Create Community</h3>
            <p className="text-muted text-sm mb-4">Start a community for ${modal.tokenSymbol}</p>
            <textarea
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm mb-4"
              rows={3}
              placeholder="Community description (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmCreate}
                disabled={creating}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
