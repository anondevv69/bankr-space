import { x402Client, x402HTTPClient } from '@x402/core/client';
import { decodePaymentRequiredHeader } from '@x402/core/http';
import type { PaymentRequired } from '@x402/core/types';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import type { Address } from 'viem';
import { createEvmPaymentSigner } from '@/lib/x402-signer';
import { ensurePermit2TokenAllowance } from '@/lib/x402-permit2-allowance';
import { formatFacilitatorInvalidReason } from '@/lib/x402-facilitator-verify';
import { assertSpaceFundPreflight } from '@/lib/x402-fund-preflight';
import { normalizeBankrPaymentRequired } from '@/lib/x402-normalize-quote';
import {
  SPACE_FUND_X402_CREDIT_USD,
  X402_PAYMENT_TOKEN_ADDRESS,
  X402_PAYMENT_TOKEN_SYMBOL,
} from '@/lib/x402-config';
import { X402_FUND_MAX_AUTHORIZE_ATOMIC } from '@/lib/space-x402-price';
import { x402AcceptsIncludeToken } from '@/lib/x402-upstream';

/** @deprecated use SPACE_FUND_X402_CREDIT_USD */
export const SPACE_FUND_X402_MAX_USDC = SPACE_FUND_X402_CREDIT_USD;

type PayResult = {
  success?: boolean;
  raisedUsd?: number;
  goalUsd?: number;
  message?: string;
  error?: string;
};

function decodePermit2DeadlineSeconds(xPayment: string): number | null {
  try {
    const decoded = JSON.parse(atob(xPayment)) as {
      payload?: { permit2Authorization?: { deadline?: string } };
    };
    const deadline = decoded.payload?.permit2Authorization?.deadline;
    const n = deadline ? Number(deadline) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function assertPermit2NotExpired(xPayment: string): void {
  const deadline = decodePermit2DeadlineSeconds(xPayment);
  if (deadline == null) return;
  const remaining = deadline - Math.floor(Date.now() / 1000);
  if (remaining <= 0) {
    throw new Error(
      'Payment authorization already expired — you took longer than 60 seconds in MetaMask. Click Contribute again and approve immediately when the wallet opens.'
    );
  }
}

function formatPayError(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>;
    if (typeof body.x402InvalidReason === 'string') {
      return formatFacilitatorInvalidReason(body.x402InvalidReason);
    }
    if (typeof body.reason === 'string') {
      return formatFacilitatorInvalidReason(body.reason);
    }
  }
  if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
    const err = (data as { error: string }).error;
    const lower = err.toLowerCase();
    if (lower.includes('already used')) {
      return formatFacilitatorInvalidReason('payment_already_used');
    }
    if (lower.includes('deadline') && lower.includes('expir')) {
      return formatFacilitatorInvalidReason('permit2_deadline_expired');
    }
    if (lower.includes('authorization expired')) {
      return err;
    }
    return err;
  }
  if (Array.isArray(data)) {
    const messages = data
      .map((item) => {
        if (item && typeof item === 'object' && 'message' in item) {
          return String((item as { message: unknown }).message);
        }
        return null;
      })
      .filter(Boolean);
    if (messages.length) return messages.join(' ');
  }
  return `Payment failed (${status})`;
}

function createPaymentHttpClient(walletAddress: Address): x402HTTPClient {
  const { walletClient, publicClient } = createEvmPaymentSigner(walletAddress);
  const signer = toClientEvmSigner(
    {
      address: walletAddress,
      signTypedData: (message) =>
        walletClient.signTypedData({
          account: walletAddress,
          domain: message.domain,
          types: message.types,
          primaryType: message.primaryType as 'PermitWitnessTransferFrom',
          message: message.message,
        }),
    },
    publicClient
  );
  const client = new x402Client().register('eip155:8453', new ExactEvmScheme(signer));
  return new x402HTTPClient(client);
}

function parsePaymentRequired(data: unknown): PaymentRequired {
  const body = data as Record<string, unknown>;
  const raw =
    typeof body.paymentRequiredHeader === 'string' && body.paymentRequiredHeader
      ? (decodePaymentRequiredHeader(body.paymentRequiredHeader) as Record<string, unknown>)
      : body;
  return normalizeBankrPaymentRequired(raw);
}

function assertSpacePaymentQuote(data: unknown): PaymentRequired {
  const body = data as Record<string, unknown>;
  if (!x402AcceptsIncludeToken(body, X402_PAYMENT_TOKEN_ADDRESS)) {
    throw new Error(
      `Unexpected payment token — redeploy x402 fund service for $${X402_PAYMENT_TOKEN_SYMBOL}`
    );
  }
  const paymentRequired = parsePaymentRequired(data);
  const selected = paymentRequired.accepts.find(
    (item) => item.asset.toLowerCase() === X402_PAYMENT_TOKEN_ADDRESS.toLowerCase()
  );
  if (selected?.scheme.toLowerCase() === 'upto') {
    throw new Error(
      'x402 fund endpoint is still on the old upto (10M cap) deploy. From the repo root run: bankr x402 deploy — then hard-refresh and try again.'
    );
  }
  if (selected && BigInt(selected.amount) > X402_FUND_MAX_AUTHORIZE_ATOMIC) {
    throw new Error(
      'Payment authorization exceeds configured maximum — redeploy x402 fund service'
    );
  }
  return paymentRequired;
}

async function proxyX402(
  tokenAddress: string,
  campaignId: string,
  amountUsd: number,
  xPayment?: string,
  pinFundBase?: string,
  pinFundUrl?: string,
  pinPaymentRequiredHeader?: string
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`/api/communities/${tokenAddress}/fundraising/x402`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignId,
      amountUsd,
      xPayment,
      pinFundBase,
      pinFundUrl,
      pinPaymentRequiredHeader,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function proxyAgentPoolX402(
  tokenAddress: string,
  skillId: string,
  amountUsd: number,
  xPayment?: string
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`/api/communities/${tokenAddress}/agent-pool/x402`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId, amountUsd, xPayment }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function pinPaymentRequiredToFundBase(
  paymentRequired: PaymentRequired,
  fundBase: string
): PaymentRequired {
  const resourceUrl = fundBase.replace(/\/$/, '');
  return {
    ...paymentRequired,
    resource: {
      ...paymentRequired.resource,
      url: resourceUrl,
    },
    accepts: paymentRequired.accepts.map((item) => ({
      ...item,
      ...(typeof item === 'object' && item && 'resource' in item
        ? { resource: resourceUrl }
        : {}),
    })) as PaymentRequired['accepts'],
  };
}

async function signAndPay(
  walletAddress: Address,
  quoteData: unknown,
  amountUsd: number,
  retry: (
    paymentHeader: string,
    pinFundBase?: string,
    pinFundUrl?: string,
    pinPaymentRequiredHeader?: string
  ) => Promise<{ status: number; data: unknown }>,
  onProgress?: (message: string) => void
): Promise<PayResult> {
  const paymentRequired = assertSpacePaymentQuote(quoteData);
  const pinFundBase =
    typeof (quoteData as { x402FundBase?: string }).x402FundBase === 'string'
      ? (quoteData as { x402FundBase: string }).x402FundBase
      : typeof (quoteData as { x402ResourceUrl?: string }).x402ResourceUrl === 'string'
        ? (quoteData as { x402ResourceUrl: string }).x402ResourceUrl
        : undefined;
  const pinFundUrl =
    typeof (quoteData as { x402FundUrl?: string }).x402FundUrl === 'string'
      ? (quoteData as { x402FundUrl: string }).x402FundUrl
      : undefined;
  const pinPaymentRequiredHeader =
    typeof (quoteData as { paymentRequiredHeader?: string }).paymentRequiredHeader === 'string'
      ? (quoteData as { paymentRequiredHeader: string }).paymentRequiredHeader
      : undefined;

  const fundBase =
    pinFundBase?.replace(/\/$/, '') ||
    (pinFundUrl ? pinFundUrl.split('?')[0].replace(/\/$/, '') : '') ||
    paymentRequired.resource.url.replace(/\/$/, '');

  onProgress?.('Step 2 of 2 — sign the payment in MetaMask (within 60 seconds).');

  const httpClient = createPaymentHttpClient(walletAddress);
  const payload = await httpClient.createPaymentPayload(
    pinPaymentRequiredToFundBase(paymentRequired, fundBase)
  );
  const payHeaders = httpClient.encodePaymentSignatureHeader(payload);
  const xPayment =
    payHeaders['PAYMENT-SIGNATURE'] ||
    payHeaders['X-PAYMENT'] ||
    payHeaders['payment-signature'] ||
    Object.values(payHeaders)[0];

  if (!xPayment) {
    throw new Error('Failed to build x402 payment header');
  }

  assertPermit2NotExpired(xPayment);

  const paid = await retry(xPayment, fundBase, pinFundUrl, pinPaymentRequiredHeader);
  if (paid.status >= 400) {
    throw new Error(formatPayError(paid.data, paid.status));
  }
  return paid.data as PayResult;
}

export async function paySpaceFund(
  walletAddress: Address,
  tokenAddress: string,
  campaignId: string,
  amountUsd: number,
  onProgress?: (message: string) => void
): Promise<PayResult> {
  onProgress?.('Step 1 of 2 — checking one-time Permit2 approval for $Space…');
  const allowance = await ensurePermit2TokenAllowance(
    walletAddress,
    X402_PAYMENT_TOKEN_ADDRESS as Address,
    X402_FUND_MAX_AUTHORIZE_ATOMIC,
    onProgress
  );
  if (allowance === 'approved') {
    onProgress?.('Permit2 approved on-chain — checking balance…');
  } else {
    onProgress?.('Permit2 already approved — checking balance…');
  }

  onProgress?.('Checking $Space balance…');
  await assertSpaceFundPreflight(walletAddress, amountUsd, X402_FUND_MAX_AUTHORIZE_ATOMIC);

  const { status, data } = await proxyX402(tokenAddress, campaignId, amountUsd);

  const body = data as { requiresPayment?: boolean };
  const isQuote = status === 402 || (status === 200 && body.requiresPayment);
  if (!isQuote) {
    if (status >= 400) {
      throw new Error(formatPayError(data, status));
    }
    return data as PayResult;
  }

  return signAndPay(
    walletAddress,
    data,
    amountUsd,
    (xPayment, pinFundBase, pinFundUrl, pinPaymentRequiredHeader) =>
      proxyX402(
        tokenAddress,
        campaignId,
        amountUsd,
        xPayment,
        pinFundBase,
        pinFundUrl,
        pinPaymentRequiredHeader
      ),
    (msg) => {
      if (msg.includes('Step 2') || msg.includes('MetaMask')) {
        onProgress?.(msg);
      } else {
        onProgress?.(msg);
      }
    }
  );
}

/** Lane B — community agent pool; x402 pay-to is PLATFORM_AGENT_WALLET. */
export async function payAgentPoolFund(
  walletAddress: Address,
  tokenAddress: string,
  skillId: string,
  amountUsd: number,
  onProgress?: (message: string) => void
): Promise<PayResult> {
  onProgress?.('Checking Permit2 allowance for $Space…');
  await ensurePermit2TokenAllowance(
    walletAddress,
    X402_PAYMENT_TOKEN_ADDRESS as Address,
    X402_FUND_MAX_AUTHORIZE_ATOMIC,
    onProgress
  );

  const { status, data } = await proxyAgentPoolX402(tokenAddress, skillId, amountUsd);

  const body = data as { requiresPayment?: boolean };
  const isQuote = status === 402 || (status === 200 && body.requiresPayment);
  if (!isQuote) {
    if (status >= 400) {
      throw new Error(formatPayError(data, status));
    }
    return data as PayResult;
  }

  return signAndPay(
    walletAddress,
    data,
    amountUsd,
    (xPayment) => proxyAgentPoolX402(tokenAddress, skillId, amountUsd, xPayment),
    onProgress
  );
}

/** One-time Permit2 setup without paying (Step 1 only). */
export async function setupPermit2ForSpace(
  walletAddress: Address,
  onProgress?: (message: string) => void
): Promise<'ready' | 'approved'> {
  return ensurePermit2TokenAllowance(
    walletAddress,
    X402_PAYMENT_TOKEN_ADDRESS as Address,
    X402_FUND_MAX_AUTHORIZE_ATOMIC,
    onProgress
  );
}
