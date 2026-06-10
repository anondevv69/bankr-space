'use client';

import { useCallback } from 'react';
import { useAccount, useChainId, useConfig, useConnectorClient } from 'wagmi';
import { getWalletClient } from 'wagmi/actions';
import { base } from 'wagmi/chains';
import type { WalletClient } from 'viem';

export function usePaymentWalletClient() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const config = useConfig();
  const { data: connectorClient } = useConnectorClient();

  const resolveWalletClient = useCallback(async (): Promise<WalletClient | null> => {
    if (connectorClient) return connectorClient as WalletClient;
    if (!address) return null;
    try {
      return await getWalletClient(config, { account: address, chainId: base.id });
    } catch {
      return null;
    }
  }, [address, config, connectorClient]);

  return {
    address,
    isConnected,
    chainId,
    onBase: chainId === base.id,
    resolveWalletClient,
  };
}
