import { wrapFetchWithPayment } from 'x402-fetch';
import type { Signer } from 'x402/types';
import type { WalletClient } from 'viem';

/** Matches bankr.x402.json price for space-fund ($1 USDC per request). */
export const SPACE_FUND_X402_MAX_USDC = 1;
const USDC_BASE_UNITS = BigInt(SPACE_FUND_X402_MAX_USDC * 1_000_000);

export async function paySpaceFundUrl(walletClient: WalletClient, fundUrl: string) {
  if (!walletClient.account) {
    throw new Error('Wallet account not connected');
  }
  const paidFetch = wrapFetchWithPayment(fetch, walletClient as Signer, USDC_BASE_UNITS);
  const res = await paidFetch(fundUrl);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Payment failed (${res.status})`);
  }
  return data as {
    success?: boolean;
    raisedUsd?: number;
    goalUsd?: number;
    message?: string;
    error?: string;
  };
}
