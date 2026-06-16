'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useAppWallet } from '@/hooks/useAppWallet';
import { createBrowserPaymentWalletClient } from '@/lib/x402-signer';

type CodeInfo = {
  valid: boolean;
  telegramUsername: string | null;
  telegramReady?: boolean;
  wallet?: string | null;
  expiresAt?: number;
  error?: string;
};

type LinkResult = {
  success?: boolean;
  error?: string;
  wallet?: string;
};

function LinkTelegramContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || '';
  const { address, isConnected } = useAccount();
  const { connectWallet } = useAppWallet();

  const [codeInfo, setCodeInfo] = useState<CodeInfo | null>(null);
  const [loadingCode, setLoadingCode] = useState(true);
  const [signing, setSigning] = useState(false);
  const [result, setResult] = useState<LinkResult | null>(null);

  const checkCode = useCallback(async () => {
    if (!code) {
      setCodeInfo({ valid: false, telegramUsername: null, error: 'No link code in URL.' });
      setLoadingCode(false);
      return;
    }
    try {
      const res = await fetch(`/api/telegram/link?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      setCodeInfo(data);
    } catch {
      setCodeInfo({ valid: false, telegramUsername: null, error: 'Failed to check link code.' });
    }
    setLoadingCode(false);
  }, [code]);

  useEffect(() => {
    void checkCode();
  }, [checkCode]);

  useEffect(() => {
    if (!code || !codeInfo?.valid || codeInfo.telegramReady) return;
    const timer = setInterval(() => {
      void checkCode();
    }, 3000);
    return () => clearInterval(timer);
  }, [code, codeInfo?.valid, codeInfo?.telegramReady, checkCode]);

  async function sign() {
    if (!address || !code) return;
    setSigning(true);
    setResult(null);
    try {
      const wallet = address.toLowerCase();
      const message = `Link Telegram to wallet ${wallet} on bankr.space\n\nCode: ${code}`;
      const walletClient = createBrowserPaymentWalletClient(address);
      const signature = await walletClient.signMessage({ account: address, message });

      const res = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, wallet, signature }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Signing failed.' });
    }
    setSigning(false);
  }

  if (loadingCode) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-muted">Checking link code…</p>
      </main>
    );
  }

  if (!codeInfo?.valid) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-2xl">⛔</p>
          <p className="font-semibold">Link code expired or invalid</p>
          <p className="text-sm text-muted">
            {codeInfo?.error || 'Ask the Telegram bot for a new link with /link.'}
          </p>
        </div>
      </main>
    );
  }

  if (result?.success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-4xl">✅</p>
          <p className="text-xl font-bold">Wallet linked!</p>
          <p className="text-sm text-muted">
            Your wallet <code className="font-mono text-xs">{result.wallet}</code> is now
            connected to your Telegram account.
          </p>
          <p className="text-sm text-muted">
            Go back to Telegram and type <strong>/post</strong> to post to your space.
          </p>
        </div>
      </main>
    );
  }

  if (codeInfo.valid && codeInfo.telegramReady === false) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-3xl">✈️</p>
          <p className="font-semibold">Waiting for Telegram</p>
          <p className="text-sm text-muted">
            Open the bot from your profile, tap <strong>Start</strong>, then return here — this
            page will update automatically.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-1">
          <p className="text-3xl">🔗</p>
          <h1 className="text-xl font-bold">Link Telegram to Your Wallet</h1>
          {codeInfo.telegramUsername && (
            <p className="text-sm text-muted">
              Linking for <strong>@{codeInfo.telegramUsername}</strong>
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted space-y-2">
          <p>
            Connect your wallet on Base and sign a message to prove ownership. This lets you
            post and manage your space from Telegram.
          </p>
          <p>One wallet per Telegram account. One Telegram per wallet.</p>
        </div>

        {result?.error && (
          <p className="text-sm text-red-500 text-center">{result.error}</p>
        )}

        {!isConnected ? (
          <button
            onClick={connectWallet}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted text-center font-mono">
              {address}
            </p>
            <button
              onClick={() => void sign()}
              disabled={signing}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {signing ? 'Signing…' : 'Sign & Link'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function LinkTelegramPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <p className="text-muted">Loading…</p>
        </main>
      }
    >
      <LinkTelegramContent />
    </Suspense>
  );
}
