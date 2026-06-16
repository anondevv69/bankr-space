import type { PaymentPayload, PaymentRequired } from '@x402/core/types';
import { getAddress, toHex, type Address, type Hex } from 'viem';
import { createEvmPaymentSigner } from '@/lib/x402-signer';

const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address;

/** Bankr fee router uses payTo as Permit2 spender — not the x402 exact proxy. */
const bankrPermit2WitnessTypes = {
  PermitWitnessTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'witness', type: 'Witness' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  Witness: [
    { name: 'to', type: 'address' },
    { name: 'validAfter', type: 'uint256' },
  ],
} as const;

/**
 * Bankr fee-router endpoints include `extra.facilitatorAddress`, which means the
 * on-chain contract verifies against the upto-style Permit2 witness that has a
 * `facilitator` field.  Using the plain two-field witness produces a different
 * type-hash and always fails with `invalid_permit2_signature`.
 */
const bankrFeeRouterPermit2WitnessTypes = {
  PermitWitnessTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'witness', type: 'Witness' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  Witness: [
    { name: 'to', type: 'address' },
    { name: 'facilitator', type: 'address' },
    { name: 'validAfter', type: 'uint256' },
  ],
} as const;

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

/** Bankr x402 Cloud quotes fee-router Permit2 spenders — sign for that, not the x402 proxy. */
export async function createBankrExactPermit2PaymentPayload(
  walletAddress: Address,
  paymentRequired: PaymentRequired,
  acceptedOverride?: PaymentRequired['accepts'][number]
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

  // Bankr fee-router endpoints include `facilitatorAddress` in extra — those contracts
  // verify against the three-field upto witness (to, facilitator, validAfter).
  // Plain endpoints use the two-field exact witness (to, validAfter).
  const facilitatorAddress =
    typeof extra.facilitatorAddress === 'string' ? extra.facilitatorAddress.trim() : '';
  const useFeeRouterWitness = facilitatorAddress.length > 0;

  const permit2Authorization = useFeeRouterWitness
    ? {
        from: walletAddress,
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
        from: walletAddress,
        permitted: { token: getAddress(requirements.asset), amount: requirements.amount },
        spender,
        nonce,
        deadline,
        witness: { to: payTo, validAfter },
      };

  const { walletClient } = createEvmPaymentSigner(walletAddress);
  const chainId = evmChainId(requirements.network);

  let signature: Hex;
  if (useFeeRouterWitness) {
    const auth = permit2Authorization as typeof permit2Authorization & {
      witness: { to: Address; facilitator: Address; validAfter: string };
    };
    signature = await walletClient.signTypedData({
      account: walletAddress,
      domain: { name: 'Permit2', chainId, verifyingContract: PERMIT2_ADDRESS },
      types: bankrFeeRouterPermit2WitnessTypes,
      primaryType: 'PermitWitnessTransferFrom',
      message: {
        permitted: {
          token: auth.permitted.token,
          amount: BigInt(auth.permitted.amount),
        },
        spender: auth.spender,
        nonce: BigInt(auth.nonce),
        deadline: BigInt(auth.deadline),
        witness: {
          to: auth.witness.to,
          facilitator: auth.witness.facilitator,
          validAfter: BigInt(auth.witness.validAfter),
        },
      },
    });
  } else {
    const auth = permit2Authorization as typeof permit2Authorization & {
      witness: { to: Address; validAfter: string };
    };
    signature = await walletClient.signTypedData({
      account: walletAddress,
      domain: { name: 'Permit2', chainId, verifyingContract: PERMIT2_ADDRESS },
      types: bankrPermit2WitnessTypes,
      primaryType: 'PermitWitnessTransferFrom',
      message: {
        permitted: {
          token: auth.permitted.token,
          amount: BigInt(auth.permitted.amount),
        },
        spender: auth.spender,
        nonce: BigInt(auth.nonce),
        deadline: BigInt(auth.deadline),
        witness: {
          to: auth.witness.to,
          validAfter: BigInt(auth.witness.validAfter),
        },
      },
    });
  }

  return {
    x402Version: paymentRequired.x402Version,
    payload: {
      signature: signature as Hex,
      permit2Authorization,
    },
    resource: paymentRequired.resource,
    accepted: acceptedOverride ?? requirements,
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
