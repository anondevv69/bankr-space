'use client';

import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
  type Address,
} from 'viem';
import { base } from 'viem/chains';
import { createBrowserPaymentWalletClient } from './x402-signer';

const baseClient = createPublicClient({
  chain: base,
  transport: http(),
});

export type CommunityTipResult = {
  txHash: `0x${string}`;
  amount: string;
  symbol: string;
};

export async function tipCommunityToken({
  from,
  to,
  tokenAddress,
  amount,
}: {
  from: Address;
  to: Address;
  tokenAddress: Address;
  amount: string;
}): Promise<CommunityTipResult> {
  const trimmed = amount.trim();
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('Tip amount must be greater than 0');
  }

  const [decimals, symbol] = await Promise.all([
    baseClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
    baseClient
      .readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'symbol',
      })
      .catch(() => 'tokens'),
  ]);

  const value = parseUnits(trimmed, decimals);
  const wallet = createBrowserPaymentWalletClient(from);

  const txHash = await wallet.writeContract({
    account: from,
    chain: base,
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, value],
  });

  await baseClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });

  return {
    txHash,
    amount: formatUnits(value, decimals),
    symbol,
  };
}
