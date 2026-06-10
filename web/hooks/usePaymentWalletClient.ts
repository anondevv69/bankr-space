'use client';

import { useCallback } from 'react';
import { useAccount, useChainId, useConfig } from 'wagmi';
import { getWalletClient } from 'wagmi/actions';
import { base } from 'wagmi/chains';
import type { WalletClient } from 'viem';

export function usePaymentWalletClient() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const config = useConfig();

  const resolveWalletClient = useCallback(async (): Promise<WalletClient | null> => {
    if (!address) return null;
    try {
      // Fresh client at pay time — cached connector clients can lose signTypedData.
      return await getWalletClient(config, { account: address, chainId: base.id });
    } catch {
      return null;
    }
  }, [address, config]);

  return {
    address,
    isConnected,
    chainId,
    onBase: chainId === base.id,
    resolveWalletClient,
  };
}
