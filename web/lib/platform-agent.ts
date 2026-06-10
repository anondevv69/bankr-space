import type { WalletAgentMeta } from './types';
import { normalizeAddr } from './utils';

/** Default: @bankrbot agent wallet on Base (override via env). */
const DEFAULT_PLATFORM_AGENT_WALLET = '0x824bcedc77a27c3d8d45573ff14a10bd4b215403';

export const PLATFORM_AGENT_ID = 'bankr-space-agent';
export const PLATFORM_AGENT_TYPE = 'bankr-space-agent';

export function getPlatformAgentWallet(): string | null {
  const raw =
    process.env.PLATFORM_AGENT_WALLET?.trim() ||
    process.env.NEXT_PUBLIC_PLATFORM_AGENT_WALLET?.trim() ||
    DEFAULT_PLATFORM_AGENT_WALLET;
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

export function platformAgentMeta(): WalletAgentMeta {
  return {
    wallet: getPlatformAgentWallet() || undefined,
    isAgentWallet: true,
    agentId: PLATFORM_AGENT_ID,
    agentType: PLATFORM_AGENT_TYPE,
    agentLabel: '@bankrbot · Bankr Space Agent',
    platform: 'bankr.space',
    source: 'known-registry',
    resolvedAt: Date.now(),
  };
}

/**
 * Money handling (non-negotiable):
 * - x402 USDC always settles to the token fee recipient — never the platform agent.
 * - Platform agent never enables fundraisers (fee recipient only).
 * - Skill spend (QRCoin, 0xWork) uses the fee recipient's Bankr wallet / scoped API key.
 */
export const PLATFORM_AGENT_MONEY_RULES = {
  x402PayTo: 'fee-recipient-only' as const,
  fundraisingEnable: 'fee-recipient-only' as const,
  skillExecutionWallet: 'fee-recipient-bankr-account' as const,
  platformAgentReceivesUsdc: false,
};
