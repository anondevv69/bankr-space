'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSignMessage } from 'wagmi';
import { Header } from '@/components/Header';
import { useAppWallet } from '@/hooks/useAppWallet';
import { apiFetch } from '@/lib/wagmi';
import type { WalletAgentMeta } from '@/lib/types';
import type { WalletBankrLaunch } from '@/lib/wallet-bankr-launches';

type SpaceSummary = {
  tokenAddress: string;
  name: string;
  symbol: string;
  verified: boolean;
  imageUrl: string | null;
  url: string;
};

type TelegramStatus =
  | { linked: true; telegramId: string; telegramUsername: string | null; linkedAt: number }
  | { linked: false };

type FarcasterStatus =
  | { linked: true; fid: number; username: string | null; displayName: string | null; pfpUrl: string | null; linkedAt: number }
  | { linked: false };

type ProfileData = {
  wallet: string;
  author: {
    twitter: string | null;
    farcaster: string | null;
    profileImage: string | null;
  };
  agentMeta: WalletAgentMeta;
  telegram: TelegramStatus;
  farcaster: FarcasterStatus;
  bankrLaunches: WalletBankrLaunch[];
  pendingActions: {
    createSpaceCount: number;
    verifySpaceCount: number;
  };
  spaces: {
    owned: SpaceSummary[];
    founded: SpaceSummary[];
    delegated: SpaceSummary[];
  };
};

function roleLabel(roles: WalletBankrLaunch['roles']): string {
  if (roles.includes('feeRecipient') && roles.includes('deployer')) return 'Fee recipient & deployer';
  if (roles.includes('feeRecipient')) return 'Fee recipient';
  return 'Deployer';
}

function SpaceRow({ space, role }: { space: SpaceSummary; role: string }) {
  return (
    <Link
      href={space.url}
      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface hover:bg-surface-2 transition-colors"
    >
      {space.imageUrl ? (
        <img
          src={space.imageUrl}
          alt={space.symbol}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-muted">{space.symbol.slice(0, 2)}</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{space.name}</div>
        <div className="text-xs text-muted">${space.symbol}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full">
          {role}
        </span>
        {space.verified && (
          <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
            Verified
          </span>
        )}
        <span className="text-muted text-sm">→</span>
      </div>
    </Link>
  );
}

function BankrLaunchRow({
  launch,
  wallet,
  onUpdated,
  canManage = false,
}: {
  launch: WalletBankrLaunch;
  wallet: string;
  onUpdated: () => void;
  canManage?: boolean;
}) {
  const [busy, setBusy] = useState<'create' | 'verify' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function createSpace() {
    setBusy('create');
    setActionError(null);
    try {
      await apiFetch(`/api/communities/${launch.tokenAddress}`, {
        method: 'POST',
        wallet,
        body: JSON.stringify({
          description: `${launch.name} holder space on bankr.space`,
        }),
      });
      onUpdated();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create space');
    }
    setBusy(null);
  }

  async function verifySpace() {
    setBusy('verify');
    setActionError(null);
    try {
      await apiFetch(`/api/communities/${launch.tokenAddress}/verify`, {
        method: 'POST',
        wallet,
      });
      onUpdated();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to verify space');
    }
    setBusy(null);
  }

  return (
    <div className="p-3 rounded-xl border border-border bg-surface space-y-2">
      <div className="flex items-center gap-3">
        {launch.imageUrl ? (
          <img
            src={launch.imageUrl}
            alt={launch.symbol}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-muted">{launch.symbol.slice(0, 2)}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{launch.name}</div>
          <div className="text-xs text-muted">${launch.symbol}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 justify-end">
          <span className="text-xs text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full">
            {roleLabel(launch.roles)}
          </span>
          {launch.space.exists && launch.space.verified && (
            <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
              Verified
            </span>
          )}
          {launch.space.exists && !launch.space.verified && (
            <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              Unverified
            </span>
          )}
          {!launch.space.exists && (
            <span className="text-xs text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full">
              No space yet
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canManage && launch.actions.canCreateSpace && (
          <button
            type="button"
            onClick={() => void createSpace()}
            disabled={busy !== null}
            className="text-xs bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {busy === 'create' ? 'Creating…' : 'Create space'}
          </button>
        )}
        {canManage && launch.actions.canVerifySpace && (
          <button
            type="button"
            onClick={() => void verifySpace()}
            disabled={busy !== null}
            className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {busy === 'verify' ? 'Verifying…' : 'Verify space'}
          </button>
        )}
        {launch.space.url && (
          <Link
            href={launch.space.url}
            className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-surface-2"
          >
            Open space →
          </Link>
        )}
      </div>

      {actionError && <p className="text-xs text-red-400">{actionError}</p>}
    </div>
  );
}

function TelegramSection({
  telegram,
  wallet,
  onUnlinked,
  readOnly = false,
}: {
  telegram: TelegramStatus;
  wallet: string;
  onUnlinked: () => void;
  readOnly?: boolean;
}) {
  const [unlinking, setUnlinking] = useState(false);
  const [botInfo, setBotInfo] = useState<{
    configured: boolean;
    botUsername: string | null;
    botUrl: string | null;
    error?: string;
  } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [pendingSignUrl, setPendingSignUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/telegram/info')
      .then((r) => r.json())
      .then(setBotInfo)
      .catch(() => setBotInfo({ configured: false, botUsername: null, botUrl: null }));
  }, []);

  async function unlink() {
    if (!confirm('Unlink your Telegram account?')) return;
    setUnlinking(true);
    try {
      const res = await fetch('/api/telegram/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-wallet': wallet },
      });
      if (res.ok) onUnlinked();
    } catch {
      /* ignore */
    }
    setUnlinking(false);
  }

  async function connectTelegram() {
    setConnecting(true);
    setConnectError(null);
    setPendingSignUrl(null);
    try {
      const res = await fetch('/api/telegram/link/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': wallet },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start Telegram link');

      setPendingSignUrl(data.signUrl);
      window.open(data.deepLink, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to connect');
    }
    setConnecting(false);
  }

  if (telegram.linked) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-base">✈️</span>
          </div>
          <div>
            <div className="text-sm font-medium">
              {telegram.telegramUsername ? `@${telegram.telegramUsername}` : `ID ${telegram.telegramId}`}
            </div>
            <div className="text-xs text-muted">
              Linked {new Date(telegram.linkedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        {!readOnly && (
          <button
            onClick={() => void unlink()}
            disabled={unlinking}
            className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {unlinking ? 'Unlinking…' : 'Unlink'}
          </button>
        )}
      </div>
    );
  }

  if (readOnly) {
    return <p className="text-sm text-muted">Telegram not linked.</p>;
  }

  const botUsername = botInfo?.botUsername;
  const botConfigured = botInfo?.configured;

  return (
    <div className="space-y-3">
      {!botInfo ? (
        <p className="text-sm text-muted">Loading bot info…</p>
      ) : !botConfigured ? (
        <p className="text-sm text-amber-400">
          Telegram bot not configured — set <code className="text-xs">TELEGRAM_BOT_TOKEN</code> and{' '}
          <code className="text-xs">TELEGRAM_BOT_USERNAME</code> in Vercel (must match @BotFather).
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            Connect <strong>@{botUsername}</strong> to post from Telegram.
          </p>
          <button
            type="button"
            onClick={() => void connectTelegram()}
            disabled={connecting}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {connecting ? 'Opening Telegram…' : 'Connect Telegram'}
          </button>
          {pendingSignUrl && (
            <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm space-y-2">
              <p className="font-medium">Step 2 — Sign your wallet</p>
              <p className="text-xs text-muted">
                In Telegram, tap <strong>Start</strong> on @{botUsername}, then finish here:
              </p>
              <Link
                href={pendingSignUrl}
                className="inline-block text-xs bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded-lg"
              >
                Sign &amp; link wallet →
              </Link>
            </div>
          )}
        </>
      )}
      {connectError && <p className="text-xs text-red-400">{connectError}</p>}
    </div>
  );
}

function FarcasterSection({
  farcaster,
  wallet,
  onLinked,
  onUnlinked,
  readOnly = false,
}: {
  farcaster: FarcasterStatus;
  wallet: string;
  onLinked: () => void;
  onUnlinked: () => void;
  readOnly?: boolean;
}) {
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signMessage } = useSignMessage();

  if (farcaster.linked) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {farcaster.pfpUrl ? (
            <img
              src={farcaster.pfpUrl}
              alt=""
              className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-base">🟣</span>
            </div>
          )}
          <div>
            <div className="text-sm font-medium">
              {farcaster.username ? `@${farcaster.username}` : `FID ${farcaster.fid}`}
              {farcaster.displayName && farcaster.displayName !== farcaster.username && (
                <span className="text-muted font-normal ml-1.5 text-xs">{farcaster.displayName}</span>
              )}
            </div>
            <div className="text-xs text-muted">
              FID {farcaster.fid} · Linked {new Date(farcaster.linkedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        {!readOnly && (
          <button
            onClick={() => void (async () => {
              if (!confirm('Unlink your Farcaster account?')) return;
              setUnlinking(true);
              try {
                await fetch('/api/farcaster/me', {
                  method: 'DELETE',
                  headers: { 'x-wallet-address': wallet },
                });
                onUnlinked();
              } finally {
                setUnlinking(false);
              }
            })()}
            disabled={unlinking}
            className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {unlinking ? 'Unlinking…' : 'Unlink'}
          </button>
        )}
      </div>
    );
  }

  if (readOnly) {
    return <p className="text-sm text-muted">Farcaster not linked.</p>;
  }

  async function linkFarcaster() {
    setLinking(true);
    setError(null);
    try {
      // Dynamic import to avoid SSR issues with auth-kit
      const { createAppClient, viemConnector } = await import('@farcaster/auth-kit');
      const appClient = createAppClient({ relay: 'https://relay.farcaster.xyz', ethereum: viemConnector() });
      const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const siweUrl = typeof window !== 'undefined' ? window.location.origin : 'https://bankr.space';

      const result = await appClient.signIn({
        nonce,
        siweUri: siweUrl,
        domain: typeof window !== 'undefined' ? window.location.hostname : 'bankr.space',
      });

      if (!result.success) throw new Error('Farcaster sign-in cancelled or failed');

      // Have wallet sign a message to prove wallet ownership
      const linkMessage = `Link Farcaster FID ${result.fid} to bankr.space\n\nNonce: ${nonce}`;
      const walletSig = await signMessage({ message: linkMessage });

      const res = await fetch('/api/farcaster/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid: result.fid,
          username: result.username,
          displayName: result.displayName,
          pfpUrl: result.pfpUrl,
          wallet,
          walletSignature: walletSig,
          nonce,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to link');
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link Farcaster');
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Link your Farcaster account — your username appears on posts.
      </p>
      <button
        type="button"
        onClick={() => void linkFarcaster()}
        disabled={linking}
        className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
      >
        {linking ? 'Opening Warpcast…' : 'Connect Farcaster'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function ProfileContent() {
  const { address, isConnected, connectWallet } = useAppWallet();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const paramWallet = searchParams.get('wallet')?.trim().toLowerCase() || null;
  const viewWallet = paramWallet || address?.toLowerCase() || null;
  const isOwnProfile =
    !!viewWallet &&
    !!address &&
    viewWallet === address.toLowerCase() &&
    (!paramWallet || paramWallet === address.toLowerCase());

  const load = useCallback(async (wallet: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/profile?wallet=${wallet}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load profile');
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (viewWallet && /^0x[a-f0-9]{40}$/.test(viewWallet)) {
      void load(viewWallet);
    } else {
      setProfile(null);
    }
  }, [viewWallet, load]);

  if (!viewWallet) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-muted">Connect your wallet to view your profile.</p>
        <button
          onClick={() => connectWallet()}
          className="px-5 py-2.5 bg-accent text-white rounded-xl font-medium hover:bg-accent-hover"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (paramWallet && !/^0x[a-f0-9]{40}$/.test(paramWallet)) {
    return (
      <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        Invalid wallet address.
      </div>
    );
  }

  const allSpaces = profile
    ? [
        ...profile.spaces.owned.map((s) => ({ ...s, role: 'Fee Beneficiary' })),
        ...profile.spaces.founded.map((s) => ({ ...s, role: 'Founder' })),
        ...profile.spaces.delegated.map((s) => ({ ...s, role: 'Delegate' })),
      ]
    : [];

  const agent = profile?.agentMeta;
  const isBankrWallet = agent?.isAgentWallet;
  const pendingCreate = profile?.pendingActions.createSpaceCount ?? 0;
  const pendingVerify = profile?.pendingActions.verifySpaceCount ?? 0;

  return (
    <div className="space-y-6 pb-16">
      <div className="rounded-2xl border border-border bg-surface p-5 flex items-start gap-4">
        {profile?.author.profileImage ? (
          <img
            src={profile.author.profileImage}
            alt="Profile"
            className="w-14 h-14 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">👤</span>
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1">
          {profile?.author.twitter && (
            <a
              href={`https://x.com/${profile.author.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sm hover:underline"
            >
              @{profile.author.twitter}
            </a>
          )}
          <div className="font-mono text-xs text-muted break-all">{viewWallet}</div>
          {isBankrWallet && agent?.agentLabel && (
            <div className="inline-flex items-center gap-1.5 text-xs bg-accent/10 border border-accent/30 text-accent px-2 py-0.5 rounded-full">
              <span>🤖</span>
              <span>Bankr agent · {agent.agentLabel}</span>
            </div>
          )}
          {!loading && !error && !profile?.bankrLaunches.length && allSpaces.length === 0 && !isBankrWallet && (
            <div className="text-xs text-muted">Token holder</div>
          )}
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted text-center py-8">Loading profile from Bankr…</p>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          {error}
        </div>
      )}

      {profile && (
        <>
          {(pendingCreate > 0 || pendingVerify > 0) && isOwnProfile && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm space-y-1">
              <div className="font-medium">Action needed</div>
              {pendingCreate > 0 && (
                <p className="text-muted">
                  {pendingCreate} Bankr launch{pendingCreate !== 1 ? 'es' : ''} without a space — create one below.
                </p>
              )}
              {pendingVerify > 0 && (
                <p className="text-muted">
                  {pendingVerify} space{pendingVerify !== 1 ? 's' : ''} waiting for fee-recipient verification.
                </p>
              )}
            </div>
          )}

          {profile.bankrLaunches.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
              <div>
                <h2 className="font-semibold text-sm">
                  {isOwnProfile ? 'Your Bankr Launches' : 'Bankr Launches'}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  From Bankr API — tokens where you are fee recipient or deployer.
                </p>
              </div>
              <div className="space-y-2">
                {profile.bankrLaunches.map((launch) => (
                  <BankrLaunchRow
                    key={launch.tokenAddress}
                    launch={launch}
                    wallet={viewWallet}
                    onUpdated={() => void load(viewWallet)}
                    canManage={isOwnProfile}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
            <h2 className="font-semibold text-sm">Telegram</h2>
            <TelegramSection
              telegram={profile.telegram}
              wallet={viewWallet}
              onUnlinked={() => void load(viewWallet)}
              readOnly={!isOwnProfile}
            />
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
            <h2 className="font-semibold text-sm">Farcaster</h2>
            <FarcasterSection
              farcaster={profile.farcaster ?? { linked: false }}
              wallet={viewWallet}
              onLinked={() => void load(viewWallet)}
              onUnlinked={() => void load(viewWallet)}
              readOnly={!isOwnProfile}
            />
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">
                {isOwnProfile ? 'Your Spaces' : 'Spaces'}
              </h2>
              {allSpaces.length > 0 && (
                <span className="text-xs text-muted">
                  {allSpaces.length} space{allSpaces.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {allSpaces.length === 0 ? (
              <p className="text-sm text-muted">
                No spaces on bankr.space yet. If you launched on Bankr, create one from the section above.
              </p>
            ) : (
              <div className="space-y-2">
                {allSpaces.map((s) => (
                  <SpaceRow key={`${s.tokenAddress}-${s.role}`} space={s} role={s.role} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div className="max-w-[640px] mx-auto px-4 sm:px-5">
      <Header backHref="/" />
      <div className="mb-4">
        <h1 className="text-xl font-bold">Profile</h1>
        <p className="text-sm text-muted">Wallet info, Bankr launches, and spaces.</p>
      </div>
      <Suspense
        fallback={
          <p className="text-sm text-muted py-8 text-center">Loading…</p>
        }
      >
        <ProfileContent />
      </Suspense>
    </div>
  );
}
