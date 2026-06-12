'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppWallet } from '@/hooks/useAppWallet';
import { useConnectWallet } from '@/components/WalletButton';
import type { Community, TokenLaunch } from '@/lib/types';
import { shortAddr, formatTime } from '@/lib/utils';
import { apiFetch } from '@/lib/wagmi';
import Link from 'next/link';
import { TokenAvatar } from '@/components/TokenAvatar';

type CreateMode = 'token' | 'petition';
type BackingMode = 'slots' | 'maxUnits';

type PetitionConfig = {
  goalUnits?: number;
  publicSaleUnitsWithTmkClaim?: number;
  tmkClaimService?: boolean;
  tmkClaimReserveUnits?: number;
};

export function CreateCommunity({
  communities,
  onCreated,
}: {
  communities: Community[];
  onCreated: () => void;
}) {
  const router = useRouter();
  const { address, isConnected } = useAppWallet();
  const { connectWallet } = useConnectWallet();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CreateMode>('token');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TokenLaunch[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<TokenLaunch | null>(null);
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [petitionName, setPetitionName] = useState('');
  const [petitionSymbol, setPetitionSymbol] = useState('');
  const [petitionDesc, setPetitionDesc] = useState('');
  const [backingMode, setBackingMode] = useState<BackingMode>('slots');
  const [supporterSlots, setSupporterSlots] = useState('50');
  const [maxUnits, setMaxUnits] = useState('10');
  const [tmkClaimOptIn, setTmkClaimOptIn] = useState(false);
  const [petitionConfig, setPetitionConfig] = useState<PetitionConfig | null>(null);

  useEffect(() => {
    if (!open || mode !== 'petition') return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/petitions');
        if (!cancelled) setPetitionConfig(data.config || null);
      } catch {
        if (!cancelled) setPetitionConfig(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  const goalUnits = petitionConfig?.goalUnits || 1000;
  const publicCap =
    tmkClaimOptIn && petitionConfig?.publicSaleUnitsWithTmkClaim
      ? petitionConfig.publicSaleUnitsWithTmkClaim
      : goalUnits;
  const slotsN = Math.max(1, Math.floor(Number(supporterSlots) || 1));
  const unitsPerSlot = Math.floor(publicCap / slotsN);
  const maxUnitsN = Math.max(1, Math.min(1000, Number(maxUnits) || 10));
  const maxBackersFromUnits = Math.floor(publicCap / maxUnitsN);
  const showTmkOption = !!petitionConfig?.tmkClaimService;

  function closeSearch() {
    setOpen(false);
    setQuery('');
    setResults([]);
    setMode('token');
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

  async function createPetitionSpace() {
    if (!address) {
      connectWallet();
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        tokenName: petitionName.trim(),
        tokenSymbol: petitionSymbol.trim().replace(/^\$/, ''),
        description: petitionDesc.trim(),
        tmkClaimOptIn: tmkClaimOptIn || undefined,
      };
      if (backingMode === 'slots') {
        body.supporterSlots = slotsN;
      } else {
        body.maxUnitsPerWallet = maxUnitsN;
      }

      const data = await apiFetch('/api/petitions', {
        method: 'POST',
        wallet: address,
        body: JSON.stringify(body),
      });
      closeSearch();
      onCreated();
      router.push(data.petitionUrl || `/community/petition/${data.petition?.tmpPetitionId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create petition space');
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
                  Existing Bankr token or pre-launch petition
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

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMode('token')}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border ${
                  mode === 'token'
                    ? 'bg-accent text-white border-accent'
                    : 'border-border bg-surface-2'
                }`}
              >
                Existing token
              </button>
              <button
                type="button"
                onClick={() => setMode('petition')}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border ${
                  mode === 'petition'
                    ? 'bg-accent text-white border-accent'
                    : 'border-border bg-surface-2'
                }`}
              >
                Petition (pre-launch)
              </button>
            </div>

            {mode === 'petition' ? (
              <div className="space-y-3">
                <p className="text-[11px] text-muted leading-relaxed">
                  Start a community before the token exists. Backers pay ETH on this site; at 1,000
                  units Token Marketplace deploys the token and this space goes live automatically.
                </p>
                <input
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                  placeholder="Token name"
                  value={petitionName}
                  onChange={(e) => setPetitionName(e.target.value)}
                />
                <input
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm uppercase"
                  placeholder="Symbol (e.g. MAJOR)"
                  maxLength={10}
                  value={petitionSymbol}
                  onChange={(e) => setPetitionSymbol(e.target.value.replace(/^\$/, ''))}
                />
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm resize-y"
                  placeholder="What is this token about?"
                  value={petitionDesc}
                  onChange={(e) => setPetitionDesc(e.target.value)}
                />

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted">Backing layout</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBackingMode('slots')}
                      className={`flex-1 px-3 py-2 text-xs rounded-lg border ${
                        backingMode === 'slots'
                          ? 'bg-accent/15 border-accent text-accent'
                          : 'border-border bg-surface-2'
                      }`}
                    >
                      Equal slots
                    </button>
                    <button
                      type="button"
                      onClick={() => setBackingMode('maxUnits')}
                      className={`flex-1 px-3 py-2 text-xs rounded-lg border ${
                        backingMode === 'maxUnits'
                          ? 'bg-accent/15 border-accent text-accent'
                          : 'border-border bg-surface-2'
                      }`}
                    >
                      Max per wallet
                    </button>
                  </div>
                  {backingMode === 'slots' ? (
                    <label className="block text-xs text-muted">
                      Number of backers (slots)
                      <input
                        type="number"
                        min={1}
                        max={publicCap}
                        className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                        value={supporterSlots}
                        onChange={(e) => setSupporterSlots(e.target.value)}
                      />
                      <span className="block mt-1 text-[10px]">
                        {publicCap % slotsN === 0
                          ? `${slotsN} backers × ${unitsPerSlot} units each (${publicCap} total)`
                          : `${slotsN} slots — must divide ${publicCap} evenly (e.g. ${Math.floor(publicCap / 37)} × 37)`}
                      </span>
                    </label>
                  ) : (
                    <label className="block text-xs text-muted">
                      Max units per wallet (1–1000)
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                        value={maxUnits}
                        onChange={(e) => setMaxUnits(e.target.value)}
                      />
                      <span className="block mt-1 text-[10px]">
                        Up to {maxBackersFromUnits} wallet{maxBackersFromUnits === 1 ? '' : 's'} at max · use 1 for widest distribution
                      </span>
                    </label>
                  )}
                </div>

                {showTmkOption ? (
                  <label className="flex items-start gap-2 text-xs text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tmkClaimOptIn}
                      onChange={(e) => setTmkClaimOptIn(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Enable @TokenMkp fee claims via X — reserves{' '}
                      {petitionConfig?.tmkClaimReserveUnits ?? 1} unit for the marketplace (
                      {petitionConfig?.publicSaleUnitsWithTmkClaim ?? 999} public units). Holders
                      tweet to claim fees; TMK earns ~0.1% from that unit.
                    </span>
                  </label>
                ) : null}

                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void createPetitionSpace()}
                  className="w-full px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
                >
                  {creating
                    ? 'Creating petition…'
                    : isConnected
                      ? 'Start petition space'
                      : 'Connect to start'}
                </button>
              </div>
            ) : (
              <>
                <input
                  className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm mb-4"
                  placeholder="Token name, symbol, or contract address…"
                  value={query}
                  onChange={(e) => onSearch(e.target.value)}
                  autoFocus
                />

                {!query.trim() ? (
                  <p className="text-muted text-sm">
                    Find a Bankr token to start a space for it (new launches or legacy tokens like
                    BNKR).
                  </p>
                ) : loading ? (
                  <p className="text-muted text-sm">Searching Bankr tokens…</p>
                ) : results.length === 0 ? (
                  <p className="text-muted text-sm">
                    No Bankr tokens found for &quot;{query.trim()}&quot;. Try{' '}
                    <button
                      type="button"
                      className="text-accent-hover underline"
                      onClick={() => setMode('petition')}
                    >
                      Petition (pre-launch)
                    </button>{' '}
                    instead.
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
              </>
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
