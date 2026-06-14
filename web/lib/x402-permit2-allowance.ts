import { erc20Abi, maxUint256, type Address } from 'viem';
import { createEvmPaymentSigner } from '@/lib/x402-signer';

/** Uniswap Permit2 — required once before PermitWitnessTransferFrom can settle. */
export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address;

/**
 * Ensures the wallet has approved Permit2 to spend the payment token.
 * x402 upto uses Permit2; without this on-chain approve, verification fails.
 */
export async function ensurePermit2TokenAllowance(
  walletAddress: Address,
  tokenAddress: Address,
  minAmount: bigint
): Promise<'ready' | 'approved'> {
  const { walletClient, publicClient } = createEvmPaymentSigner(walletAddress);

  const allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [walletAddress, PERMIT2_ADDRESS],
  });

  if (allowance >= minAmount) {
    return 'ready';
  }

  const hash = await walletClient.writeContract({
    account: walletAddress,
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [PERMIT2_ADDRESS, maxUint256],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return 'approved';
}
