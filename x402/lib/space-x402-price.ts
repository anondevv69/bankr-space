/** Bankr Space — used for x402 fund payments on Base. */
export const SPACE_X402_TOKEN = '0xef703b860a6d422fa00cc67bbbb2662297cb6ba3';

const DEXSCREENER_PAIRS = `https://api.dexscreener.com/token-pairs/v1/base/${SPACE_X402_TOKEN}`;

type DexPair = {
  liquidity?: { usd?: number | null };
  priceUsd?: string | null;
};

/** Human-readable max authorize (upto cap) — must match bankr.x402.json `price`. */
export const X402_FUND_MAX_AUTHORIZE_TOKENS = '250000';

export const X402_FUND_MAX_AUTHORIZE_ATOMIC =
  BigInt(X402_FUND_MAX_AUTHORIZE_TOKENS) * 10n ** 18n;

export function spaceTokensForUsd(usd: number, priceUsd: number): number {
  if (!(usd > 0) || !(priceUsd > 0)) return 0;
  return usd / priceUsd;
}

/** Whole-token amount → 18-decimal atomic string for X-402-Settle-Amount. */
export function spaceAtomicString(tokenAmount: number): string {
  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) return '0';
  const fixed = tokenAmount.toFixed(18);
  const [whole, frac = ''] = fixed.split('.');
  const padded = frac.padEnd(18, '0').slice(0, 18);
  return (BigInt(whole) * 10n ** 18n + BigInt(padded)).toString();
}

export function spaceAtomicForUsd(usd: number, priceUsd: number): string {
  return spaceAtomicString(spaceTokensForUsd(usd, priceUsd));
}

export async function fetchSpacePriceUsd(): Promise<number | null> {
  try {
    const res = await fetch(DEXSCREENER_PAIRS, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const pairs = (await res.json()) as DexPair[];
    if (!Array.isArray(pairs) || !pairs.length) return null;
    const primary = [...pairs].sort(
      (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];
    const price = primary?.priceUsd ? Number(primary.priceUsd) : NaN;
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}
