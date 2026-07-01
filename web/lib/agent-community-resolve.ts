import { getCommunities } from './db';
import { normalizeAddr } from './utils';
import type { Community } from './types';

export async function resolveCommunityByAgentQuery(
  token: string | null,
  symbol: string | null,
  query: string | null
): Promise<Community | null> {
  const communities = await getCommunities();
  if (token) {
    const addr = normalizeAddr(token);
    return communities.find((c) => c.tokenAddress.toLowerCase() === addr) || null;
  }
  if (symbol) {
    return (
      communities.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase()) || null
    );
  }
  if (query) {
    const q = query.toLowerCase();
    return (
      communities.find(
        (c) =>
          c.symbol.toLowerCase() === q ||
          c.symbol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.tokenAddress.toLowerCase() === q
      ) || null
    );
  }
  return null;
}

export function profileMatchesCommunity(
  profile: { tokenAddress?: string | null },
  community: Community
): boolean {
  const profileToken = String(profile.tokenAddress || '').toLowerCase();
  if (!profileToken) return true;
  return profileToken === community.tokenAddress.toLowerCase();
}
