import {
  decodePaymentRequiredHeader,
  encodePaymentRequiredHeader,
} from '@x402/core/http';
import type { PaymentRequired } from '@x402/core/types';
import { X402_EXACT_PERMIT2_PROXY_ADDRESS } from '@/lib/x402-bankr-permit2-sign';

/** Bankr quotes list payTo as permit2Spender; x402 exact requires the canonical proxy. */
function patchPermit2SpenderExtra(extra: Record<string, unknown>): Record<string, unknown> {
  if (String(extra.assetTransferMethod || '').toLowerCase() !== 'permit2') {
    return extra;
  }
  return {
    ...extra,
    permit2Spender: X402_EXACT_PERMIT2_PROXY_ADDRESS,
  };
}

/** Bankr x402 v2 accepts carry v1-shaped fields — normalize before signing. */
export function normalizeBankrPaymentRequired(raw: Record<string, unknown>): PaymentRequired {
  const accepts = Array.isArray(raw.accepts) ? (raw.accepts as Record<string, unknown>[]) : [];
  const first = accepts[0];
  if (!first) {
    throw new Error('No payment options returned by x402 endpoint');
  }

  const resourceUrl = String(first.resource || '');
  const normalizedAccepts = accepts.map((item) => ({
    scheme: String(item.scheme),
    network: String(item.network),
    asset: String(item.asset),
    amount: String(item.maxAmountRequired ?? item.amount ?? ''),
    payTo: String(item.payTo),
    maxTimeoutSeconds: Number(item.maxTimeoutSeconds ?? 60),
    extra: patchPermit2SpenderExtra((item.extra as Record<string, unknown>) || {}),
  }));

  const topResource =
    raw.resource && typeof raw.resource === 'object' && 'url' in (raw.resource as object)
      ? (raw.resource as { url: string; description?: string })
      : null;

  return {
    x402Version: Number(raw.x402Version ?? 2),
    error: String(raw.error ?? 'Payment Required'),
    resource: {
      url: topResource?.url || resourceUrl,
      description: topResource?.description || String(first.description || ''),
    },
    accepts: normalizedAccepts as PaymentRequired['accepts'],
  };
}

/** Re-encode upstream payment-required header with normalized permit2Spender. */
export function patchPaymentRequiredHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  const decoded = decodePaymentRequiredHeader(header) as Record<string, unknown>;
  const normalized = normalizeBankrPaymentRequired(decoded);
  return encodePaymentRequiredHeader(normalized);
}

export function readPaymentRequiredHeader(headers: Headers): string | null {
  return (
    headers.get('payment-required') ||
    headers.get('PAYMENT-REQUIRED') ||
    headers.get('x-payment-required') ||
    headers.get('X-PAYMENT-REQUIRED')
  );
}
