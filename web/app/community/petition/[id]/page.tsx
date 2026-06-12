'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Footer, Header } from '@/components/Header';
import { PetitionBackPanel } from '@/components/PetitionBackPanel';
import { PostFeed, PostForm } from '@/components/PostFeed';
import { useAppWallet } from '@/hooks/useAppWallet';
import { useConnectWallet } from '@/components/WalletButton';
import { shortAddr } from '@/lib/utils';
import { apiFetch } from '@/lib/wagmi';
import type { PetitionSpace, Post } from '@/lib/types';

type PetitionView = {
  space: PetitionSpace;
  tmp: {
    status: string;
    petition: {
      soldUnits: number;
      goalUnits: number;
      expiresAt?: string;
      maxUnitsPerWallet: number;
    };
    agentParticipation?: { remainingUnits?: number };
  };
  progress: { soldUnits: number; goalUnits: number; pct: number };
  needsUpgrade: boolean;
  redirectTo: string | null;
  backers: Array<{ wallet: string; units: number }>;
  orderWallets: string[];
};

export default function PetitionSpacePage({ params }: { params: { id: string } }) {
  const petitionId = params.id;
  const router = useRouter();
  const { address, isConnected } = useAppWallet();
  const { connectWallet } = useConnectWallet();
  const [view, setView] = useState<PetitionView | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [config, setConfig] = useState<{ priceEth: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [detailRes, postsRes, configRes] = await Promise.all([
        fetch(`/api/petitions/${petitionId}`),
        fetch(`/api/petitions/${petitionId}/posts`),
        fetch('/api/petitions'),
      ]);
      const detail = await detailRes.json();
      const postsData = await postsRes.json();
      const configData = await configRes.json();
      if (!detailRes.ok) throw new Error(detail.error);
      setView(detail);
      setPosts(postsData.posts || []);
      setConfig(configData.config ? { priceEth: configData.config.priceEth } : { priceEth: '0.00001' });

      if (detail.redirectTo) {
        router.replace(detail.redirectTo);
        return;
      }

      if (detail.needsUpgrade && address) {
        const isFounder =
          detail.space.founderWallet.toLowerCase() === address.toLowerCase();
        if (isFounder) {
          try {
            const up = await apiFetch(`/api/petitions/${petitionId}`, {
              method: 'POST',
              wallet: address,
              body: JSON.stringify({ action: 'upgrade' }),
            });
            if (up.redirectTo) {
              router.replace(up.redirectTo);
            }
          } catch {
            // Bankr launch index may lag — cron or manual retry
          }
        }
      }
    } catch (err) {
      setView(null);
      setHint(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [address, petitionId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!view || view.tmp.status === 'finalized' || view.space.phase === 'expired') return;
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
  }, [load, view]);

  const isFounder =
    !!address &&
    !!view &&
    view.space.founderWallet.toLowerCase() === address.toLowerCase();
  const isBacker =
    !!address &&
    !!view &&
    (isFounder || view.orderWallets.some((w) => w.toLowerCase() === address.toLowerCase()));
  const canPost = isConnected && isBacker;
  const isOpen = view?.tmp.status === 'open';
  const isFinalizing =
    view?.tmp.status === 'locked' ||
    view?.tmp.status === 'finalizing' ||
    view?.space.phase === 'finalizing';

  async function saveDescription() {
    if (!address || !view) return;
    try {
      await apiFetch(`/api/petitions/${petitionId}`, {
        method: 'PATCH',
        wallet: address,
        body: JSON.stringify({ description: editDesc }),
      });
      setEditing(false);
      await load();
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Save failed');
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1100px] mx-auto px-5 py-12 text-muted">Loading petition space…</div>
    );
  }

  if (!view) {
    return (
      <div className="max-w-[1100px] mx-auto px-5 py-12">
        <p className="text-red-400">{hint || 'Petition space not found.'}</p>
        <Link href="/" className="text-accent-hover text-sm mt-4 inline-block">
          ← Back to spaces
        </Link>
      </div>
    );
  }

  const { space, progress, tmp } = view;

  return (
    <div className="max-w-[1100px] mx-auto px-5 pb-16">
      <Header backHref="/" />

      <div className="mb-6 p-5 rounded-xl border border-border bg-surface space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">${space.tokenSymbol}</h1>
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                Petition
              </span>
              {isFinalizing ? (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">
                  Deploying…
                </span>
              ) : null}
              {view.space.phase === 'expired' ? (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-2 text-muted">
                  Expired
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted mt-1">{space.tokenName}</p>
            <p className="text-[11px] text-muted mt-1">
              Creator {shortAddr(space.founderWallet)} · Petition #{petitionId}
            </p>
          </div>
          {isFounder ? (
            <button
              type="button"
              onClick={() => {
                setEditDesc(space.description);
                setEditing((v) => !v);
              }}
              className="text-xs px-3 py-1.5 border border-border rounded-lg"
            >
              {editing ? 'Cancel edit' : 'Edit description'}
            </button>
          ) : null}
        </div>

        {editing ? (
          <div className="space-y-2">
            <textarea
              rows={4}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
            />
            <button
              type="button"
              onClick={() => void saveDescription()}
              className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg"
            >
              Save
            </button>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{space.description}</p>
        )}

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted">
            <span>
              {progress.soldUnits} / {progress.goalUnits} units
            </span>
            <span>{progress.pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          {tmp.petition.expiresAt ? (
            <p className="text-[10px] text-muted">
              Window ends {new Date(tmp.petition.expiresAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>

      {isOpen ? (
        <div className="mb-6">
          <PetitionBackPanel
            petitionId={petitionId}
            maxUnitsPerWallet={tmp.petition.maxUnitsPerWallet || space.maxUnitsPerWallet}
            priceEth={config?.priceEth || '0.00001'}
            remainingUnits={view.tmp.agentParticipation?.remainingUnits}
            onSuccess={() => void load()}
          />
        </div>
      ) : isFinalizing ? (
        <p className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm text-amber-700 dark:text-amber-400">
          Goal reached — token is deploying. This page refreshes automatically.
        </p>
      ) : null}

      {view.backers.length ? (
        <div className="mb-6 p-4 rounded-xl border border-border bg-surface">
          <div className="text-sm font-semibold mb-2">Backers</div>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {view.backers.map((b, i) => (
              <li key={`${b.wallet}-${i}`} className="text-xs text-muted flex justify-between gap-2">
                <span>{shortAddr(b.wallet)}</span>
                <span className="tabular-nums">{b.units} units</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[minmax(260px,300px)_1fr] gap-6 items-start">
        <div className="p-4 rounded-xl border border-border bg-surface text-[11px] text-muted space-y-2">
          <div className="text-sm font-semibold text-text">How it works</div>
          <p>1. Back with ETH — each unit is an entry toward launch.</p>
          <p>2. At 1,000 units, the token deploys on Base via Token Marketplace.</p>
          <p>3. Fee-right units airdrop to every backer wallet.</p>
          <p>4. This space becomes a full Bankr token space automatically.</p>
        </div>

        <div className="min-w-0">
          {canPost ? (
            <PostForm
              tokenAddress={`petition:${petitionId}`}
              onPosted={load}
              postApiUrl={`/api/petitions/${petitionId}/posts`}
              placeholder="Post in this pre-launch space…"
            />
          ) : isConnected ? (
            <div className="mb-6 p-4 text-center text-muted text-sm border border-dashed border-border rounded-xl bg-surface">
              Back the petition to post in this pre-launch space.
            </div>
          ) : (
            <div className="mb-6 p-4 text-center text-muted text-sm border border-dashed border-border rounded-xl bg-surface">
              <button type="button" onClick={connectWallet} className="text-accent-hover hover:underline">
                Connect wallet
              </button>{' '}
              to back and post.
            </div>
          )}

          <PostFeed
            tokenAddress={`petition:${petitionId}`}
            tokenSymbol={space.tokenSymbol}
            posts={posts}
            canInteract={canPost}
            canManage={isFounder}
            pinnedPosts={[]}
            beneficiaryWallet={space.founderWallet}
            ownerWallet={space.founderWallet}
            onUpdate={load}
            hideExtraTabs
          />
        </div>
      </div>

      {hint ? <p className="text-xs text-muted mt-4">{hint}</p> : null}
      <Footer />
    </div>
  );
}
