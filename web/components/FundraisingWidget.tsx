'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildSpaceFundUrl, campaignProgress } from '@/lib/fundraising';
import type { FundraisingCampaign } from '@/lib/types';

type FundraisingView = FundraisingCampaign & {
  progressPct: number;
  remainingUsd: number;
  funded: boolean;
};

const PRESET_AMOUNTS = [5, 25, 50];

export function FundraisingWidget({
  tokenAddress,
  symbol,
  refreshKey,
}: {
  tokenAddress: string;
  symbol: string;
  refreshKey?: string;
}) {
  const [campaigns, setCampaigns] = useState<FundraisingView[]>([]);
  const [x402BaseUrl, setX402BaseUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState('10');
  const [activeCampaignId, setActiveCampaignId] = useState<string>('dex-profile');
  const [payHint, setPayHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/communities/${tokenAddress}/fundraising`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setCampaigns(data.campaigns || []);
      setX402BaseUrl(data.x402BaseUrl || null);
      if (data.campaigns?.[0]?.id) {
        setActiveCampaignId(data.campaigns[0].id);
      }
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function openFund(amountUsd: number) {
    const campaignId = activeCampaignId;
    if (!x402BaseUrl) {
      setPayHint(
        `x402 payments are not configured yet. Ask the space operator to set NEXT_PUBLIC_X402_SPACE_FUND_URL, or tip via @bankrbot: fund $${amountUsd} to ${symbol} space for Dex.`
      );
      return;
    }

    const url = buildSpaceFundUrl(x402BaseUrl, tokenAddress, campaignId, amountUsd);
    setPayHint(
      `Opening x402 checkout for $${amountUsd} USDC. After payment, refresh this page to see updated progress.`
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (loading) {
    return (
      <div className="p-5 rounded-xl border border-border bg-surface text-sm text-muted">
        Loading fund…
      </div>
    );
  }

  if (!campaigns.length) {
    return null;
  }

  const active =
    campaigns.find((c) => c.id === activeCampaignId) || campaigns[0];

  return (
    <div className="p-5 rounded-xl border border-border bg-surface space-y-4">
      <div>
        <div className="text-sm font-semibold">Fund this space</div>
        <p className="text-xs text-muted mt-1">
          Optional USDC contributions toward DexScreener or community goals. Posts stay free.
        </p>
      </div>

      {campaigns.length > 1 ? (
        <div className="flex flex-wrap gap-1 p-1 bg-surface-2 border border-border rounded-lg">
          {campaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCampaignId(c.id)}
              className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                active.id === c.id
                  ? 'bg-surface border border-border text-text'
                  : 'text-muted hover:text-text'
              }`}
            >
              {c.id === 'dex-profile' ? 'Dex profile' : c.id === 'dex-boost' ? 'Dex boost' : 'Custom'}
            </button>
          ))}
        </div>
      ) : null}

      <div>
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <div className="text-sm font-medium">{active.label}</div>
          <div className="text-xs text-muted tabular-nums">
            ${active.raisedUsd.toLocaleString()} / ${active.goalUsd.toLocaleString()}
          </div>
        </div>
        <div className="h-2 rounded-full bg-surface-2 border border-border overflow-hidden">
          <div
            className={`h-full transition-all ${active.funded ? 'bg-green-500' : 'bg-accent'}`}
            style={{ width: `${campaignProgress(active)}%` }}
          />
        </div>
        {active.funded ? (
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">Goal reached — thank you!</p>
        ) : (
          <p className="text-xs text-muted mt-2">
            ${active.remainingUsd.toLocaleString()} remaining
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESET_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => openFund(amount)}
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-accent bg-surface-2"
          >
            ${amount}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          step={1}
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm"
          placeholder="Custom USD"
        />
        <button
          type="button"
          onClick={() => openFund(Math.max(1, Number(customAmount) || 1))}
          className="px-3 py-2 text-xs font-medium bg-accent text-white rounded-lg"
        >
          Contribute
        </button>
      </div>

      {payHint ? (
        <p className="text-xs text-muted border-t border-border pt-3">{payHint}</p>
      ) : null}

      <p className="text-[11px] text-muted leading-snug">
        Pays in USDC on Base via{' '}
        <a
          href="https://docs.bankr.bot/x402-cloud/overview/"
          target="_blank"
          rel="noreferrer"
          className="text-accent-hover hover:underline"
        >
          Bankr x402
        </a>
        . Funds go to the token fee beneficiary for Dex submission or the stated goal.
      </p>
    </div>
  );
}
