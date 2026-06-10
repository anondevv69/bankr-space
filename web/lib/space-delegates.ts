import type { TrustedDelegateEntry, WalletAgentMeta } from './types';
import { normalizeAddr } from './utils';

export const MAX_TRUSTED_DELEGATES = 3;

function isValidWallet(value: string): boolean {
  return /^0x[a-f0-9]{40}$/.test(value);
}

function normalizeAgentMeta(input: unknown): WalletAgentMeta | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as WalletAgentMeta;
  return {
    wallet: raw.wallet ? normalizeAddr(raw.wallet) : undefined,
    isAgentWallet: Boolean(raw.isAgentWallet),
    agentId: raw.agentId ? String(raw.agentId) : null,
    agentType: raw.agentType ? String(raw.agentType) : null,
    agentLabel: raw.agentLabel ? String(raw.agentLabel) : null,
    platform: raw.platform ? String(raw.platform) : null,
    source: raw.source,
    resolvedAt: raw.resolvedAt,
  };
}

/** Accept legacy string[] or TrustedDelegateEntry[]. */
export function normalizeTrustedDelegates(input: unknown): TrustedDelegateEntry[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const out: TrustedDelegateEntry[] = [];

  for (const item of input) {
    let wallet = '';
    let agent: WalletAgentMeta | null | undefined;

    if (typeof item === 'string') {
      wallet = item.trim().toLowerCase();
    } else if (item && typeof item === 'object') {
      wallet = String((item as TrustedDelegateEntry).wallet || '').trim().toLowerCase();
      agent = normalizeAgentMeta((item as TrustedDelegateEntry).agent);
    }

    if (!isValidWallet(wallet)) continue;
    if (seen.has(wallet)) continue;
    seen.add(wallet);
    out.push({ wallet, agent: agent ?? null });
    if (out.length >= MAX_TRUSTED_DELEGATES) break;
  }

  return out;
}

export function trustedDelegateWallets(delegates: TrustedDelegateEntry[]): string[] {
  return delegates.map((d) => d.wallet);
}

export function isTrustedDelegateWallet(
  wallet: string,
  delegates: TrustedDelegateEntry[]
): boolean {
  const w = wallet.toLowerCase();
  return delegates.some((d) => d.wallet.toLowerCase() === w);
}
