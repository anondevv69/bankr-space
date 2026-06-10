import { getLaunches } from './db';
import { fetchLaunchByAddress, getLaunchOwnerWallets } from './bankr-api';
import type { WalletAgentMeta } from './types';
import { normalizeAddr } from './utils';

const BANKR_API = 'https://api.bankr.bot';

/** Well-known Bankr / agent handles → type (wallets resolved via Bankr or launch data). */
const AGENT_HANDLE_RULES: Array<{
  match: (handle: string) => boolean;
  agentId: string;
  agentType: string;
}> = [
  { match: (h) => h === 'bankrbot', agentId: 'bankrbot', agentType: 'bankr-bot' },
  { match: (h) => h === 'hermes', agentId: 'hermes', agentType: 'hermes' },
  { match: (h) => h === 'bankrbotai', agentId: 'bankrbotai', agentType: 'bankr-agent' },
  {
    match: (h) => h.endsWith('bot') || h.includes('bot'),
    agentId: '', // filled from handle
    agentType: 'bankr-agent',
  },
];

/** Static fallbacks when launch metadata is unavailable. */
const KNOWN_AGENT_WALLETS: Record<
  string,
  Omit<WalletAgentMeta, 'resolvedAt' | 'isAgentWallet'>
> = {
  '0x824bcedc77a27c3d8d45573ff14a10bd4b215403': {
    agentId: 'bankrbot',
    agentType: 'bankr-bot',
    agentLabel: '@bankrbot',
    platform: 'twitter',
    source: 'known-registry',
  },
  '0x0dc35d3ebf720e264a7db2b488ed957d8e72d527': {
    agentId: 'hermes',
    agentType: 'hermes',
    agentLabel: '@hermes',
    platform: 'twitter',
    source: 'known-registry',
  },
};

function stripAt(value: string): string {
  return String(value || '').replace(/^@/, '').trim();
}

function classifyHandle(
  username: string,
  platform: string | null = 'twitter'
): Omit<WalletAgentMeta, 'resolvedAt' | 'wallet'> | null {
  const handle = stripAt(username).toLowerCase();
  if (!handle) return null;

  for (const rule of AGENT_HANDLE_RULES) {
    if (!rule.match(handle)) continue;
    const agentId = rule.agentId || handle;
    return {
      isAgentWallet: true,
      agentId,
      agentType: rule.agentType,
      agentLabel: `@${handle}`,
      platform,
      source: 'handle-heuristic',
    };
  }

  return {
    isAgentWallet: false,
    agentId: null,
    agentType: 'human',
    agentLabel: `@${handle}`,
    platform,
    source: 'handle-heuristic',
  };
}

async function lookupLaunchSocial(
  wallet: string
): Promise<{ xUsername: string | null; platform: string | null } | null> {
  const w = wallet.toLowerCase();
  const launches = await getLaunches();

  for (const launch of launches) {
    for (const party of [launch.feeRecipient, launch.deployer]) {
      if (party?.walletAddress?.toLowerCase() !== w) continue;
      return {
        xUsername: party.xUsername || null,
        platform: 'twitter',
      };
    }
  }

  return null;
}

async function lookupTokenLaunchSocial(
  wallet: string,
  tokenAddress: string
): Promise<{ xUsername: string | null; platform: string | null } | null> {
  const w = wallet.toLowerCase();
  const token = normalizeAddr(tokenAddress);
  let launch = (await getLaunches()).find((l) => l.tokenAddress?.toLowerCase() === token);
  if (!launch) {
    launch = (await fetchLaunchByAddress(token)) || undefined;
  }
  if (!launch) return null;

  const { feeRecipient, deployer } = getLaunchOwnerWallets(launch);
  if (feeRecipient === w) {
    return { xUsername: launch.feeRecipient?.xUsername || null, platform: 'twitter' };
  }
  if (deployer === w) {
    return { xUsername: launch.deployer?.xUsername || null, platform: 'twitter' };
  }

  return null;
}

/** Resolve a Twitter handle to wallet via Bankr (for agent lookup by handle). */
export async function resolveBankrTwitterHandle(
  handle: string
): Promise<{ wallet: string; displayName: string } | null> {
  const value = stripAt(handle);
  if (!value) return null;

  try {
    const res = await fetch(
      `${BANKR_API}/addresses/resolve?value=${encodeURIComponent(value)}&type=twitter`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      resolved?: boolean;
      address?: string;
      displayName?: string;
    };
    if (!data.resolved || !data.address) return null;
    return {
      wallet: data.address.toLowerCase(),
      displayName: data.displayName || `@${value}`,
    };
  } catch {
    return null;
  }
}

export type ResolveAgentWalletOptions = {
  tokenAddress?: string;
  xUsername?: string | null;
};

/** Resolve whether a wallet is a known Bankr agent (bankrbot, hermes, etc.). */
export async function resolveAgentWallet(
  wallet: string,
  options?: ResolveAgentWalletOptions
): Promise<WalletAgentMeta> {
  const w = normalizeAddr(wallet);
  const now = Date.now();

  const known = KNOWN_AGENT_WALLETS[w];
  if (known) {
    return {
      wallet: w,
      isAgentWallet: true,
      ...known,
      resolvedAt: now,
    };
  }

  let xUsername = options?.xUsername ? stripAt(options.xUsername) : null;
  let platform: string | null = 'twitter';

  if (!xUsername && options?.tokenAddress) {
    const fromToken = await lookupTokenLaunchSocial(w, options.tokenAddress);
    xUsername = fromToken?.xUsername ? stripAt(fromToken.xUsername) : null;
    platform = fromToken?.platform || platform;
  }

  if (!xUsername) {
    const fromLaunches = await lookupLaunchSocial(w);
    xUsername = fromLaunches?.xUsername ? stripAt(fromLaunches.xUsername) : null;
    platform = fromLaunches?.platform || platform;
  }

  if (xUsername) {
    const classified = classifyHandle(xUsername, platform);
    if (classified) {
      return { wallet: w, ...classified, resolvedAt: now };
    }
  }

  return {
    wallet: w,
    isAgentWallet: false,
    agentId: null,
    agentType: 'unknown',
    agentLabel: null,
    platform: null,
    source: 'none',
    resolvedAt: now,
  };
}
