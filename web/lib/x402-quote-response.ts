/** Attach fund routing metadata for the browser proxy (quote URL vs witness resource base). */
export function attachX402FundMeta(
  data: Record<string, unknown>,
  options: { fundUrl: string; fundBase: string; paymentRequiredHeader?: string | null }
): Record<string, unknown> {
  const fundBase = options.fundBase.replace(/\/$/, '');
  return {
    ...data,
    x402FundUrl: options.fundUrl,
    x402FundBase: fundBase,
    x402ResourceUrl: fundBase,
    ...(options.paymentRequiredHeader ? { paymentRequiredHeader: options.paymentRequiredHeader } : {}),
  };
}
