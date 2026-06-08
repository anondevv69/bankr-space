'use client';

import { useAccount, useConnect } from 'wagmi';
import { useEmbeddedBankr } from '@/components/EmbeddedBankrProvider';

export function useAppWallet() {
  const embed = useEmbeddedBankr();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  if (embed.isEmbedded) {
    const connected = embed.authenticated && !!embed.walletAddress;
    return {
      address: (embed.walletAddress || undefined) as `0x${string}` | undefined,
      isConnected: connected,
      isEmbedded: true,
      isPending: !embed.ready,
      connectWallet: () => {
        if (connected) return true;
        embed.requestSignIn();
        return false;
      },
    };
  }

  return {
    address,
    isConnected,
    isEmbedded: false,
    isPending,
    connectWallet: () => {
      if (isConnected) return true;
      const injected = connectors[0];
      if (injected) connect({ connector: injected });
      return false;
    },
  };
}
