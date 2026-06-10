import type { CustomSocialLink } from './types';

const DEXSCREENER_BASE = 'https://api.dexscreener.com';

export type DexProfileLink = {
  type?: string;
  label?: string;
  url?: string;
};

export type DexTokenProfile = {
  chainId: string;
  tokenAddress: string;
  icon: string | null;
  header: string | null;
  description: string | null;
  links: DexProfileLink[];
  profileUrl: string | null;
  source: 'token-pairs' | 'token-profiles' | 'community-takeover' | null;
  updatedAt: string | null;
};

type DexProfileRow = {
  url?: string;
  chainId?: string;
  tokenAddress?: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: DexProfileLink[];
  updatedAt?: string;
  claimDate?: string;
};

type DexPairInfo = {
  imageUrl?: string | null;
  header?: string | null;
};

const PROFILE_LIST_PATHS = [
  '/token-profiles/latest/v1',
  '/token-profiles/recent-updates/v1',
  '/community-takeovers/latest/v1',
] as const;

function normalizeChain(chain: string | undefined): string {
  const value = String(chain || 'base').trim().toLowerCase();
  if (value === 'base-mainnet') return 'base';
  return value || 'base';
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 180 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function rowMatches(row: DexProfileRow, chainId: string, address: string): boolean {
  return (
    String(row.chainId || '').toLowerCase() === chainId &&
    String(row.tokenAddress || '').toLowerCase() === address
  );
}

function mergeProfileRows(rows: DexProfileRow[]): DexProfileRow | null {
  if (!rows.length) return null;
  const merged: DexProfileRow = {};
  for (const row of rows) {
    if (row.url && !merged.url) merged.url = row.url;
    if (row.icon && !merged.icon) merged.icon = row.icon;
    if (row.header && !merged.header) merged.header = row.header;
    if (row.description && !merged.description) merged.description = row.description;
    if (row.links?.length) {
      merged.links = [...(merged.links || []), ...row.links];
    }
    if (row.updatedAt && !merged.updatedAt) merged.updatedAt = row.updatedAt;
    if (row.claimDate && !merged.updatedAt) merged.updatedAt = row.claimDate;
  }
  return merged;
}

async function fetchProfileFromLists(
  chainId: string,
  address: string
): Promise<{ row: DexProfileRow | null; source: DexTokenProfile['source'] }> {
  const matches: Array<{ row: DexProfileRow; source: DexTokenProfile['source'] }> = [];

  for (const path of PROFILE_LIST_PATHS) {
    const list = await fetchJson<DexProfileRow[]>(`${DEXSCREENER_BASE}${path}`);
    if (!Array.isArray(list)) continue;
    const hit = list.find((row) => rowMatches(row, chainId, address));
    if (!hit) continue;
    const source =
      path.includes('community-takeovers')
        ? 'community-takeover'
        : 'token-profiles';
    matches.push({ row: hit, source });
  }

  if (!matches.length) return { row: null, source: null };
  return {
    row: mergeProfileRows(matches.map((item) => item.row)),
    source: matches[0].source,
  };
}

async function fetchPairInfo(
  chainId: string,
  address: string
): Promise<DexPairInfo | null> {
  const pairs = await fetchJson<
    Array<{ info?: DexPairInfo; liquidity?: { usd?: number } }>
  >(`${DEXSCREENER_BASE}/token-pairs/v1/${chainId}/${address}`);
  if (!Array.isArray(pairs) || !pairs.length) return null;
  const primary = [...pairs].sort(
    (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
  )[0];
  return primary.info || null;
}

export async function fetchDexTokenProfile(
  tokenAddress: string,
  chain = 'base'
): Promise<DexTokenProfile> {
  const chainId = normalizeChain(chain);
  const address = tokenAddress.toLowerCase();

  const [{ row, source }, pairInfo] = await Promise.all([
    fetchProfileFromLists(chainId, address),
    fetchPairInfo(chainId, address),
  ]);

  const icon = row?.icon || pairInfo?.imageUrl || null;
  const header = row?.header || pairInfo?.header || null;

  return {
    chainId,
    tokenAddress: address,
    icon: icon || null,
    header: header || null,
    description: row?.description?.trim() || null,
    links: row?.links || [],
    profileUrl: row?.url || null,
    source: source || (pairInfo ? 'token-pairs' : null),
    updatedAt: row?.updatedAt || null,
  };
}

export function dexLinksToSocialHints(links: DexProfileLink[]): CustomSocialLink[] {
  const out: CustomSocialLink[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const url = String(link.url || '').trim();
    if (!url || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());

    const type = String(link.type || link.label || 'link').trim();
    const label = String(link.label || link.type || 'Link').trim();
    const normalizedType = type.toLowerCase();

    if (normalizedType === 'twitter' || normalizedType === 'x') {
      out.push({ title: 'X', url });
      continue;
    }
    if (normalizedType === 'website' || label.toLowerCase() === 'website') {
      out.push({ title: 'Website', url });
      continue;
    }
    if (normalizedType === 'telegram') {
      out.push({ title: 'Telegram', url });
      continue;
    }
    if (normalizedType === 'discord') {
      out.push({ title: 'Discord', url });
      continue;
    }
    if (normalizedType === 'github') {
      out.push({ title: 'GitHub', url });
      continue;
    }

    out.push({ title: label.slice(0, 40) || 'Link', url });
  }

  return out;
}
