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
  fundBase: string;
  usedFallback: boolean;
};

export async function fetchFundraisingX402Upstream(options: {
  beneficiaryWallet: string | null;
  tokenAddress: string;
  campaignId: string;
  amountUsd: number;
  xPayment?: string;
  /** When set, quote and payment must hit the same x402 base (Permit2 witness is URL-bound). */
  pinBaseUrl?: string | null;
}): Promise<FundraisingX402FetchResult | { error: string; status: number }> {
  const primaryBase = buildFundraisingX402BaseUrl(options.beneficiaryWallet);
  if (!primaryBase && !options.pinBaseUrl) {
    return {
      error: 'x402 fundraising is not available — fee recipient wallet not found',
      status: 503,
    };
  }

  const fallbackBase = buildFundraisingX402FallbackBaseUrl();
  const bases = options.pinBaseUrl
    ? [options.pinBaseUrl]
    : [
        primaryBase || fallbackBase!,
        ...(fallbackBase && primaryBase && fallbackBase !== primaryBase ? [fallbackBase] : []),
      ].filter(Boolean) as string[];

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

      const usedFallback = Boolean(
        !options.pinBaseUrl && i > 0 && fallbackBase && baseUrl === fallbackBase
      );
      const shouldRetry =
        !options.pinBaseUrl &&
        i === 0 &&
        bases.length > 1 &&
        (isX402EndpointNotFound(upstream.status, data) ||
          shouldRetrySpaceFundX402(upstream.status, data) ||
          (options.xPayment && shouldRetryX402Payment(upstream.status, data)));

      if (shouldRetry) {
        console.warn(
          'fundraising x402 retrying shared Space fund URL',
          options.xPayment ? 'payment mismatch' : 'legacy or missing endpoint',
          fundUrl
        );
        continue;
      }

      return {
        upstream,
        data,
        fundUrl,
        fundBase: baseUrl,
        usedFallback,
      };
    } catch (err) {
      console.error('fundraising x402 fetch', fundUrl, err);
      if (i === bases.length - 1) {
        return { error: 'Failed to reach x402 fund endpoint', status: 502 };
      }
    }
  }

  return { error: 'Failed to reach x402 fund endpoint', status: 502 };
}

function shouldRetryX402Payment(status: number, data: Record<string, unknown>): boolean {
  if (status === 402) return true;
  const err = String(data.error || '').toLowerCase();
  return (
    err.includes('already used') ||
    err.includes('invalid payment') ||
    err.includes('payment required') ||
    err.includes('unexpected payment')
  );
}
