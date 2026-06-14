import { X402_PAYMENT_TOKEN_ADDRESS } from '@/lib/x402-config';

export function x402AcceptsIncludeToken(
  data: Record<string, unknown>,
  tokenAddress: string
): boolean {
  const accepts = data.accepts;
  if (!Array.isArray(accepts)) return false;
  const want = tokenAddress.toLowerCase();
  return accepts.some(
    (item) =>
      item &&
      typeof item === 'object' &&
      String((item as { asset?: string }).asset || '').toLowerCase() === want
  );
}

/** Retry shared Space deploy when beneficiary path 404s or still serves legacy USDC. */
export function shouldRetrySpaceFundX402(
  status: number,
  data: Record<string, unknown>
): boolean {
  const isQuote = status === 402 || (status === 200 && data.requiresPayment === true);
  if (!isQuote) return false;
  return !x402AcceptsIncludeToken(data, X402_PAYMENT_TOKEN_ADDRESS);
}
