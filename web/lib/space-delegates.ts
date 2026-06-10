export const MAX_TRUSTED_DELEGATES = 3;

export function normalizeTrustedDelegates(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    const w = String(item || '').trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= MAX_TRUSTED_DELEGATES) break;
  }
  return out;
}

export function isTrustedDelegateWallet(wallet: string, delegates: string[]): boolean {
  const w = wallet.toLowerCase();
  return delegates.some((d) => d.toLowerCase() === w);
}
