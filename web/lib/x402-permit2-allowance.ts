import { erc20Abi, maxUint256, type Address } from 'viem';
import { base } from 'viem/chains';
import { createEvmPaymentSigner } from '@/lib/x402-signer';

/** Uniswap Permit2 — required once before PermitWitnessTransferFrom can settle. */
export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address;

export async function readPermit2TokenAllowance(
  walletAddress: Address,
  tokenAddress: Address
): Promise<bigint> {
  const { publicClient } = createEvmPaymentSigner(walletAddress);
  return publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [walletAddress, PERMIT2_ADDRESS],
  });
}

/**
 * Ensures the wallet has approved Permit2 to spend the payment token.
 * x402 exact uses Permit2; without this on-chain approve, verification fails.
 */
export async function ensurePermit2TokenAllowance(
  walletAddress: Address,
  tokenAddress: Address,
  minAmount: bigint,
  onProgress?: (message: string) => void
): Promise<'ready' | 'approved'> {
  const { walletClient, publicClient } = createEvmPaymentSigner(walletAddress);

  const allowance = await readPermit2TokenAllowance(walletAddress, tokenAddress);
  if (allowance >= minAmount) {
    return 'ready';
  }

  onProgress?.(
    'Step 1 of 2 — confirm the MetaMask transaction to approve $Space for Permit2 (one-time, costs a little Base ETH).'
  );

  await walletClient.switchChain({ id: base.id }).catch(() => {
    /* wallet may already be on Base */
  });

  const hash = await walletClient
    .writeContract({
      account: walletAddress,
      chain: base,
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [PERMIT2_ADDRESS, maxUint256],
    })
    .catch(() => {
      throw new Error(
        'Permit2 approval rejected — confirm the first MetaMask transaction (approve $Space for Permit2), then click Contribute again.'
      );
    });

  onProgress?.('Waiting for Permit2 approval to confirm on Base…');
  await publicClient.waitForTransactionReceipt({ hash });

  const confirmed = await readPermit2TokenAllowance(walletAddress, tokenAddress);
  if (confirmed < minAmount) {
    throw new Error(
      'Permit2 approval did not settle — wait a few seconds and click Contribute again.'
    );
  }

  return 'approved';
}
