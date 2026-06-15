import {
  fetchLaunchByAddress,
  fetchTokenLaunches,
  getLaunchOwnerWallets,
} from '@/lib/bankr-api';
import { enrichLaunchWithImageUrl } from '@/lib/community-image';
import { getCommunities, getLaunches } from '@/lib/db';
import { communityUrl } from '@/lib/site-url';
import { normalizeAddr } from '@/lib/utils';
import type { TokenLaunch } from '@/lib/types';

const BANKR_API = 'https://api.bankr.bot';

export type WalletLaunchRole = 'feeRecipient' | 'deployer';

export type WalletBankrLaunch = {
  tokenAddress: string;
  name: string;
  symbol: string;
  chain: string;
  imageUrl: string | null;
  timestamp: number | null;
  roles: WalletLaunchRole[];
  isFeeRecipient: boolean;
  isDeployer: boolean;
  space: {
    exists: boolean;
    verified: boolean;
    url: string | null;
  };
  actions: {
    canCreateSpace: boolean;
    canVerifySpace: boolean;
  };
};

type BeneficiaryFeeToken = {
  tokenAddress: string;
  name?: string;
  symbol?: string;
};

type BeneficiaryFeesResponse = {
  chain?: string;
  tokens?: BeneficiaryFeeToken[];
};

async function fetchBeneficiaryFeeTokens(wallet: string): Promise<BeneficiaryFeesResponse> {
  try {
    const res = await fetch(
      `${BANKR_API}/public/doppler/beneficiary-fees/${encodeURIComponent(wallet)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return { tokens: [] };
    return (await res.json()) as BeneficiaryFeesResponse;
  } catch {
    return { tokens: [] };
  }
}

function addRole(
  rolesByToken: Map<string, Set<WalletLaunchRole>>,
  tokenAddress: string,
  role: WalletLaunchRole
) {
  const key = tokenAddress.toLowerCase();
  if (!rolesByToken.has(key)) rolesByToken.set(key, new Set());
  rolesByToken.get(key)!.add(role);
}

function syntheticLaunch(
  token: BeneficiaryFeeToken,
  chain: string
): TokenLaunch {
  return {
    activityId: `beneficiary-${token.tokenAddress.toLowerCase()}`,
    tokenAddress: token.tokenAddress,
    tokenName: token.name || token.symbol || 'Token',
    tokenSymbol: token.symbol || 'TOKEN',
    chain,
    timestamp: 0,
  };
}

/** Bankr launches tied to a wallet (fee recipient, deployer, or both). */
export async function getWalletBankrLaunches(wallet: string): Promise<WalletBankrLaunch[]> {
  const w = normalizeAddr(wallet);

  const [cachedLaunches, apiLaunches, beneficiaryFees, communities] = await Promise.all([
    getLaunches(),
    fetchTokenLaunches().catch(() => [] as TokenLaunch[]),
    fetchBeneficiaryFeeTokens(w),
    getCommunities(),
  ]);

  const launchByToken = new Map<string, TokenLaunch>();
  for (const launch of [...cachedLaunches, ...apiLaunches]) {
    if (!launch?.tokenAddress) continue;
    const key = launch.tokenAddress.toLowerCase();
    if (!launchByToken.has(key)) launchByToken.set(key, launch);
  }

  const rolesByToken = new Map<string, Set<WalletLaunchRole>>();

  for (const launch of launchByToken.values()) {
    const { feeRecipient, deployer } = getLaunchOwnerWallets(launch);
    if (feeRecipient === w) addRole(rolesByToken, launch.tokenAddress, 'feeRecipient');
    if (deployer === w) addRole(rolesByToken, launch.tokenAddress, 'deployer');
  }

  const beneficiaryChain = beneficiaryFees.chain || 'base';
  for (const token of beneficiaryFees.tokens || []) {
    if (!token?.tokenAddress) continue;
    addRole(rolesByToken, token.tokenAddress, 'feeRecipient');

    const key = token.tokenAddress.toLowerCase();
    if (launchByToken.has(key)) continue;

    const fetched = await fetchLaunchByAddress(token.tokenAddress);
    launchByToken.set(key, fetched || syntheticLaunch(token, beneficiaryChain));
  }

  if (!rolesByToken.size) return [];

  const communityByToken = new Map(
    communities.map((c) => [c.tokenAddress.toLowerCase(), c])
  );

  const results: WalletBankrLaunch[] = [];

  for (const [tokenKey, roles] of rolesByToken) {
    const launch = launchByToken.get(tokenKey);
    if (!launch) continue;

    const enriched = enrichLaunchWithImageUrl(launch);
    const isFeeRecipient = roles.has('feeRecipient');
    const isDeployer = roles.has('deployer');
    const community = communityByToken.get(tokenKey);
    const exists = !!community;
    const verified = community?.verified ?? false;

    results.push({
      tokenAddress: launch.tokenAddress,
      name: launch.tokenName,
      symbol: launch.tokenSymbol,
      chain: launch.chain || 'base',
      imageUrl: enriched.imageUrl || null,
      timestamp: launch.timestamp || null,
      roles: [...roles],
      isFeeRecipient,
      isDeployer,
      space: {
        exists,
        verified,
        url: exists ? communityUrl(launch.tokenAddress) : null,
      },
      actions: {
        canCreateSpace: !exists,
        canVerifySpace: exists && isFeeRecipient && !verified,
      },
    });
  }

  return results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}
