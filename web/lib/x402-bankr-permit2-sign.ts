import type { PaymentPayload, PaymentRequired } from '@x402/core/types';
import { permit2WitnessTypes, uptoPermit2WitnessTypes } from '@x402/evm';
import { getAddress, toHex, type Address, type Hex } from 'viem';
import { createEvmPaymentSigner } from '@/lib/x402-signer';

const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address;

function evmChainId(network: string): number {
  const match = network.match(/^eip155:(\d+)$/);
  if (!match) throw new Error(`Unsupported x402 network: ${network}`);
  return Number(match[1]);
}

function createPermit2Nonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return BigInt(toHex(bytes)).toString();
}

function readPermit2Spender(requirements: PaymentRequired['accepts'][number]): Address {
  const extra = requirements.extra as Record<string, unknown> | undefined;
  const fromExtra =
    typeof extra?.permit2Spender === 'string' ? extra.permit2Spender.trim() : '';
  if (fromExtra) return getAddress(fromExtra);
  return getAddress(requirements.payTo);
}

/** Bankr settlement expects `amount` and a resource URL pinned to the signed /fund base. */
export function pinAcceptedForBankrPayload(
  raw: PaymentRequired['accepts'][number] | undefined,
  requirements: PaymentRequired['accepts'][number],
  fundBase: string
): PaymentRequired['accepts'][number] {
  const record = (raw ?? requirements) as Record<string, unknown>;
  const amount = String(record.maxAmountRequired ?? record.amount ?? requirements.amount);
  const extra =
    (record.extra as Record<string, unknown> | undefined) ??
    (requirements.extra as Record<string, unknown> | undefined) ??
    {};
  return {
    scheme: String(record.scheme ?? requirements.scheme),
    network: String(record.network ?? requirements.network),
    asset: String(record.asset ?? requirements.asset),
    amount,
    payTo: String(record.payTo ?? requirements.payTo),
    maxTimeoutSeconds: Number(record.maxTimeoutSeconds ?? requirements.maxTimeoutSeconds),
    extra,
    resource: fundBase,
  } as PaymentRequired['accepts'][number];
}

function serializePermit2MessageForWallet(
  message: Record<string, unknown>
): Record<string, unknown> {
  const permitted = message.permitted as { token: string; amount: bigint };
  const witness = message.witness as Record<string, unknown>;
  const serializedWitness: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(witness)) {
    serializedWitness[key] =
      typeof value === 'bigint' ? value.toString() : value;
  }
  return {
    permitted: {
      token: permitted.token,
      amount: permitted.amount.toString(),
    },
    spender: message.spender,
    nonce: (message.nonce as bigint).toString(),
    deadline: (message.deadline as bigint).toString(),
    witness: serializedWitness,
  };
}

async function signPermit2WitnessTransfer(
  walletAddress: Address,
  chainId: number,
  types: typeof permit2WitnessTypes | typeof uptoPermit2WitnessTypes,
  message: Record<string, unknown>
): Promise<Hex> {
  const account = getAddress(walletAddress);
  const domain = { name: 'Permit2', chainId, verifyingContract: PERMIT2_ADDRESS };
  const { walletClient } = createEvmPaymentSigner(account);

  if (typeof walletClient.signTypedData === 'function') {
    return walletClient.signTypedData({
      account,
      domain,
      types,
      primaryType: 'PermitWitnessTransferFrom',
      message: message as never,
    });
  }

  if (typeof window === 'undefined') {
    throw new Error('Wallet signing is only available in the browser.');
  }
  const provider = (window as Window & { ethereum?: { request: (args: unknown) => Promise<unknown> } })
    .ethereum;
  if (!provider?.request) {
    throw new Error('No browser wallet found for Permit2 signing.');
  }

  const signature = await provider.request({
    method: 'eth_signTypedData_v4',
    params: [
      account,
      JSON.stringify({
        domain,
        types,
        primaryType: 'PermitWitnessTransferFrom',
        message: serializePermit2MessageForWallet(message),
      }),
    ],
  });
  return signature as Hex;
}

/** Bankr x402 Cloud quotes fee-router Permit2 spenders — sign for that, not the x402 proxy. */
export async function createBankrExactPermit2PaymentPayload(
  walletAddress: Address,
  paymentRequired: PaymentRequired,
  acceptedOverride?: PaymentRequired['accepts'][number],
  fundBase?: string
): Promise<PaymentPayload> {
  const requirements = paymentRequired.accepts.find(
    (item) => item.scheme.toLowerCase() === 'exact'
  );
  if (!requirements) {
    throw new Error('No exact payment option in x402 quote');
  }

  const extra = (requirements.extra as Record<string, unknown> | undefined) ?? {};

  const transferMethod = String(extra.assetTransferMethod || '').toLowerCase();
  if (transferMethod !== 'permit2') {
    throw new Error('Bankr Space fundraising requires Permit2 payments');
  }

  const spender = readPermit2Spender(requirements);
  const payTo = getAddress(requirements.payTo);
  const now = Math.floor(Date.now() / 1000);
  const validAfter = '0';
  const deadline = (now + requirements.maxTimeoutSeconds).toString();
  const nonce = createPermit2Nonce();
  const chainId = evmChainId(requirements.network);

  const facilitatorAddress =
    typeof extra.facilitatorAddress === 'string' ? extra.facilitatorAddress.trim() : '';
  const useFeeRouterWitness = facilitatorAddress.length > 0;

  const permit2Authorization = useFeeRouterWitness
    ? {
        from: getAddress(walletAddress),
        permitted: { token: getAddress(requirements.asset), amount: requirements.amount },
        spender,
        nonce,
        deadline,
        witness: {
          to: payTo,
          facilitator: getAddress(facilitatorAddress),
          validAfter,
        },
      }
    : {
        from: getAddress(walletAddress),
        permitted: { token: getAddress(requirements.asset), amount: requirements.amount },
        spender,
        nonce,
        deadline,
        witness: { to: payTo, validAfter },
      };

  const message = {
    permitted: {
      token: getAddress(permit2Authorization.permitted.token),
      amount: BigInt(permit2Authorization.permitted.amount),
    },
    spender: permit2Authorization.spender,
    nonce: BigInt(permit2Authorization.nonce),
    deadline: BigInt(permit2Authorization.deadline),
    witness: useFeeRouterWitness
      ? {
          to: (permit2Authorization.witness as { to: Address; facilitator: Address }).to,
          facilitator: (permit2Authorization.witness as { to: Address; facilitator: Address })
            .facilitator,
          validAfter: BigInt(permit2Authorization.witness.validAfter),
        }
      : {
          to: (permit2Authorization.witness as { to: Address }).to,
          validAfter: BigInt(permit2Authorization.witness.validAfter),
        },
  };

  const signature = await signPermit2WitnessTransfer(
    walletAddress,
    chainId,
    useFeeRouterWitness ? uptoPermit2WitnessTypes : permit2WitnessTypes,
    message
  );

  const pinnedBase = fundBase?.replace(/\/$/, '') || paymentRequired.resource.url.replace(/\/$/, '');
  const accepted = pinAcceptedForBankrPayload(acceptedOverride, requirements, pinnedBase);

  return {
    x402Version: paymentRequired.x402Version,
    payload: {
      signature: signature as Hex,
      permit2Authorization,
    },
    resource: {
      ...paymentRequired.resource,
      url: pinnedBase,
    },
    accepted,
  };
}

export function readRawAcceptedFromPaymentHeader(
  paymentRequiredHeader?: string | null
): PaymentRequired['accepts'][number] | undefined {
  if (!paymentRequiredHeader) return undefined;
  try {
    const req = JSON.parse(atob(paymentRequiredHeader)) as {
      accepts?: PaymentRequired['accepts'];
    };
    return req.accepts?.[0];
  } catch {
    return undefined;
  }
}
