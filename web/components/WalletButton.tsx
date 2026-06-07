'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { shortAddr } from '@/lib/utils';

export function WalletButton({ className = '' }: { className?: string }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  const injected = connectors[0];

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className={`font-mono text-accent-hover hover:opacity-80 ${className}`}
      >
        {shortAddr(address)} · Disconnect
      </button>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => injected && connect({ connector: injected })}
        disabled={isPending || !injected}
        className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? 'Connecting…' : 'Connect wallet'}
      </button>
      {error ? (
        <p className="text-red-400 text-xs mt-2 max-w-xs">
          {error.message.includes('No provider')
            ? 'Install MetaMask or another Base wallet browser extension.'
            : error.message}
        </p>
      ) : null}
    </div>
  );
}

/** Call before actions that require a connected wallet (extension popup). */
export function useConnectWallet() {
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  function connectWallet() {
    if (isConnected) return true;
    const injected = connectors[0];
    if (injected) connect({ connector: injected });
    return false;
  }

  return { connectWallet, isConnected, isPending };
}
