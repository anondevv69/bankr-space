'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { useAppWallet } from '@/hooks/useAppWallet';
import { usePaymentWalletClient } from '@/hooks/usePaymentWalletClient';
import { payRaffleFund } from '@/lib/x402-pay';
import { SPACE_FUND_X402_CREDIT_USD } from '@/lib/x402-config';
import { apiFetch } from '@/lib/wagmi';
import { formatTime } from '@/lib/utils';
import { communityRaffleUrl } from '@/lib/site-url';
import type { RaffleEntryRule, RaffleStatus } from '@/lib/types';

type RaffleView = {
  id: string;
  title: string;
  prizeLabel: string;
  prizeUsd: number;
  goalUsd: number;
  raisedUsd: number;
  entryRule: RaffleEntryRule;
  durationHours: number;
  startsAt: number | null;
  endsAt: number | null;
  status: RaffleStatus;
  entryCount: number;
  totalTickets: number;
  funded: boolean;
  open: boolean;
  entered: boolean;
  winnerWallet: string | null;
  fulfillmentNote: string | null;
  shareUrl?: string;
};

const FUND_PRESETS = [5, 10, 25, 50];

function timeLeft(endsAt: number | null): string {
  if (!endsAt) return '';
  const ms = Math.max(0, endsAt - Date.now());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return 'Ending soon';
}

function statusLabel(raffle: RaffleView): string {
  if (raffle.status === 'pending') return 'Awaiting prize funding';
  if (raffle.open) return timeLeft(raffle.endsAt);
  if (raffle.status === 'open') return 'Closed';
  if (raffle.status === 'completed') return 'Winner drawn — fulfilling via Bitrefill';
  if (raffle.status === 'fulfilled') return 'Prize delivered';
  if (raffle.status === 'failed') return 'Ended — see note';
  return raffle.status;
}

function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export function RafflesPanel({
  tokenAddress,
  symbol,
  canManage,
  canEnter,
  voteUsesUnits,
  highlightRaffleId,
}: {
  tokenAddress: string;
  symbol: string;
  canManage: boolean;
  canEnter: boolean;
  voteUsesUnits?: boolean;
  highlightRaffleId?: string | null;
}) {
  const { isEmbedded, connectWallet } = useAppWallet();
  const { address, isConnected, onBase } = usePaymentWalletClient();
  const { switchChain } = useSwitchChain();
  const [raffles, setRaffles] = useState<RaffleView[]>([]);
  const [loading, setLoading] = useState(true);
  const [hint, setHint] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [prizeLabel, setPrizeLabel] = useState('Amazon $25');
  const [productHint, setProductHint] = useState('amazon united states 25');
  const [prizeUsd, setPrizeUsd] = useState('25');
  const [durationHours, setDurationHours] = useState('72');
  const [entryRule, setEntryRule] = useState<RaffleEntryRule>('one_per_wallet');
  const [lastShareUrl, setLastShareUrl] = useState<string | null>(null);

  const raffleShareUrl = useCallback(
    (raffle: RaffleView) =>
      raffle.shareUrl || communityRaffleUrl(tokenAddress, raffle.id),
    [tokenAddress]
  );

  async function copyShareLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setHint('Share link copied — send holders this URL to enter.');
    } catch {
      setHint(url);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = address ? `?wallet=${encodeURIComponent(address)}` : '';
      const res = await fetch(`/api/communities/${tokenAddress}/raffles${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setRaffles(data.raffles || []);
    } catch {
      setRaffles([]);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress, address]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!highlightRaffleId || loading) return;
    const el = document.getElementById(`raffle-${highlightRaffleId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightRaffleId, loading, raffles]);

  async function createRaffle() {
    if (!address) return;
    setCreating(true);
    setHint(null);
    try {
      const data = await apiFetch(`/api/communities/${tokenAddress}/raffles`, {
        method: 'POST',
        wallet: address,
        body: JSON.stringify({
          title: prizeLabel.trim(),
          prizeLabel: prizeLabel.trim(),
          productHint: productHint.trim(),
          prizeUsd: Number(prizeUsd),
          durationHours: Number(durationHours),
          entryRule,
          country: 'US',
        }),
      });
      const shareUrl =
        (data.raffle?.shareUrl as string | undefined) ||
        communityRaffleUrl(tokenAddress, String(data.raffle?.id || ''));
      setLastShareUrl(shareUrl);
      setShowCreate(false);
      setHint(
        'Raffle created — fund the full prize pool, then share the link with holders.'
      );
      await load();
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  async function fundRaffle(raffleId: string, amountUsd: number) {
    if (!address) {
      if (isEmbedded) await connectWallet();
      return;
    }
    if (!onBase) {
      await switchChain({ chainId: base.id });
    }
    setPayingId(raffleId);
    setHint(null);
    try {
      const result = await payRaffleFund(
        address,
        tokenAddress,
        raffleId,
        amountUsd,
        (msg) => setHint(msg)
      );
      setHint(
        result.message ||
          `Credited $${SPACE_FUND_X402_CREDIT_USD} toward prize pool.`
      );
      await load();
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPayingId(null);
    }
  }

  async function enterRaffle(raffleId: string) {
    if (!address) {
      if (isEmbedded) await connectWallet();
      return;
    }
    setEnteringId(raffleId);
    setHint(null);
    try {
      const data = await apiFetch(`/api/communities/${tokenAddress}/raffles/${raffleId}/enter`, {
        method: 'POST',
        wallet: address,
      });
      setHint(`Entered with ${data.tickets} ticket${data.tickets === 1 ? '' : 's'}. Good luck!`);
      await load();
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Entry failed');
    } finally {
      setEnteringId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-lg font-semibold mb-1">Gift card raffles</h3>
        <p className="text-sm text-muted mb-3">
          <strong className="text-text">Fee recipient only:</strong> fund the full prize pool via
          x402 ($Space) before entries open. Holders can enter after funding. At close, the Bankr
          agent buys the gift card through{' '}
          <a
            href="https://www.bitrefill.com/agents"
            className="text-accent-hover hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bitrefill
          </a>{' '}
          — codes are delivered privately, never on the feed.
        </p>
        {canManage ? (
          <p className="text-xs text-muted mb-3">
            Connect with your fee recipient wallet to create and pay for raffles.
          </p>
        ) : null}
        {canManage ? (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="px-3 py-2 text-sm font-medium bg-accent text-white rounded-lg"
          >
            {showCreate ? 'Cancel' : 'New raffle'}
          </button>
        ) : null}
      </div>

      {showCreate && canManage ? (
        <div className="rounded-xl border border-border bg-surface-2 p-4 space-y-3">
          <label className="block text-sm">
            <span className="text-muted">Prize label</span>
            <input
              className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
              value={prizeLabel}
              onChange={(e) => setPrizeLabel(e.target.value)}
              placeholder="Amazon $25"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Bitrefill search hint</span>
            <input
              className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
              value={productHint}
              onChange={(e) => setProductHint(e.target.value)}
              placeholder="amazon united states 25"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-muted">Prize value (USD)</span>
              <input
                type="number"
                min={5}
                max={500}
                className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                value={prizeUsd}
                onChange={(e) => setPrizeUsd(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted">Duration (hours)</span>
              <input
                type="number"
                min={1}
                max={672}
                className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-muted">Entry rule</span>
            <select
              className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
              value={entryRule}
              onChange={(e) => setEntryRule(e.target.value as RaffleEntryRule)}
            >
              <option value="one_per_wallet">1 entry per wallet</option>
              <option value="one_per_unit">
                {voteUsesUnits ? '1 ticket per TMP unit' : '1 ticket per unit (petition/cap table)'}
              </option>
            </select>
          </label>
          <button
            type="button"
            disabled={creating}
            onClick={() => void createRaffle()}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create raffle'}
          </button>
        </div>
      ) : null}

      {lastShareUrl ? (
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-3 space-y-2">
          <p className="text-sm font-medium">Share this raffle</p>
          <p className="text-xs text-muted break-all">{lastShareUrl}</p>
          <button
            type="button"
            onClick={() => void copyShareLink(lastShareUrl)}
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-accent"
          >
            Copy link
          </button>
        </div>
      ) : null}

      {hint ? (
        <p className="text-sm text-muted border border-border rounded-lg px-3 py-2 bg-surface-2">
          {hint}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading raffles…</p>
      ) : raffles.length === 0 ? (
        <p className="text-sm text-muted">No raffles yet.</p>
      ) : (
        <div className="space-y-3">
          {raffles.map((raffle) => {
            const progress =
              raffle.goalUsd > 0
                ? Math.min(100, (raffle.raisedUsd / raffle.goalUsd) * 100)
                : 0;
            const highlighted =
              highlightRaffleId != null &&
              highlightRaffleId.toLowerCase().replace(/_/g, '-') ===
                raffle.id.toLowerCase().replace(/_/g, '-');
            return (
              <article
                key={raffle.id}
                id={`raffle-${raffle.id}`}
                className={`rounded-xl border bg-surface p-4 space-y-3 ${
                  highlighted ? 'border-accent ring-2 ring-accent/30' : 'border-border'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold">{raffle.title}</h4>
                    <p className="text-sm text-muted">
                      ${raffle.prizeUsd} prize · {statusLabel(raffle)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyShareLink(raffleShareUrl(raffle))}
                      className="text-xs px-2 py-1 border border-border rounded-lg hover:border-accent text-muted hover:text-text"
                    >
                      Copy link
                    </button>
                    <span className="text-xs px-2 py-1 rounded-full bg-surface-2 border border-border text-muted">
                      {raffle.entryRule === 'one_per_unit' ? 'Per unit' : 'Per wallet'}
                    </span>
                  </div>
                </div>

                {raffle.status === 'pending' ? (
                  <div>
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>Prize pool (fee recipient)</span>
                      <span>
                        ${raffle.raisedUsd.toFixed(0)} / ${raffle.goalUsd.toFixed(0)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {canManage ? (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(() => {
                          const remaining = Math.max(
                            0,
                            Math.ceil((raffle.goalUsd - raffle.raisedUsd) * 100) / 100
                          );
                          return remaining > 0 ? (
                            <button
                              type="button"
                              disabled={!isConnected || payingId === raffle.id}
                              onClick={() => void fundRaffle(raffle.id, remaining)}
                              className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg disabled:opacity-50"
                            >
                              {payingId === raffle.id
                                ? 'Paying…'
                                : `Fund remaining $${remaining.toFixed(0)}`}
                            </button>
                          ) : null;
                        })()}
                        {FUND_PRESETS.filter((n) => n <= raffle.goalUsd).map((n) => (
                          <button
                            key={n}
                            type="button"
                            disabled={!isConnected || payingId === raffle.id}
                            onClick={() => void fundRaffle(raffle.id, n)}
                            className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-accent disabled:opacity-50"
                          >
                            +${n}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted mt-2">
                        Waiting for the fee recipient to fund the prize pool before entries open.
                      </p>
                    )}
                  </div>
                ) : null}

                {raffle.open ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted">
                      {raffle.entryCount} wallets · {raffle.totalTickets} tickets
                      {raffle.endsAt ? ` · ends ${formatTime(raffle.endsAt)}` : ''}
                    </p>
                    {canEnter && !raffle.entered ? (
                      <button
                        type="button"
                        disabled={enteringId === raffle.id}
                        onClick={() => void enterRaffle(raffle.id)}
                        className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
                      >
                        {enteringId === raffle.id ? 'Entering…' : 'Enter raffle'}
                      </button>
                    ) : raffle.entered ? (
                      <span className="text-sm text-green-600 dark:text-green-400">
                        ✓ You&apos;re in
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {raffle.winnerWallet ? (
                  <p className="text-sm">
                    Winner:{' '}
                    <span className="font-mono">{shortWallet(raffle.winnerWallet)}</span>
                  </p>
                ) : null}

                {raffle.fulfillmentNote ? (
                  <p className="text-xs text-muted">{raffle.fulfillmentNote}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
