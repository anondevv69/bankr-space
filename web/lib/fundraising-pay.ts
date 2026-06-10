'use client';

import {
  createPublicClient,
  erc20Abi,
  http,
  parseUnits,
  type Address,
} from 'viem';
import { base } from 'viem/chains';
import { createBrowserPaymentWalletClient } from '@/lib/x402-signer';
import { USDC_BASE_ADDRESS } from '@/lib/usdc-base';

const basePublicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export type FundraisingPayResult =
  | {
      success: true;
      message?: string;
      raisedUsd?: number;
      goalUsd?: number;
      creditedUsd?: number;
    }
  | { success: false; error: string };

export async function paySpaceFundDirect(
  donorAddress: Address,
  beneficiaryAddress: Address,
  tokenAddress: string,
  campaignId: string,
  amountUsd: number
): Promise<FundraisingPayResult> {
  if (!Number.isFinite(amountUsd) || amountUsd < 1) {
    return { success: false, error: 'Amount must be at least $1 USDC' };
  }

  const amount = parseUnits(String(amountUsd), 6);
  const wallet = createBrowserPaymentWalletClient(donorAddress);

  let txHash: `0x${string}`;
  try {
    txHash = await wallet.writeContract({
      account: donorAddress,
      chain: base,
      address: USDC_BASE_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [beneficiaryAddress, amount],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'USDC transfer rejected';
    if (/insufficient|balance/i.test(msg)) {
      return { success: false, error: 'Insufficient USDC on Base. Add USDC and try again.' };
    }
    return { success: false, error: msg };
  }

  try {
    await basePublicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
  } catch {
    return {
      success: false,
      error: 'Transfer submitted but confirmation timed out. Refresh the page in a minute.',
    };
  }

  const res = await fetch(`/api/communities/${tokenAddress}/fundraising/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignId,
      amountUsd,
      txHash,
      donorWallet: donorAddress,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      error:
        typeof data.error === 'string'
          ? data.error
          : 'Payment sent but crediting the goal failed. Contact the space operator.',
    };
  }

  return {
    success: true,
    message: data.message,
    raisedUsd: data.raisedUsd,
    goalUsd: data.goalUsd,
    creditedUsd: data.creditedUsd,
  };
}
