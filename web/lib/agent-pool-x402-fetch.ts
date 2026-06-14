import { buildSpaceFundUrl } from '@/lib/fundraising';
import {
  buildAgentPoolX402BaseUrl,
  buildAgentPoolX402FallbackBaseUrl,
  isX402EndpointNotFound,
} from '@/lib/x402-fund-url';
import { shouldRetrySpaceFundX402 } from '@/lib/x402-upstream';
import { readPaymentRequiredHeader } from '@/lib/x402-normalize-quote';
import { x402ProxyPaymentHeaders } from '@/lib/x402-proxy-headers';

export type AgentPoolX402FetchResult = {
  upstream: Response;
  text: string;
  data: Record<string, unknown>;
  fundUrl: string;
  fundBase: string;
  paymentRequiredHeader: string | null;
  usedFallback: boolean;
};

export async function fetchAgentPoolX402Upstream(options: {
  platformAgentWallet: string | null;
  tokenAddress: string;
  campaignId: string;
  amountUsd: number;
  xPayment?: string;
}): Promise<AgentPoolX402FetchResult | { error: string; status: number }> {
  const primaryBase = buildAgentPoolX402BaseUrl(options.platformAgentWallet);
  if (!primaryBase) {
    return {
      error: 'Community agent pool unavailable — x402 fund URL not configured',
      status: 503,
    };
  }

  const fallbackBase = buildAgentPoolX402FallbackBaseUrl();
  const bases = [primaryBase, ...(fallbackBase && fallbackBase !== primaryBase ? [fallbackBase] : [])];

  const headers: HeadersInit = options.xPayment
    ? x402ProxyPaymentHeaders(options.xPayment)
    : { Accept: 'application/json' };

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
          'agent-pool x402 primary endpoint 404, retrying shared fund URL',
          fundUrl
        );
        continue;
      }

      return {
        upstream,
        text,
        data,
        fundUrl,
        fundBase: baseUrl.replace(/\/$/, ''),
        paymentRequiredHeader: readPaymentRequiredHeader(upstream.headers),
        usedFallback,
      };
    } catch (err) {
      console.error('agent-pool x402 fetch', fundUrl, err);
      if (i === bases.length - 1) {
        return { error: 'Failed to reach x402 fund endpoint', status: 502 };
      }
    }
  }

  return { error: 'Failed to reach x402 fund endpoint', status: 502 };
}
