import type { TokenLaunch } from './types';
import { normalizeAddr } from './utils';

type LegacyLaunchEntry = TokenLaunch & {
  searchAliases?: string[];
};

/** Pre–token-launches API Bankr tokens (old Clanker / Farcaster deploys). */
const LEGACY_LAUNCHES: LegacyLaunchEntry[] = [
  {
    activityId: 'legacy:bnkr-bankrcoin',
    tokenAddress: '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b',
    tokenName: 'BankrCoin',
    tokenSymbol: 'BNKR',
    chain: 'base',
    timestamp: 1735689600000,
    imageUri:
      'https://coin-images.coingecko.com/coins/images/52626/large/bankr-static.png?1736405365',
    searchAliases: ['bankr', 'bnkr', 'bankrcoin', 'bankr coin'],
    feeRecipient: {
      walletAddress: '0x128c718152c4da86454547484a43a09ac4ee6e7b',
      xUsername: 'bankrbot',
    },
    deployer: {
      walletAddress: '0x128c718152c4da86454547484a43a09ac4ee6e7b',
    },
  },
];

function stripLegacyMeta(entry: LegacyLaunchEntry): TokenLaunch {
  const { searchAliases: _aliases, ...launch } = entry;
  return launch;
}

export function getLegacyLaunchByAddress(address: string): TokenLaunch | null {
  const token = normalizeAddr(address);
  const hit = LEGACY_LAUNCHES.find(
    (l) => l.tokenAddress.toLowerCase() === token
  );
  return hit ? stripLegacyMeta(hit) : null;
}

export function findLegacyLaunchesByQuery(query: string): TokenLaunch[] {
  const q = query.trim().toLowerCase().replace(/^\$/, '');
  if (!q) return [];

  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(query.trim());
  if (isAddress) {
    const one = getLegacyLaunchByAddress(query.trim());
    return one ? [one] : [];
  }

  return LEGACY_LAUNCHES.filter((entry) => {
    const symbol = entry.tokenSymbol.toLowerCase();
    const name = entry.tokenName.toLowerCase();
    const addr = entry.tokenAddress.toLowerCase();
    const aliases = (entry.searchAliases || []).map((a) => a.toLowerCase());
    return (
      symbol === q ||
      name === q ||
      symbol.includes(q) ||
      name.includes(q) ||
      addr.includes(q) ||
      aliases.some((a) => a === q || a.includes(q))
    );
  }).map(stripLegacyMeta);
}

export function mergeLegacyLaunches(launches: TokenLaunch[]): TokenLaunch[] {
  const merged = [...launches];
  const seen = new Set(merged.map((l) => l.tokenAddress.toLowerCase()));

  for (const entry of LEGACY_LAUNCHES) {
    const key = entry.tokenAddress.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(stripLegacyMeta(entry));
  }

  return merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}
