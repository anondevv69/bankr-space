import type { TokenMarketStats } from '@/lib/types';

const DEXSCREENER_BASE = 'https://api.dexscreener.com';
const CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_BATCH = 20;

type DexPair = {
  chainId?: string;
  url?: string;
  liquidity?: { usd?: number | null };
  marketCap?: number | null;
  fdv?: number | null;
  priceUsd?: string | null;
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
  info?: {
    imageUrl?: string | null;
    header?: string | null;
    openGraph?: string | null;
  };
};

type DexOrder = {
  type?: string;
  status?: string;
  paymentTimestamp?: number;
};

type CacheEntry = {
  data: TokenMarketStats;
  expires: number;
};

const cache = new Map<string, CacheEntry>();

function cacheKey(chainId: string, tokenAddress: string): string {
  return `${chainId}:${tokenAddress.toLowerCase()}`;
}

function normalizeChain(chain: string | undefined): string {
  const value = String(chain || 'base').trim().toLowerCase();
  if (value === 'base-mainnet') return 'base';
  return value || 'base';
}

function pickPrimaryPair(pairs: DexPair[]): DexPair | null {
  if (!pairs.length) return null;
  return [...pairs].sort(
    (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
  )[0];
}

function emptyStats(tokenAddress: string, chainId: string): TokenMarketStats {
  return {
    tokenAddress: tokenAddress.toLowerCase(),
    chainId,
    found: false,
    marketCap: null,
    fdv: null,
    priceUsd: null,
    volume24h: null,
    priceChange24h: null,
    liquidityUsd: null,
    txns24h: null,
    dexUrl: null,
    bannerUrl: null,
    iconUrl: null,
    dexScreener: {
      enhancedInfoPaid: false,
      enhancedInfoStatus: null,
      boostActive: false,
    },
    fetchedAt: Date.now(),
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 180 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchTokenMarketStats(
  tokenAddress: string,
  chain = 'base'
): Promise<TokenMarketStats> {
  const chainId = normalizeChain(chain);
  const address = tokenAddress.toLowerCase();
  const key = cacheKey(chainId, address);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const [pairs, ordersData] = await Promise.all([
    fetchJson<DexPair[]>(
      `${DEXSCREENER_BASE}/token-pairs/v1/${chainId}/${address}`
    ),
    fetchJson<{ orders?: DexOrder[]; boosts?: unknown[] }>(
      `${DEXSCREENER_BASE}/orders/v1/${chainId}/${address}`
    ),
  ]);

  const pairList = Array.isArray(pairs) ? pairs : [];
  const primary = pickPrimaryPair(pairList);
  if (!primary) {
    const stats = emptyStats(address, chainId);
    cache.set(key, { data: stats, expires: Date.now() + CACHE_TTL_MS });
    return stats;
  }

  const orders = ordersData?.orders || [];
  const tokenProfile = orders.find((order) => order.type === 'tokenProfile');
  const enhancedInfoPaid =
    tokenProfile?.status === 'approved' || tokenProfile?.status === 'processing';

  const stats: TokenMarketStats = {
    tokenAddress: address,
    chainId,
    found: true,
    marketCap: primary.marketCap ?? null,
    fdv: primary.fdv ?? null,
    priceUsd: primary.priceUsd ? Number(primary.priceUsd) : null,
    volume24h: primary.volume?.h24 ?? null,
    priceChange24h: primary.priceChange?.h24 ?? null,
    liquidityUsd: primary.liquidity?.usd ?? null,
    txns24h: primary.txns?.h24
      ? {
          buys: primary.txns.h24.buys || 0,
          sells: primary.txns.h24.sells || 0,
        }
      : null,
    dexUrl: primary.url || null,
    bannerUrl: primary.info?.header || null,
    iconUrl: primary.info?.imageUrl || null,
    dexScreener: {
      enhancedInfoPaid,
      enhancedInfoStatus: tokenProfile?.status || null,
      boostActive: (ordersData?.boosts?.length || 0) > 0,
    },
    fetchedAt: Date.now(),
  };

  cache.set(key, { data: stats, expires: Date.now() + CACHE_TTL_MS });
  return stats;
}

export async function fetchTokenMarketStatsBatch(
  items: Array<{ tokenAddress: string; chain?: string }>
): Promise<Record<string, TokenMarketStats>> {
  const slice = items.slice(0, MAX_BATCH);
  const results = await Promise.all(
    slice.map((item) =>
      fetchTokenMarketStats(item.tokenAddress, item.chain || 'base')
    )
  );
  const markets: Record<string, TokenMarketStats> = {};
  for (const stats of results) {
    markets[stats.tokenAddress] = stats;
  }
  return markets;
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (abs >= 1) return `$${value.toFixed(2)}`;
  if (abs >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toExponential(2)}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
