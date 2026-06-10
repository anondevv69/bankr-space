import type { WalletAgentMeta } from './types';
import { normalizeAddr } from './utils';

export const PLATFORM_AGENT_ID = 'bankr-space-agent';
export const PLATFORM_AGENT_TYPE = 'bankr-space-agent';
export const PLATFORM_AGENT_LABEL = 'Bankr Space Agent';

/**
 * Set via PLATFORM_AGENT_WALLET (Vercel + Aeon). Use a dedicated Base Account —
 * not @bankrbot. Create via Base MCP (mcp.base.org) → get_wallets.
 */
export function getPlatformAgentWallet(): string | null {
  const raw =
    process.env.PLATFORM_AGENT_WALLET?.trim() ||
    process.env.NEXT_PUBLIC_PLATFORM_AGENT_WALLET?.trim();
  if (!raw) return null;
  try {
    return normalizeAddr(raw);
  } catch {
    return null;
  }
}

export function isPlatformAgentWallet(wallet: string): boolean {
  const platform = getPlatformAgentWallet();
  if (!platform) return false;
  return wallet.toLowerCase() === platform.toLowerCase();
}

/** Space-page opt-in UI. Off until platform worker (e.g. Aeon) is live. */
export function isPlatformAgentUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PLATFORM_AGENT_UI === 'true';
}

export function platformAgentMeta(): WalletAgentMeta {
  return {
    wallet: getPlatformAgentWallet() || undefined,
    isAgentWallet: true,
    agentId: PLATFORM_AGENT_ID,
    agentType: PLATFORM_AGENT_TYPE,
    agentLabel: PLATFORM_AGENT_LABEL,
    platform: 'bankr.space',
    source: 'known-registry',
    resolvedAt: Date.now(),
  };
}

/**
 * Money & authorization (non-negotiable):
 * - x402 USDC always settles to the fee recipient — never the platform agent wallet.
 * - Fee recipient enables fundraisers; trusted delegates may *request* skill fundraisers
 *   but cannot enable them or receive USDC.
 * - Platform agent only executes what the fee recipient opted into:
 *   - `usePlatformAgent` → social (post, pin, profile)
 *   - `platformAgentSkills` → QRCoin / 0xWork after a campaign is **matched** (raised ≥ goal)
 * - "Matched" means holders funded the goal via x402 into the fee recipient wallet; that
 *   authorizes the agent to spend from the fee recipient's Bankr account — not pay the agent.
 */
export const PLATFORM_AGENT_MONEY_RULES = {
  x402PayTo: 'fee-recipient-only' as const,
  fundraisingEnable: 'fee-recipient-only' as const,
  fundraiserRequest: 'fee-recipient-or-trusted-delegate' as const,
  skillExecutionWallet: 'fee-recipient-bankr-account' as const,
  skillExecutionGate: 'platformAgentSkills-and-campaign-matched' as const,
  platformAgentReceivesUsdc: false,
};
