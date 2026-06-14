import { x402Client, x402HTTPClient } from '@x402/core/client';
import type { PaymentRequired } from '@x402/core/types';
import { ExactEvmScheme, UptoEvmScheme, toClientEvmSigner } from '@x402/evm';
import type { Address } from 'viem';
import { createEvmPaymentSigner } from '@/lib/x402-signer';
import { ensurePermit2TokenAllowance } from '@/lib/x402-permit2-allowance';
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

function formatPayError(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
    return (data as { error: string }).error;
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
  const client = new x402Client()
    .register('eip155:8453', new UptoEvmScheme(signer))
    .register('eip155:8453', new ExactEvmScheme(signer));
  return new x402HTTPClient(client);
}

function toPaymentRequired(data: unknown): PaymentRequired {
  const body = data as Record<string, unknown>;
  if (!Array.isArray(body.accepts) || body.accepts.length === 0) {
    throw new Error('No payment options returned by x402 endpoint');
  }

  const rawAccepts = body.accepts as Record<string, unknown>[];
  const firstAccept = rawAccepts[0];
  const resourceUrl =
    typeof body.x402ResourceUrl === 'string'
      ? body.x402ResourceUrl
      : body.resource &&
          typeof body.resource === 'object' &&
          'url' in (body.resource as object)
        ? String((body.resource as { url: string }).url)
        : String(firstAccept.resource || 'https://x402.bankr.bot/fund');

  const accepts = rawAccepts.map((item) => ({
    scheme: String(item.scheme),
    network: String(item.network),
    asset: String(item.asset),
    amount: String(item.amount ?? item.maxAmountRequired ?? ''),
    payTo: String(item.payTo),
    maxTimeoutSeconds: Number(item.maxTimeoutSeconds ?? 60),
    extra: (item.extra as Record<string, unknown>) || {},
    resource: resourceUrl,
  }));

  return {
    x402Version: Number(body.x402Version ?? 2),
    error: String(body.error ?? 'Payment Required'),
    resource: {
      url: resourceUrl,
      description: String(firstAccept.description || ''),
    },
    accepts: accepts as PaymentRequired['accepts'],
  };
}

function assertSpacePaymentQuote(data: unknown): PaymentRequired {
  const body = data as Record<string, unknown>;
  if (!x402AcceptsIncludeToken(body, X402_PAYMENT_TOKEN_ADDRESS)) {
    throw new Error(
      `Unexpected payment token — redeploy x402 fund service for $${X402_PAYMENT_TOKEN_SYMBOL}`
    );
  }
  const paymentRequired = toPaymentRequired(data);
  const selected = paymentRequired.accepts.find(
    (item) => item.asset.toLowerCase() === X402_PAYMENT_TOKEN_ADDRESS.toLowerCase()
  );
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
  pinFundBase?: string
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`/api/communities/${tokenAddress}/fundraising/x402`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, amountUsd, xPayment, pinFundBase }),
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

async function signAndPay(
  walletAddress: Address,
  quoteData: unknown,
  retry: (paymentHeader: string, pinFundBase?: string) => Promise<{ status: number; data: unknown }>,
  onProgress?: (message: string) => void
): Promise<PayResult> {
  const paymentRequired = assertSpacePaymentQuote(quoteData);
  const pinFundBase =
    typeof (quoteData as { x402FundBase?: string }).x402FundBase === 'string'
      ? (quoteData as { x402FundBase: string }).x402FundBase
      : undefined;
  const selected = paymentRequired.accepts.find(
    (item) => item.asset.toLowerCase() === X402_PAYMENT_TOKEN_ADDRESS.toLowerCase()
  );
  const authorizeAmount = selected ? BigInt(selected.amount) : X402_FUND_MAX_AUTHORIZE_ATOMIC;

  onProgress?.('Checking Permit2 allowance for $Space…');
  const allowance = await ensurePermit2TokenAllowance(
    walletAddress,
    X402_PAYMENT_TOKEN_ADDRESS as Address,
    authorizeAmount
  );
  if (allowance === 'approved') {
    onProgress?.('Permit2 approved — sign the contribution in your wallet…');
  } else {
    onProgress?.('Sign the Permit2 contribution in your wallet…');
  }

  const httpClient = createPaymentHttpClient(walletAddress);
  const payload = await httpClient.createPaymentPayload(paymentRequired);
  const payHeaders = httpClient.encodePaymentSignatureHeader(payload);
  const xPayment =
    payHeaders['PAYMENT-SIGNATURE'] ||
    payHeaders['X-PAYMENT'] ||
    payHeaders['payment-signature'] ||
    Object.values(payHeaders)[0];

  if (!xPayment) {
    throw new Error('Failed to build x402 payment header');
  }

  const paid = await retry(xPayment, pinFundBase);
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
    (xPayment, pinFundBase) =>
      proxyX402(tokenAddress, campaignId, amountUsd, xPayment, pinFundBase),
    onProgress
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
    (xPayment) => proxyAgentPoolX402(tokenAddress, skillId, amountUsd, xPayment),
    onProgress
  );
}
