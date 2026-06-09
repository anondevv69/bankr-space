'use client';

import { useState } from 'react';
import { useAppWallet } from '@/hooks/useAppWallet';
import { useConnectWallet } from '@/components/WalletButton';
import type { Community, TokenLaunch } from '@/lib/types';
import { shortAddr, formatTime } from '@/lib/utils';
import { apiFetch } from '@/lib/wagmi';
import Link from 'next/link';
import { TokenAvatar } from '@/components/TokenAvatar';

export function CreateCommunity({
  communities,
  onCreated,
}: {
  communities: Community[];
  onCreated: () => void;
}) {
  const { address, isConnected } = useAppWallet();
  const { connectWallet } = useConnectWallet();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TokenLaunch[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<TokenLaunch | null>(null);
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);

  function closeSearch() {
    setOpen(false);
    setQuery('');
    setResults([]);
  }

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
      closeSearch();
      onCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create space';
      if (message.toLowerCase().includes('already exists') && modal) {
        setModal(null);
        setDesc('');
        closeSearch();
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors shrink-0"
      >
        Create Space
      </button>

      {open ? (
        <div
          className="fixed inset-0 bg-black/70 flex items-start justify-center p-5 z-50 overflow-y-auto"
          onClick={closeSearch}
        >
          <div
            className="bg-surface border border-border rounded-xl p-6 max-w-lg w-full mt-[10vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold">Create Space</h3>
                <p className="text-sm text-muted mt-1">
                  Search by token name, ticker, or contract address
                </p>
              </div>
              <button
                type="button"
                onClick={closeSearch}
                className="text-muted hover:text-text px-2 py-1 text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <input
              className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm mb-4"
              placeholder="Token name, symbol, or contract address…"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              autoFocus
            />

            {!query.trim() ? (
              <p className="text-muted text-sm">
                Find a Bankr token to start a space for it (new launches or legacy tokens like BNKR).
              </p>
            ) : loading ? (
              <p className="text-muted text-sm">Searching Bankr tokens…</p>
            ) : results.length === 0 ? (
              <p className="text-muted text-sm">
                No Bankr tokens found for &quot;{query.trim()}&quot;.
              </p>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {results.map((l) => {
                  const comm = communityFor(l.tokenAddress);
                  return (
                    <div
                      key={l.tokenAddress}
                      className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface-2 border border-border rounded-xl"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <TokenAvatar symbol={l.tokenSymbol} imageUrl={l.imageUrl} size={40} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-accent-hover">{l.tokenSymbol}</span>
                            <span className="text-[11px] uppercase text-muted bg-surface px-2 py-0.5 rounded-full">
                              {l.chain || 'base'}
                            </span>
                            {comm ? (
                              <span className="text-[11px] font-semibold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                                Space Live
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
                      </div>
                      <div>
                        {comm ? (
                          <Link
                            href={`/community/${l.tokenAddress}`}
                            className="inline-block px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover"
                            onClick={closeSearch}
                          >
                            Open Space
                          </Link>
                        ) : isConnected ? (
                          <button
                            type="button"
                            onClick={() => setModal(l)}
                            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover"
                          >
                            Start Space
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={connectWallet}
                            className="px-4 py-2 text-sm font-medium bg-surface border border-border rounded-lg"
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
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-5 z-[60]">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Create Space</h3>
            <p className="text-muted text-sm mb-4">Start a space for ${modal.tokenSymbol}</p>
            <textarea
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm mb-4"
              rows={3}
              placeholder="Space description (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
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
    </>
  );
}
