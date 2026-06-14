/** Bind x402 Permit2 witness to the exact fund URL (including token/campaign query params). */
export function enrichX402QuoteBody(
  data: Record<string, unknown>,
  fundUrl: string
): Record<string, unknown> {
  const accepts = Array.isArray(data.accepts) ? data.accepts : [];
  const first = accepts[0] as Record<string, unknown> | undefined;
  const description = first?.description ? String(first.description) : '';

  return {
    ...data,
    resource: { url: fundUrl, description },
    accepts: accepts.map((item) =>
      item && typeof item === 'object'
        ? { ...(item as Record<string, unknown>), resource: fundUrl }
        : item
    ),
    x402FundUrl: fundUrl,
  };
}
