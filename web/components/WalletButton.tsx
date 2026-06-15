'use client';

import Link from 'next/link';
import { useDisconnect } from 'wagmi';
import { shortAddr } from '@/lib/utils';
import { useAppWallet } from '@/hooks/useAppWallet';
import { useEmbeddedBankr } from '@/components/EmbeddedBankrProvider';

export function WalletButton({ className = '' }: { className?: string }) {
  const { address, isConnected, isEmbedded, isPending, connectWallet } = useAppWallet();
  const { disconnect } = useDisconnect();
  const embed = useEmbeddedBankr();

  if (isEmbedded) {
    if (!embed.ready || isPending) {
      return (
        <span className={`text-muted text-sm ${className}`}>Connecting Bankr wallet…</span>
      );
    }
    if (isConnected && address) {
      return (
        <span className={`text-sm ${className}`}>
          <span className="text-muted">Signed in via Bankr · </span>
          <span className="font-mono text-accent-hover">{shortAddr(address)}</span>
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => connectWallet()}
        className={`px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover ${className}`}
      >
        Sign in with Bankr
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Link
          href="/profile"
          className="font-mono text-accent-hover hover:opacity-80 text-sm"
        >
          {shortAddr(address)}
        </Link>
        <span className="text-muted text-xs">·</span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="text-muted hover:text-text text-xs"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => connectWallet()}
        disabled={isPending}
        className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? 'Connecting…' : 'Connect wallet'}
      </button>
    </div>
  );
}

/** Call before actions that require a connected wallet. */
export function useConnectWallet() {
  const wallet = useAppWallet();
  return {
    connectWallet: wallet.connectWallet,
    isConnected: wallet.isConnected,
    isPending: wallet.isPending,
  };
}
