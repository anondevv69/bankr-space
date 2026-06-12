'use client';

import { useEffect, useState } from 'react';
import { useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import type { Address, Hex } from 'viem';
import { useAppWallet } from '@/hooks/useAppWallet';
import { usePaymentWalletClient } from '@/hooks/usePaymentWalletClient';
import { createBrowserPaymentWalletClient } from '@/lib/x402-signer';
import { apiFetch } from '@/lib/wagmi';
import { shortAddr } from '@/lib/utils';

type PrepareResponse = {
  prepare: {
    deposit: { totalEth: string; units: number };
    nextStep: { to: string; value: string; data: string; chainId: string };
  };
};

export function PetitionBackPanel({
  petitionId,
  maxUnitsPerWallet,
  unitsPerBacker,
  priceEth,
  remainingUnits,
  remainingBackers,
  userOrderUnits,
  canRefund,
  disabled,
  slotSummary,
  onSuccess,
}: {
  petitionId: string;
  maxUnitsPerWallet: number;
  unitsPerBacker?: number;
  priceEth: string;
  remainingUnits?: number;
  remainingBackers?: number;
  userOrderUnits?: number;
  canRefund?: boolean;
  disabled?: boolean;
  slotSummary?: string;
  onSuccess?: () => void;
}) {
  const { address, connectWallet } = useAppWallet();
  const { isConnected, onBase } = usePaymentWalletClient();
  const { switchChain } = useSwitchChain();
  const defaultUnits = unitsPerBacker || maxUnitsPerWallet;
  const [units, setUnits] = useState(String(defaultUnits));
  const [busy, setBusy] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [quoteEth, setQuoteEth] = useState<string | null>(null);

  useEffect(() => {
    setUnits(String(defaultUnits));
  }, [defaultUnits]);

  async function loadQuote(nextUnits: number) {
    if (!address || nextUnits < 1) {
      setQuoteEth(null);
      return;
    }
    try {
      const data = (await apiFetch(`/api/petitions/${petitionId}`, {
        method: 'POST',
        wallet: address,
        body: JSON.stringify({
          action: 'prepare-deposit',
          units: nextUnits,
          launchBuyWei: '0',
        }),
      })) as PrepareResponse;
      setQuoteEth(data.prepare.deposit.totalEth);
    } catch {
      setQuoteEth(null);
    }
  }

  async function backPetition() {
    if (!address) {
      connectWallet();
      return;
    }
    const cap = Math.min(maxUnitsPerWallet, remainingUnits ?? maxUnitsPerWallet);
    const n = Math.max(1, Math.min(cap, Number(units) || defaultUnits));
    if (remainingUnits != null && n > remainingUnits) {
      setHint(`Only ${remainingUnits} units left.`);
      return;
    }

    setBusy('back');
    setHint(null);
    try {
      if (!onBase) {
        await switchChain({ chainId: base.id });
      }

      const data = (await apiFetch(`/api/petitions/${petitionId}`, {
        method: 'POST',
        wallet: address,
        body: JSON.stringify({
          action: 'prepare-deposit',
          units: n,
          launchBuyWei: '0',
        }),
      })) as PrepareResponse;

      const { nextStep } = data.prepare;
      const client = createBrowserPaymentWalletClient(address as Address);
      const hash = await client.sendTransaction({
        account: address as Address,
        chain: base,
        to: nextStep.to as Address,
        value: BigInt(nextStep.value),
        data: (nextStep.data || '0x') as Hex,
      });

      await apiFetch(`/api/petitions/${petitionId}`, {
        method: 'POST',
        wallet: address,
        body: JSON.stringify({
          action: 'confirm',
          units: n,
          signature: hash,
          launchBuyWei: '0',
        }),
      });

      setHint(`Backed with ${n} unit${n === 1 ? '' : 's'}. Tx: ${hash.slice(0, 10)}…`);
      onSuccess?.();
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setBusy(null);
    }
  }

  async function refundBacking() {
    if (!address) {
      connectWallet();
      return;
    }
    if (!window.confirm('Refund your petition backing? ETH returns to your wallet.')) return;
    setBusy('refund');
    setHint(null);
    try {
      await apiFetch(`/api/petitions/${petitionId}`, {
        method: 'POST',
        wallet: address,
        body: JSON.stringify({ action: 'refund', scope: 'units' }),
      });
      setHint('Refund submitted — units released.');
      onSuccess?.();
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Refund failed');
    } finally {
      setBusy(null);
    }
  }

  const cap = Math.min(
    maxUnitsPerWallet,
    remainingUnits != null ? remainingUnits : maxUnitsPerWallet
  );
  const hasBacking = (userOrderUnits ?? 0) > 0;
  const canAddMore = !hasBacking || (userOrderUnits ?? 0) < cap;

  return (
    <div className="p-4 rounded-xl border border-accent/30 bg-surface space-y-3">
      <div>
        <div className="text-sm font-semibold">Back this petition</div>
        <p className="text-[11px] text-muted mt-1 leading-relaxed">
          Each unit = {priceEth} ETH on Base. When the goal is reached, TMP deploys the token and
          airdrops fee-right units to backers.
        </p>
        {slotSummary ? (
          <p className="text-[11px] text-accent-hover mt-1">{slotSummary}</p>
        ) : null}
        {remainingBackers != null ? (
          <p className="text-[11px] text-muted mt-0.5">
            {remainingBackers} backer slot{remainingBackers === 1 ? '' : 's'} remaining
          </p>
        ) : null}
      </div>

      {hasBacking ? (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-surface-2 border border-border">
          <span className="text-xs text-muted">
            Your backing: <strong className="text-text">{userOrderUnits} units</strong>
            {address ? ` · ${shortAddr(address)}` : ''}
          </span>
          {canRefund ? (
            <button
              type="button"
              disabled={!!busy || disabled}
              onClick={() => void refundBacking()}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-red-500/50 text-red-500"
            >
              {busy === 'refund' ? 'Refunding…' : 'Back out / refund'}
            </button>
          ) : null}
        </div>
      ) : null}

      {!hasBacking || canAddMore ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">
            Units (max {hasBacking ? cap - (userOrderUnits ?? 0) : cap}/wallet)
            <input
              type="number"
              min={1}
              max={hasBacking ? cap - (userOrderUnits ?? 0) : cap}
              value={units}
              disabled={disabled || !!busy}
              onChange={(e) => {
                setUnits(e.target.value);
                void loadQuote(Math.min(cap, Math.max(1, Number(e.target.value) || 1)));
              }}
              className="mt-1 block w-24 px-3 py-2 bg-bg border border-border rounded-lg text-sm"
            />
          </label>
          {quoteEth ? (
            <span className="text-sm font-medium tabular-nums">{quoteEth} ETH total</span>
          ) : null}
          <button
            type="button"
            disabled={disabled || !!busy}
            onClick={() => void backPetition()}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50"
          >
            {busy === 'back' ? 'Confirm in wallet…' : isConnected ? 'Back with ETH' : 'Connect to back'}
          </button>
        </div>
      ) : null}

      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
