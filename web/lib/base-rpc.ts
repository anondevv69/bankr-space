import { http, type HttpTransport } from 'viem';

const DEFAULT_BASE_RPC = 'https://mainnet.base.org';

/** Base JSON-RPC URL — set NEXT_PUBLIC_BASE_RPC_URL on Vercel (Alchemy/Infura) to avoid public RPC rate limits. */
export function getBaseRpcUrl(): string {
  if (typeof process !== 'undefined') {
    const publicUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim();
    if (publicUrl) return publicUrl;
    if (typeof window === 'undefined') {
      const serverUrl = process.env.BASE_RPC_URL?.trim();
      if (serverUrl) return serverUrl;
    }
  }
  return DEFAULT_BASE_RPC;
}

export function createBaseHttpTransport(): HttpTransport {
  return http(getBaseRpcUrl(), {
    batch: true,
    retryCount: 2,
    retryDelay: 750,
  });
}

export function isRpcRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /rate limit/i.test(msg) ||
    /429/i.test(msg) ||
    /too many requests/i.test(msg) ||
    /over rate limit/i.test(msg)
  );
}

export function formatRpcRateLimitError(): string {
  return (
    'Base RPC is rate-limited — wait a few seconds and try Contribute again. ' +
    'If this keeps happening, the site operator should set NEXT_PUBLIC_BASE_RPC_URL to an Alchemy or Infura Base endpoint on Vercel.'
  );
}
