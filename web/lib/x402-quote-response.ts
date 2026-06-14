/**
 * Attach resource URL for Permit2 witness signing.
 * Bankr x402 advertises the base `/fund` path (no query); payment GET still uses `fundUrl` with ?token=&campaign=&amount=.
 */
export function enrichX402QuoteBody(
  data: Record<string, unknown>,
  options: { fundUrl: string; fundBase: string }
): Record<string, unknown> {
  const accepts = Array.isArray(data.accepts) ? data.accepts : [];
  const first = accepts[0] as Record<string, unknown> | undefined;
  const description = first?.description ? String(first.description) : '';
  const resourceUrl = options.fundBase.replace(/\/$/, '');

  return {
    ...data,
    resource: { url: resourceUrl, description },
    accepts: accepts.map((item) =>
      item && typeof item === 'object'
        ? { ...(item as Record<string, unknown>), resource: resourceUrl }
        : item
    ),
    x402FundUrl: options.fundUrl,
    x402ResourceUrl: resourceUrl,
  };
}
