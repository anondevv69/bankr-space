import type { Signer } from 'x402/types';
import type { WalletClient } from 'viem';

/** x402 calls signTypedData on the client; adapt wagmi/viem WalletClient for that shape. */
export function toX402Signer(walletClient: WalletClient): Signer {
  const account = walletClient.account;
  if (!account) {
    throw new Error('Wallet account not connected');
  }

  if (typeof walletClient.signTypedData !== 'function') {
    throw new Error(
      'Wallet does not support typed data signing. Use MetaMask or Rabby on Base.'
    );
  }

  const sign = walletClient.signTypedData.bind(walletClient);

  return {
    ...walletClient,
    account,
    signTypedData: (data: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }) =>
      sign({
        account,
        ...data,
      } as Parameters<WalletClient['signTypedData']>[0]),
  } as unknown as Signer;
}
