import { buildSpaceFundUrl } from '@/lib/fundraising';
import {
  buildFundraisingX402BaseUrl,
  buildFundraisingX402FallbackBaseUrl,
  isX402EndpointNotFound,
} from '@/lib/x402-fund-url';
import { readPaymentRequiredHeader } from '@/lib/x402-normalize-quote';
import { shouldRetrySpaceFundX402 } from '@/lib/x402-upstream';
import { x402ProxyPaymentHeaders } from '@/lib/x402-proxy-headers';

export type FundraisingX402FetchResult = {
  upstream: Response;
  data: Record<string, unknown>;
  fundUrl: string;
  fundBase: string;
  paymentRequiredHeader: string | null;
  usedFallback: boolean;
};

async function fetchFundUrl(
  fundUrl: string,
  headers: HeadersInit
): Promise<{ upstream: Response; data: Record<string, unknown> }> {
  const upstream = await fetch(fundUrl, { headers, cache: 'no-store' });
  const text = await upstream.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { error: text.slice(0, 200) || 'Non-JSON response from x402' };
  }
  return { upstream, data };
}

function fundBaseFromUrl(fundUrl: string): string {
  return fundUrl.split('?')[0].replace(/\/$/, '');
}

function buildResult(
  upstream: Response,
  data: Record<string, unknown>,
  fundUrl: string,
  usedFallback: boolean
): FundraisingX402FetchResult {
  return {
    upstream,
    data,
    fundUrl,
    fundBase: fundBaseFromUrl(fundUrl),
    paymentRequiredHeader: readPaymentRequiredHeader(upstream.headers),
    usedFallback,
  };
}

export async function fetchFundraisingX402Upstream(options: {
  beneficiaryWallet: string | null;
  tokenAddress: string;
  campaignId: string;
  amountUsd: number;
  xPayment?: string;
  pinBaseUrl?: string | null;
  pinFundUrl?: string | null;
}): Promise<FundraisingX402FetchResult | { error: string; status: number }> {
  const primaryBase = buildFundraisingX402BaseUrl(options.beneficiaryWallet);
  const fallbackBase = buildFundraisingX402FallbackBaseUrl();

  if (!primaryBase && !fallbackBase && !options.pinBaseUrl && !options.pinFundUrl) {
    return {
      error: 'x402 fundraising is not available — fee recipient wallet not found',
      status: 503,
    };
  }

  const headers: HeadersInit = options.xPayment
    ? x402ProxyPaymentHeaders(options.xPayment)
    : { Accept: 'application/json' };

  // Permit2 signatures are single-use — never retry payment on another URL with the same header.
  if (options.xPayment) {
    const fundUrl =
      options.pinFundUrl ||
      buildSpaceFundUrl(
        options.pinBaseUrl || primaryBase || fallbackBase!,
        options.tokenAddress,
        options.campaignId,
        options.amountUsd
      );
    try {
      const { upstream, data } = await fetchFundUrl(fundUrl, headers);
      return buildResult(upstream, data, fundUrl, Boolean(fallbackBase && fundBaseFromUrl(fundUrl) === fallbackBase.replace(/\/$/, '')));
    } catch (err) {
      console.error('fundraising x402 payment fetch', fundUrl, err);
      return { error: 'Failed to reach x402 fund endpoint', status: 502 };
    }
  }

  const bases = ([
    primaryBase || fallbackBase!,
    ...(fallbackBase && primaryBase && fallbackBase !== primaryBase ? [fallbackBase] : []),
  ].filter(Boolean) as string[]);

  for (let i = 0; i < bases.length; i++) {
    const baseUrl = bases[i];
    const fundUrl = buildSpaceFundUrl(
      baseUrl,
      options.tokenAddress,
      options.campaignId,
      options.amountUsd
    );

    try {
      const { upstream, data } = await fetchFundUrl(fundUrl, headers);
      const usedFallback = Boolean(i > 0 && fallbackBase && baseUrl === fallbackBase);
      const shouldRetry =
        i === 0 &&
        bases.length > 1 &&
        (isX402EndpointNotFound(upstream.status, data) ||
          shouldRetrySpaceFundX402(upstream.status, data));

      if (shouldRetry) {
        console.warn(
          'fundraising x402 retrying shared Space fund URL',
          'legacy or missing endpoint',
          fundUrl
        );
        continue;
      }

      return buildResult(upstream, data, fundUrl, usedFallback);
    } catch (err) {
      console.error('fundraising x402 fetch', fundUrl, err);
      if (i === bases.length - 1) {
        return { error: 'Failed to reach x402 fund endpoint', status: 502 };
      }
    }
  }

  return { error: 'Failed to reach x402 fund endpoint', status: 502 };
}
