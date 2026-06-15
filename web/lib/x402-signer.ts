import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type Hex,
  type WalletClient,
} from 'viem';
import { base } from 'viem/chains';

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getBrowserProvider(): Eip1193Provider {
  if (typeof window === 'undefined') {
    throw new Error('Wallet signing is only available in the browser.');
  }
  const provider = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  if (!provider?.request) {
    throw new Error('No browser wallet found. Install MetaMask or Rabby.');
  }
  return provider;
}

export function createBrowserPaymentWalletClient(address: Address): WalletClient {
  return createWalletClient({
    account: address,
    chain: base,
    transport: custom(getBrowserProvider()),
  });
}

/** Wallet + public client for @x402/evm Permit2 reads and typed-data signing. */
export function createEvmPaymentSigner(address: Address) {
  const provider = getBrowserProvider();
  const walletTransport = custom(provider);
  return {
    walletClient: createWalletClient({
      account: address,
      chain: base,
      transport: walletTransport,
    }),
    /** Base RPC reads — do not route balance/allowance through the wallet extension. */
    publicClient: createPublicClient({
      chain: base,
      transport: http(),
    }),
  };
}

type AuthorizationTypedData = {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
};

async function signUsdcAuthorization(
  address: Address,
  data: AuthorizationTypedData
): Promise<Hex> {
  const client = createBrowserPaymentWalletClient(address);

  if (typeof client.signTypedData === 'function') {
    return client.signTypedData({
      account: address,
      domain: data.domain,
      types: data.types,
      primaryType: data.primaryType as 'TransferWithAuthorization',
      message: data.message,
    } as Parameters<WalletClient['signTypedData']>[0]);
  }

  const signature = await getBrowserProvider().request({
    method: 'eth_signTypedData_v4',
    params: [address, JSON.stringify(data)],
  });
  return signature as Hex;
}

/** @deprecated legacy x402 v1 signer — use createEvmPaymentSigner with @x402/evm instead */
export function toX402Signer(address: Address) {
  const unsupported = async () => {
    throw new Error('Unsupported signing method');
  };

  return {
    address,
    type: 'local',
    sign: unsupported,
    signMessage: unsupported,
    signTransaction: unsupported,
    signTypedData: (data: AuthorizationTypedData) => signUsdcAuthorization(address, data),
  };
}
