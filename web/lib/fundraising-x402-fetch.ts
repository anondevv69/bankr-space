import { buildSpaceFundUrl } from '@/lib/fundraising';
import {
  buildFundraisingX402BaseUrl,
  buildFundraisingX402FallbackBaseUrl,
  isX402EndpointNotFound,
} from '@/lib/x402-fund-url';
import { shouldRetrySpaceFundX402 } from '@/lib/x402-upstream';

export type FundraisingX402FetchResult = {
  upstream: Response;
  data: Record<string, unknown>;
  fundUrl: string;
  usedFallback: boolean;
};

export async function fetchFundraisingX402Upstream(options: {
  beneficiaryWallet: string | null;
  tokenAddress: string;
  campaignId: string;
  amountUsd: number;
  xPayment?: string;
}): Promise<FundraisingX402FetchResult | { error: string; status: number }> {
  const primaryBase = buildFundraisingX402BaseUrl(options.beneficiaryWallet);
  if (!primaryBase) {
    return {
      error: 'x402 fundraising is not available — fee recipient wallet not found',
      status: 503,
    };
  }

  const fallbackBase = buildFundraisingX402FallbackBaseUrl();
  const bases = [primaryBase, ...(fallbackBase && fallbackBase !== primaryBase ? [fallbackBase] : [])];

  const headers: HeadersInit = { Accept: 'application/json' };
  if (options.xPayment) {
    headers['X-PAYMENT'] = options.xPayment;
    headers['Access-Control-Expose-Headers'] = 'X-PAYMENT-RESPONSE';
  }

  for (let i = 0; i < bases.length; i++) {
    const baseUrl = bases[i];
    const fundUrl = buildSpaceFundUrl(
      baseUrl,
      options.tokenAddress,
      options.campaignId,
      options.amountUsd
    );

    try {
      const upstream = await fetch(fundUrl, { headers, cache: 'no-store' });
      const text = await upstream.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        data = { error: text.slice(0, 200) || 'Non-JSON response from x402' };
      }

      const usedFallback = i > 0;
      const shouldRetry =
        i === 0 &&
        bases.length > 1 &&
        (isX402EndpointNotFound(upstream.status, data) ||
          shouldRetrySpaceFundX402(upstream.status, data));

      if (shouldRetry) {
        console.warn(
          'fundraising x402 primary endpoint unavailable or legacy USDC — retrying shared Space fund URL',
          fundUrl
        );
        continue;
      }

      return { upstream, data, fundUrl, usedFallback };
    } catch (err) {
      console.error('fundraising x402 fetch', fundUrl, err);
      if (i === bases.length - 1) {
        return { error: 'Failed to reach x402 fund endpoint', status: 502 };
      }
    }
  }

  return { error: 'Failed to reach x402 fund endpoint', status: 502 };
}
