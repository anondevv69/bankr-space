'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { campaignProgress } from '@/lib/fundraising';
import { paySpaceFund, setupPermit2ForSpace } from '@/lib/x402-pay';
import { readPermit2TokenAllowance } from '@/lib/x402-permit2-allowance';
import { SPACE_FUND_X402_CREDIT_USD, X402_PAYMENT_TOKEN_SYMBOL } from '@/lib/x402-config';
import { NATIVE_SPACE_TOKEN_ADDRESS } from '@/lib/featured-community';
import { formatX402FundPriceLabel, X402_FUND_MAX_AUTHORIZE_ATOMIC } from '@/lib/space-x402-price';
import { useAppWallet } from '@/hooks/useAppWallet';
import { usePaymentWalletClient } from '@/hooks/usePaymentWalletClient';
import type { FundraisingCampaign } from '@/lib/types';

type FundraisingView = FundraisingCampaign & {
  progressPct: number;
  remainingUsd: number;
  funded: boolean;
};

/** Number of x402 payments per preset (each credits $1 toward USD goal). */
const PRESET_PAYMENTS = [1, 5, 10];

export function FundraisingWidget({
  tokenAddress,
  symbol,
  refreshKey,
  layout = 'horizontal',
  showHeader = true,
}: {
  tokenAddress: string;
  symbol: string;
  refreshKey?: string;
  layout?: 'horizontal' | 'sidebar';
  /** When false, omit duplicate "Fund this space" heading (e.g. inside Fundraisers tab). */
  showHeader?: boolean;
}) {
  const { isEmbedded, connectWallet } = useAppWallet();
  const { address, isConnected, onBase } = usePaymentWalletClient();
  const { switchChain } = useSwitchChain();
  const [campaigns, setCampaigns] = useState<FundraisingView[]>([]);
  const [x402BaseUrl, setX402BaseUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState('10');
  const [activeCampaignId, setActiveCampaignId] = useState<string>('dex-profile');
  const [payHint, setPayHint] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [settingUpPermit2, setSettingUpPermit2] = useState(false);
  const [permit2Ready, setPermit2Ready] = useState<boolean | null>(null);
  const [spacePriceUsd, setSpacePriceUsd] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/communities/${tokenAddress}/fundraising`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const open = (data.open || data.campaigns || []).filter(
        (c: FundraisingView) => !c.funded
      );
      setCampaigns(open);
      setX402BaseUrl(data.x402BaseUrl || null);
      if (open[0]?.id) {
        setActiveCampaignId(open[0].id);
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/market/${NATIVE_SPACE_TOKEN_ADDRESS}`);
        const data = await res.json();
        if (!cancelled && res.ok && data.market?.priceUsd > 0) {
          setSpacePriceUsd(Number(data.market.priceUsd));
        }
      } catch {
        /* optional display hint */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!address || !onBase) {
      setPermit2Ready(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const allowance = await readPermit2TokenAllowance(
          address,
          NATIVE_SPACE_TOKEN_ADDRESS as `0x${string}`
        );
        if (!cancelled) {
          setPermit2Ready(allowance >= X402_FUND_MAX_AUTHORIZE_ATOMIC);
        }
      } catch {
        if (!cancelled) setPermit2Ready(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, onBase, refreshKey]);

  async function setupPermit2() {
    if (!address || !onBase) return;
    setSettingUpPermit2(true);
    setPayHint('Step 1 — confirm the MetaMask transaction to approve $Space for Permit2 (one-time).');
    try {
      const result = await setupPermit2ForSpace(address, setPayHint);
      setPermit2Ready(true);
      setPayHint(
        result === 'approved'
          ? 'Permit2 is set up — you can Contribute now (Step 2 is a wallet signature only).'
          : 'Permit2 was already approved — click Contribute to pay.'
      );
    } catch (err) {
      setPayHint(err instanceof Error ? err.message : 'Permit2 setup failed.');
    } finally {
      setSettingUpPermit2(false);
    }
  }

  async function contribute(paymentCount: number) {
    if (paying || settingUpPermit2) return;

    const campaignId = activeCampaignId;
    const count = Math.max(1, Math.min(10, Math.round(paymentCount)));
    if (!x402BaseUrl) {
      setPayHint(
        `x402 payments are not configured yet. Ask the operator to set NEXT_PUBLIC_X402_FUND_URL and deploy the shared fund endpoint on Bankr x402.`
      );
      return;
    }

    if (isEmbedded) {
      setPayHint(
        `In the Bankr app, pay via @bankrbot: fund $${count} to ${symbol} space for Dex. On bankr.space, connect a Base wallet with $${X402_PAYMENT_TOKEN_SYMBOL} and try again.`
      );
      return;
    }

    if (!isConnected) {
      setPayHint(`Connect a Base wallet with $${X402_PAYMENT_TOKEN_SYMBOL} to pay.`);
      connectWallet();
      return;
    }

    if (!onBase) {
      setPayHint('Switch your wallet to Base network, then try Contribute again.');
      switchChain({ chainId: base.id });
      return;
    }

    if (!address) {
      setPayHint(`Connect a Base wallet with $${X402_PAYMENT_TOKEN_SYMBOL} to pay.`);
      connectWallet();
      return;
    }

    setPaying(true);
    const priceLabel = formatX402FundPriceLabel(spacePriceUsd);
    setPayHint(
      permit2Ready
        ? count > 1
          ? `Step 2 — sign ${count} payments in MetaMask (${priceLabel} each, within 60 seconds per signature).`
          : `Step 2 — sign the payment in MetaMask (${priceLabel}, within 60 seconds).`
        : 'Checking Permit2 setup…'
    );

    try {
      let last: Awaited<ReturnType<typeof paySpaceFund>> | null = null;
      for (let i = 0; i < count; i++) {
        if (count > 1) {
          setPayHint(`Payment ${i + 1} of ${count} — ${priceLabel}…`);
        }
        last = await paySpaceFund(
          address,
          tokenAddress,
          campaignId,
          SPACE_FUND_X402_CREDIT_USD,
          setPayHint
        );
        if (!last.success) {
          setPayHint(last.error || `Payment ${i + 1} did not complete.`);
          break;
        }
      }

      if (last?.success) {
        setPermit2Ready(true);
        const totalUsd = count * SPACE_FUND_X402_CREDIT_USD;
        setPayHint(
          last.message ||
            `Thank you — $${totalUsd} credited toward the goal (${count}× ${priceLabel}). Progress: $${last.raisedUsd ?? '?'} / $${last.goalUsd ?? '?'}.`
        );
        await load();
      }
    } catch (err) {
      setPayHint(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div
        className={`p-5 rounded-xl border border-border bg-surface text-sm text-muted ${
          layout === 'horizontal' ? 'mt-4' : ''
        }`}
      >
        Loading fund…
      </div>
    );
  }

  if (!campaigns.length) {
    return null;
  }

  const active =
    campaigns.find((c) => c.id === activeCampaignId) || campaigns[0];

  const campaignTabs =
    campaigns.length > 1 ? (
      <div className="flex flex-wrap gap-1">
        {campaigns.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCampaignId(c.id)}
            className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
              active.id === c.id
                ? 'bg-surface-2 border border-border text-text'
                : 'text-muted hover:text-text'
            }`}
          >
            {c.label || 'Fundraiser'}
          </button>
        ))}
      </div>
    ) : null;

  const progressBlock = (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div className="text-sm font-medium truncate">{active.label}</div>
        <div className="text-xs text-muted tabular-nums shrink-0">
          ${active.raisedUsd.toLocaleString()} / ${active.goalUsd.toLocaleString()}
        </div>
      </div>
      <div className="h-2 rounded-full bg-surface-2 border border-border overflow-hidden">
        <div
          className={`h-full transition-all ${active.funded ? 'bg-green-500' : 'bg-accent'}`}
          style={{ width: `${campaignProgress(active)}%` }}
        />
      </div>
      <p className="text-[11px] text-muted mt-1">
        {active.funded ? (
          <span className="text-green-600 dark:text-green-400">Goal reached — thank you!</span>
        ) : (
          <>${active.remainingUsd.toLocaleString()} remaining</>
        )}
      </p>
    </div>
  );

  const permit2Banner =
    isConnected && onBase && permit2Ready === false ? (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-text">
        <p className="font-medium">One-time setup required</p>
        <p className="text-muted mt-0.5">
          Before your first contribution, approve {X402_PAYMENT_TOKEN_SYMBOL} for Permit2 on Base
          (costs a little ETH for gas). After that, Contribute only asks for a signature.
        </p>
        <button
          type="button"
          disabled={settingUpPermit2 || paying}
          onClick={() => void setupPermit2()}
          className="mt-2 px-3 py-1.5 text-xs font-medium border border-amber-500/50 rounded-lg hover:bg-amber-500/15 disabled:opacity-50"
        >
          {settingUpPermit2 ? 'Setting up…' : 'Setup Permit2'}
        </button>
      </div>
    ) : null;

  const controlsBlock = (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      {PRESET_PAYMENTS.map((count) => (
        <button
          key={count}
          type="button"
          disabled={paying}
          onClick={() => void contribute(count)}
          className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-accent bg-surface-2 disabled:opacity-50"
          title={`${count}× ${formatX402FundPriceLabel(spacePriceUsd)} via x402`}
        >
          +${count * SPACE_FUND_X402_CREDIT_USD}
        </button>
      ))}
      <input
        type="number"
        min={1}
        step={1}
        value={customAmount}
        disabled={paying}
        onChange={(e) => setCustomAmount(e.target.value)}
        className="w-16 px-2 py-1.5 bg-bg border border-border rounded-lg text-sm disabled:opacity-50"
        placeholder="#"
        aria-label="Number of $1 x402 payments (max 10)"
      />
      <button
        type="button"
        disabled={paying}
        onClick={() => void contribute(Math.max(1, Math.min(10, Number(customAmount) || 1)))}
        className="px-4 py-1.5 text-xs font-medium bg-accent text-white rounded-lg disabled:opacity-50 whitespace-nowrap"
      >
        {paying ? 'Paying…' : 'Contribute'}
      </button>
    </div>
  );

  if (layout === 'sidebar') {
    return (
      <div className="p-5 rounded-xl border border-border bg-surface space-y-4">
        <div>
          <div className="text-sm font-semibold">Fund this space</div>
          <p className="text-xs text-muted mt-1">
            Optional ${X402_PAYMENT_TOKEN_SYMBOL} toward DexScreener or community goals.
          </p>
        </div>
        {campaignTabs}
        {permit2Banner}
        {progressBlock}
        {controlsBlock}
        {payHint ? (
          <p className="text-xs text-muted border-t border-border pt-3">{payHint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${showHeader ? 'mt-4 ' : ''}p-4 md:p-5 rounded-xl border border-border bg-surface`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-6">
        {showHeader ? (
          <div className="shrink-0 xl:w-[168px]">
            <div className="text-sm font-semibold">Fund this space</div>
            <p className="text-[11px] text-muted mt-0.5 leading-snug">
              ${X402_PAYMENT_TOKEN_SYMBOL} on Base · posts stay free
            </p>
            {campaignTabs ? <div className="mt-2">{campaignTabs}</div> : null}
          </div>
        ) : campaignTabs ? (
          <div className="shrink-0">{campaignTabs}</div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-3">
          {permit2Banner}
          {progressBlock}
        </div>

        {controlsBlock}
      </div>

      {payHint ? (
        <p className="text-xs text-muted border-t border-border mt-4 pt-3">{payHint}</p>
      ) : (
        <p className="text-[11px] text-muted mt-3 xl:mt-2 leading-snug">
          {formatX402FundPriceLabel(spacePriceUsd)} per click via{' '}
          <a
            href="https://docs.bankr.bot/x402-cloud/overview/"
            target="_blank"
            rel="noreferrer"
            className="text-accent-hover hover:underline"
          >
            Bankr x402
          </a>
          . Each successful click adds ${SPACE_FUND_X402_CREDIT_USD} toward the USD goal.
        </p>
      )}
    </div>
  );
}
