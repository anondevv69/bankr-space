'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import type { Address } from 'viem';
import { useAppWallet } from '@/hooks/useAppWallet';
import { usePaymentWalletClient } from '@/hooks/usePaymentWalletClient';
import { createBrowserPaymentWalletClient } from '@/lib/x402-signer';
import { apiFetch } from '@/lib/wagmi';
import {
  participantStake,
  poidhCreateClaim,
  poidhJoinBounty,
  poidhResolveVote,
  poidhVoteClaim,
  poidhWithdraw,
  type PoidhBountyDetail,
} from '@/lib/poidh-contract';
import { isValidProofUrl } from '@/lib/poidh-open-bounty';
import { formatEthAmount, formatEthFromWei } from '@/lib/poidh-format';

function parseDetailFromApi(raw: Record<string, unknown>): PoidhBountyDetail {
  return {
    id: Number(raw.id),
    issuer: String(raw.issuer),
    name: String(raw.name || ''),
    description: String(raw.description || ''),
    amountWei: BigInt(String(raw.amountWei)),
    amountEth: String(raw.amountEth),
    active: Boolean(raw.active),
    votingClaimId: Number(raw.votingClaimId),
    voteYes: BigInt(String(raw.voteYes)),
    voteNo: BigInt(String(raw.voteNo)),
    voteDeadline: Number(raw.voteDeadline),
    voteActive: Boolean(raw.voteActive),
    voteEnded: Boolean(raw.voteEnded),
    participants: Array.isArray(raw.participants)
      ? raw.participants.map((p) => {
          const row = p as Record<string, unknown>;
          return {
            address: String(row.address),
            amountWei: BigInt(String(row.amountWei)),
            amountEth: String(row.amountEth),
          };
        })
      : [],
    claims: Array.isArray(raw.claims)
      ? raw.claims.map((c) => {
          const row = c as Record<string, unknown>;
          return {
            id: Number(row.id),
            issuer: String(row.issuer),
            name: String(row.name || ''),
            description: String(row.description || ''),
            createdAt: Number(row.createdAt),
            accepted: Boolean(row.accepted),
          };
        })
      : [],
    minContributionWei: BigInt(String(raw.minContributionWei)),
    minContributionEth: String(raw.minContributionEth),
    needsContributorVote: Boolean(raw.needsContributorVote),
  };
}

function formatEthDisplay(eth: string): string {
  const n = Number(eth);
  if (!Number.isFinite(n)) return eth;
  return formatEthAmount(n);
}

function voteTimeLeft(deadlineSec: number): string {
  const left = deadlineSec - Math.floor(Date.now() / 1000);
  if (left <= 0) return 'ended';
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export function PoidhBountyActions({
  tokenAddress,
  symbol,
  poidhBountyId,
  poolAmountWei,
  onChainActive,
  showFundForm = false,
  showClaimForm = false,
  compact = false,
  onAction,
}: {
  tokenAddress: string;
  symbol: string;
  poidhBountyId: number;
  poolAmountWei?: string | null;
  onChainActive?: boolean | null;
  showFundForm?: boolean;
  showClaimForm?: boolean;
  compact?: boolean;
  onAction?: () => void;
}) {
  const { address, isEmbedded, connectWallet } = useAppWallet();
  const { isConnected, onBase } = usePaymentWalletClient();
  const { switchChain } = useSwitchChain();

  const [detail, setDetail] = useState<PoidhBountyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fundEth, setFundEth] = useState('0.01');
  const [claimName, setClaimName] = useState('');
  const [claimDesc, setClaimDesc] = useState('');
  const [claimUri, setClaimUri] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pendingWithdraw, setPendingWithdraw] = useState<string | null>(null);

  const communityBase = `https://www.bankr.space/community/${tokenAddress.toLowerCase()}`;

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const qs = address ? `?wallet=${encodeURIComponent(address)}` : '';
      const res = await fetch(
        `/api/communities/${tokenAddress}/poidh/${poidhBountyId}${qs}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load bounty');
      setDetail(parseDetailFromApi(data.detail as Record<string, unknown>));
      if (data.pendingWithdrawWei) {
        setPendingWithdraw(formatEthDisplay(String(Number(data.pendingWithdrawWei) / 1e18)));
      } else {
        setPendingWithdraw(null);
      }
    } catch {
      setDetail(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [poidhBountyId, address, tokenAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (detail?.minContributionEth) {
      setFundEth(detail.minContributionEth);
    }
  }, [detail?.minContributionEth]);

  useEffect(() => {
    if (!detail?.voteActive) return;
    const id = window.setInterval(() => void load(), 25_000);
    return () => window.clearInterval(id);
  }, [detail?.voteActive, load]);

  function formatVoteWeight(wei: bigint): string {
    return formatEthAmount(Number(wei) / 1e18);
  }

  function parseTxError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (/simulation_reverted|tx\.origin|smart wallet|signer rejected/i.test(msg)) {
      return 'Use MetaMask or Rabby directly on Base — POIDH requires an EOA wallet (not Bankr embed / smart wallet).';
    }
    if (/insufficient funds/i.test(msg)) {
      return 'Insufficient ETH on Base for this transaction.';
    }
    return msg.length > 220 ? `${msg.slice(0, 217)}…` : msg;
  }

  function ensureWallet(): Address | null {
    if (!address) {
      connectWallet();
      return null;
    }
    if (!isConnected && !isEmbedded) {
      setHint('Connect your wallet first.');
      return null;
    }
    if (!onBase) {
      setHint('Switch to Base network, then try again.');
      switchChain({ chainId: base.id });
      return null;
    }
    if (isEmbedded) {
      setHint('POIDH requires an EOA wallet (MetaMask or Rabby). Open bankr.space in a browser wallet.');
      return null;
    }
    return address as Address;
  }

  async function runTx(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setHint(`Confirm ${label.toLowerCase()} in your wallet…`);
    try {
      await fn();
      setHint(`${label} confirmed.`);
      await load();
      onAction?.();
    } catch (err) {
      setHint(parseTxError(err));
    } finally {
      setBusy(null);
    }
  }

  async function addFunds() {
    const acct = ensureWallet();
    if (!acct) return;
    const min = Number(detail?.minContributionEth ?? '0.00001');
    const amt = Number(fundEth);
    if (!Number.isFinite(amt) || amt < min) {
      setHint(`Minimum contribution is ${detail?.minContributionEth ?? '0.00001'} ETH.`);
      return;
    }
    const wallet = createBrowserPaymentWalletClient(acct);
    await runTx('Add funds', () => poidhJoinBounty(wallet, acct, poidhBountyId, fundEth));
  }

  async function submitClaim() {
    const acct = ensureWallet();
    if (!acct) return;
    const name = claimName.trim();
    const description = claimDesc.trim();
    const uri = claimUri.trim();
    if (!name || !description || !uri) {
      setHint('Claim name, description, and proof URL required.');
      return;
    }
    if (!isValidProofUrl(uri)) {
      setHint('Proof must be a full URL (https://…) — tweet, image link, etc.');
      return;
    }
    const wallet = createBrowserPaymentWalletClient(acct);
    await runTx('Submit claim', () =>
      poidhCreateClaim(wallet, acct, {
        bountyId: poidhBountyId,
        name,
        description,
        proofUri: uri,
      })
    );
    setClaimName('');
    setClaimDesc('');
    setClaimUri('');
  }

  async function finalizeClaim(claimId: number) {
    if (!address) {
      connectWallet();
      return;
    }
    const needsVote = detail?.needsContributorVote ?? false;
    const busyLabel = needsVote ? 'Request vote' : 'Accept claim';
    setBusy(busyLabel);
    setHint(
      needsVote
        ? 'Starting 48h contributor vote…'
        : 'Accepting claim and paying out…'
    );
    try {
      const data = await apiFetch(`/api/communities/${tokenAddress}/poidh/propose`, {
        method: 'POST',
        wallet: address,
        client: isEmbedded ? 'bankr-app' : 'web',
        body: JSON.stringify({ bountyId: poidhBountyId, claimId }),
      });
      setHint(
        data.message ||
          (needsVote ? 'Vote started — refresh to see voting status.' : 'Claim accepted — refresh to withdraw if needed.')
      );
      window.setTimeout(() => void load(), 15_000);
      onAction?.();
    } catch (err) {
      setHint(
        err instanceof Error
          ? err.message
          : needsVote
            ? 'Could not request vote'
            : 'Could not accept claim'
      );
    } finally {
      setBusy(null);
    }
  }

  async function vote(yes: boolean) {
    const acct = ensureWallet();
    if (!acct) return;
    const wallet = createBrowserPaymentWalletClient(acct);
    await runTx(yes ? 'Yes vote' : 'No vote', () =>
      poidhVoteClaim(wallet, acct, poidhBountyId, yes)
    );
  }

  async function resolve() {
    const acct = ensureWallet();
    if (!acct) return;
    const wallet = createBrowserPaymentWalletClient(acct);
    await runTx('Resolve vote', () => poidhResolveVote(wallet, acct, poidhBountyId));
  }

  async function withdraw() {
    const acct = ensureWallet();
    if (!acct) return;
    const wallet = createBrowserPaymentWalletClient(acct);
    await runTx('Withdraw', () => poidhWithdraw(wallet, acct));
  }

  if (loading) {
    return <p className="text-[11px] text-muted">Loading on-chain bounty…</p>;
  }

  const fallbackDetail: PoidhBountyDetail = {
    id: poidhBountyId,
    issuer: '',
    name: '',
    description: '',
    amountWei: poolAmountWei ? BigInt(poolAmountWei) : 1000000000000000n,
    amountEth: poolAmountWei
      ? formatEthFromWei(poolAmountWei)?.replace(' ETH', '') ?? '0.001'
      : '0.001',
    active: onChainActive !== false,
    votingClaimId: 0,
    voteYes: 0n,
    voteNo: 0n,
    voteDeadline: 0,
    voteActive: false,
    voteEnded: false,
    participants: [],
    claims: [],
    minContributionWei: 10000000000000n,
    minContributionEth: '0.00001',
    needsContributorVote: false,
  };

  const display = detail ?? fallbackDetail;
  const stake = participantStake(display, address);
  const canVote = display.voteActive && stake > 0n;

  return (
    <div className={`space-y-4 ${compact ? 'pt-1' : 'border-t border-border pt-3'}`}>
      {loadError ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span>Live stats temporarily unavailable.</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="text-accent-hover hover:underline"
          >
            Retry
          </button>
        </div>
      ) : null}
      {!compact ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span>
            Pool: <strong className="text-text">{formatEthDisplay(display.amountEth)} ETH</strong>
          </span>
          <span>·</span>
          <span>{display.participants.length} funder{display.participants.length === 1 ? '' : 's'}</span>
          {display.active ? (
            <>
              <span>·</span>
              <span className="text-green-600 dark:text-green-400">Open</span>
            </>
          ) : (
            <>
              <span>·</span>
              <span>Paid out</span>
            </>
          )}
        </div>
      ) : null}

      {display.voteActive ? (
        <div className="p-3 rounded-lg border border-accent/30 bg-accent/5 space-y-2">
          <div className="text-xs font-medium">Vote in progress — {voteTimeLeft(display.voteDeadline)}</div>
          <p className="text-[11px] text-muted">
            Yes: {formatVoteWeight(display.voteYes)} · No: {formatVoteWeight(display.voteNo)}
          </p>
          {canVote ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void vote(true)}
                className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg disabled:opacity-50"
              >
                Vote yes
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void vote(false)}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-accent disabled:opacity-50"
              >
                Vote no
              </button>
            </div>
          ) : display.voteActive && stake > 0n ? (
            <p className="text-[11px] text-muted">You already voted.</p>
          ) : display.voteActive ? (
            <p className="text-[11px] text-muted">
              Only funders can vote — use <strong className="text-text">Add funds</strong> first
              (MetaMask/Rabby on Base).
            </p>
          ) : null}
        </div>
      ) : null}

      {display.voteEnded ? (
        <div className="p-3 rounded-lg border border-border bg-surface-2 space-y-2">
          <div className="text-xs font-medium">Vote ended — resolve to finalize payout</div>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void resolve()}
            className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg disabled:opacity-50"
          >
            Resolve vote
          </button>
        </div>
      ) : null}

      {display.active && showFundForm ? (
        <>
          <div className="space-y-2">
            <div className="text-xs font-medium">Add funds</div>
            <p className="text-[11px] text-muted">
              Min {display.minContributionEth} ETH. Your share = voting power when a winner is proposed.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="number"
                min={0}
                step="any"
                value={fundEth}
                disabled={!!busy}
                onChange={(e) => setFundEth(e.target.value)}
                className="w-28 px-3 py-1.5 bg-bg border border-border rounded-lg text-sm disabled:opacity-50"
                aria-label="ETH amount to add"
              />
              <span className="text-xs text-muted">ETH</span>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void addFunds()}
                className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg disabled:opacity-50"
              >
                {busy === 'Add funds' ? 'Confirming…' : address ? 'Add funds' : 'Connect to fund'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {display.active && showClaimForm ? (
          <div className="space-y-2">
            <div className="text-xs font-medium">Submit claim</div>
            <p className="text-[11px] text-muted leading-relaxed">
              1. Do the task · 2. Paste a proof link below (tweet, screenshot URL, etc.) · 3. Optional:{' '}
              <a href={communityBase} className="text-accent-hover hover:underline">
                post in ${symbol} community
              </a>{' '}
              for discussion
            </p>
            <input
              className="w-full px-3 py-1.5 bg-bg border border-border rounded-lg text-sm"
              placeholder="Claim title (e.g. Dex profile done)"
              value={claimName}
              disabled={!!busy}
              onChange={(e) => setClaimName(e.target.value)}
            />
            <textarea
              rows={2}
              className="w-full px-3 py-1.5 bg-bg border border-border rounded-lg text-sm resize-y"
              placeholder="Brief description of what you did"
              value={claimDesc}
              disabled={!!busy}
              onChange={(e) => setClaimDesc(e.target.value)}
            />
            <input
              className="w-full px-3 py-1.5 bg-bg border border-border rounded-lg text-sm"
              placeholder="https://x.com/… or https://… (screenshot/image link)"
              value={claimUri}
              disabled={!!busy}
              onChange={(e) => setClaimUri(e.target.value)}
            />
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void submitClaim()}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-accent bg-surface-2 disabled:opacity-50"
            >
              {busy === 'Submit claim' ? 'Confirming…' : address ? 'Submit claim' : 'Connect to claim'}
            </button>
          </div>
      ) : null}

      {display.claims.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-medium">Claims ({display.claims.length})</div>
          <ul className="space-y-2">
            {display.claims.map((claim) => {
              const isVoting = display.votingClaimId === claim.id && display.voteActive;
              const isMine = claim.issuer === address?.toLowerCase();
              const canFinalize =
                display.active &&
                !display.voteActive &&
                display.votingClaimId === 0 &&
                isMine;
              const needsVote = display.needsContributorVote;
              const finalizeLabel = needsVote ? 'Request vote on this claim' : 'Accept & pay';
              const finalizeBusy = needsVote ? 'Request vote' : 'Accept claim';

              return (
                <li
                  key={claim.id}
                  className="p-2.5 rounded-lg border border-border bg-surface-2/50 text-[11px] space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-text">{claim.name}</span>
                    {claim.accepted ? (
                      <span className="text-green-600 dark:text-green-400 shrink-0">Paid</span>
                    ) : isVoting ? (
                      <span className="text-accent shrink-0">Voting</span>
                    ) : null}
                  </div>
                  {claim.description ? (
                    <p className="text-muted whitespace-pre-wrap">{claim.description}</p>
                  ) : null}
                  {canFinalize ? (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void finalizeClaim(claim.id)}
                      className="mt-1 px-2.5 py-1 text-[10px] font-medium bg-accent text-white rounded disabled:opacity-50"
                    >
                      {busy === finalizeBusy ? 'Confirming…' : finalizeLabel}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="text-[10px] text-muted">
            {display.needsContributorVote
              ? 'Multiple funders — claim submitter requests a 48h vote.'
              : 'Issuer-only pool — claim submitter accepts directly (no vote).'}
          </p>
        </div>
      ) : null}

      {pendingWithdraw ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted">
            Pending withdrawal: {pendingWithdraw} ETH
          </span>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void withdraw()}
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-accent disabled:opacity-50"
          >
            Withdraw
          </button>
        </div>
      ) : null}

      {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}
