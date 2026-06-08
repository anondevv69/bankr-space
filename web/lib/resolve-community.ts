import { getCommunities, getLaunches } from './db';
import {
  fetchLaunchByAddress,
  searchBankrTokens,
} from './bankr-api';
import { communityUrl } from './site-url';
import type { Community, TokenLaunch } from './types';

export type ResolveSource = 'existing_community' | 'token_launch' | 'not_found';

export type ResolveMatch = {
  symbol: string;
  name: string;
  tokenAddress: string;
  communityExists: boolean;
  communityLink: string;
  verified?: boolean;
};

export type ResolveResult = {
  ok: boolean;
  query: string;
  source: ResolveSource;
  communityExists: boolean;
  suggestCreateCommunity: boolean;
  symbol: string | null;
  tokenName: string | null;
  tokenAddress: string | null;
  communityLink: string | null;
  linkReply: string | null;
  replyText: string | null;
  tweetReply: string | null;
  matches: ResolveMatch[];
  hint: string | null;
  createCommunityAction: string | null;
  error?: string;
};

function emptyResult(query: string, error?: string): ResolveResult {
  return {
    ok: false,
    query,
    source: 'not_found',
    communityExists: false,
    suggestCreateCommunity: false,
    symbol: null,
    tokenName: null,
    tokenAddress: null,
    communityLink: null,
    linkReply: null,
    replyText: null,
    tweetReply: null,
    matches: [],
    hint: null,
    createCommunityAction: null,
    error,
  };
}

function toMatch(community: Community): ResolveMatch {
  return {
    symbol: community.symbol,
    name: community.name,
    tokenAddress: community.tokenAddress,
    communityExists: true,
    communityLink: communityUrl(community.tokenAddress),
    verified: community.verified,
  };
}

function toMatchFromLaunch(launch: TokenLaunch, exists: boolean): ResolveMatch {
  return {
    symbol: launch.tokenSymbol,
    name: launch.tokenName,
    tokenAddress: launch.tokenAddress,
    communityExists: exists,
    communityLink: exists ? communityUrl(launch.tokenAddress) : '',
  };
}

export function normalizeCommunityQuery(raw: string): string {
  return raw.trim().replace(/^\$/, '');
}

export function findMatchingCommunities(
  communities: Community[],
  query: string
): Community[] {
  const q = query.toLowerCase();
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(query);

  if (isAddress) {
    const match = communities.find((c) => c.tokenAddress.toLowerCase() === q);
    return match ? [match] : [];
  }

  const exactSymbol = communities.filter((c) => c.symbol.toLowerCase() === q);
  if (exactSymbol.length) return exactSymbol;

  const exactName = communities.filter((c) => c.name.toLowerCase() === q);
  if (exactName.length) return exactName;

  return communities.filter(
    (c) =>
      c.symbol.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.tokenAddress.toLowerCase().includes(q)
  );
}

async function findBestTokenLaunch(query: string): Promise<TokenLaunch | null> {
  const q = query.toLowerCase();
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(query);
  const results: TokenLaunch[] = [];
  const seen = new Set<string>();

  function addLaunch(launch: TokenLaunch | null) {
    if (!launch?.tokenAddress) return;
    const key = launch.tokenAddress.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    results.push(launch);
  }

  if (isAddress) {
    addLaunch(await fetchLaunchByAddress(query));
  }

  const tokens = await searchBankrTokens(query);
  for (const token of tokens.slice(0, 12)) {
    if (!token?.address) continue;
    addLaunch(await fetchLaunchByAddress(token.address));
  }

  const cached = await getLaunches();
  for (const launch of cached) {
    if (
      launch.tokenSymbol?.toLowerCase() === q ||
      launch.tokenName?.toLowerCase() === q ||
      launch.tokenName?.toLowerCase().includes(q) ||
      launch.tokenSymbol?.toLowerCase().includes(q) ||
      launch.tokenAddress?.toLowerCase() === q
    ) {
      addLaunch(launch);
    }
  }

  if (!results.length) return null;

  const exact = results.find(
    (l) =>
      l.tokenSymbol?.toLowerCase() === q ||
      l.tokenAddress?.toLowerCase() === q ||
      l.tokenName?.toLowerCase() === q
  );
  return exact || results[0];
}

function existingCommunityResult(
  query: string,
  symbol: string,
  tokenName: string,
  tokenAddress: string,
  matches: ResolveMatch[],
  hint: string | null
): ResolveResult {
  const link = communityUrl(tokenAddress);

  return {
    ok: true,
    query,
    source: 'existing_community',
    communityExists: true,
    suggestCreateCommunity: false,
    symbol,
    tokenName,
    tokenAddress,
    communityLink: link,
    linkReply: link,
    replyText: link,
    tweetReply: link,
    matches,
    hint,
    createCommunityAction: null,
  };
}

function noCommunityAskCreateResult(
  query: string,
  launch: TokenLaunch
): ResolveResult {
  const symbol = launch.tokenSymbol;
  const tokenName = launch.tokenName;
  const tokenAddress = launch.tokenAddress;
  const reply = `No $${symbol} space yet — ${tokenName} is on Bankr. Would you like me to create the space?`;

  return {
    ok: true,
    query,
    source: 'token_launch',
    communityExists: false,
    suggestCreateCommunity: true,
    symbol,
    tokenName,
    tokenAddress,
    communityLink: null,
    linkReply: null,
    replyText: reply,
    tweetReply: reply,
    matches: [toMatchFromLaunch(launch, false)],
    hint: 'If user says yes → POST /api/communities/{tokenAddress} with linked wallet, then reply with communityLink.',
    createCommunityAction: `POST /api/communities/${tokenAddress} header x-wallet-address`,
  };
}

export async function resolveCommunityLink(rawQuery: string): Promise<ResolveResult> {
  const query = normalizeCommunityQuery(rawQuery);
  if (!query) {
    return emptyResult('', 'Query required — pass symbol, token name, or contract address');
  }

  const communities = await getCommunities();
  const communityMatches = findMatchingCommunities(communities, query);

  if (communityMatches.length >= 1) {
    const best = communityMatches[0];
    return existingCommunityResult(
      query,
      best.symbol,
      best.name,
      best.tokenAddress,
      communityMatches.map(toMatch),
      communityMatches.length > 1
        ? `Multiple spaces matched "${query}" — using ${best.symbol}. See matches[] for others.`
        : null
    );
  }

  const launch = await findBestTokenLaunch(query);
  if (launch?.tokenAddress) {
    return noCommunityAskCreateResult(query, launch);
  }

  return emptyResult(
    query,
    `No space or Bankr token found for "${query}". Try a contract address or search on the site.`
  );
}
