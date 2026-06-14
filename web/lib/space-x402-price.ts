import { fetchTokenMarketStats } from '@/lib/dexscreener';
import { NATIVE_SPACE_TOKEN_ADDRESS } from '@/lib/featured-community';
import { SPACE_FUND_X402_CREDIT_USD, X402_PAYMENT_TOKEN_SYMBOL } from '@/lib/x402-config';

/** Human-readable max authorize (upto cap) — must match x402/bankr.x402.json `price`. */
export const X402_FUND_MAX_AUTHORIZE_TOKENS = '250000';

export const X402_FUND_MAX_AUTHORIZE_ATOMIC =
  BigInt(X402_FUND_MAX_AUTHORIZE_TOKENS) * 10n ** 18n;

export function spaceTokensForUsd(usd: number, priceUsd: number): number {
  if (!(usd > 0) || !(priceUsd > 0)) return 0;
  return usd / priceUsd;
}

export function spaceAtomicForUsd(usd: number, priceUsd: number): bigint {
  const tokens = spaceTokensForUsd(usd, priceUsd);
  if (!(tokens > 0)) return 0n;
  const fixed = tokens.toFixed(18);
  const [whole, frac = ''] = fixed.split('.');
  const padded = frac.padEnd(18, '0').slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(padded);
}

export async function fetchSpacePriceUsd(): Promise<number | null> {
  const market = await fetchTokenMarketStats(NATIVE_SPACE_TOKEN_ADDRESS, 'base');
  const price = market.priceUsd;
  return price != null && price > 0 ? price : null;
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${m >= 10 ? m.toFixed(0) : m.toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    const k = tokens / 1_000;
    return `${k >= 10 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  if (tokens >= 100) return tokens.toFixed(0);
  if (tokens >= 1) return tokens.toFixed(2);
  return tokens.toFixed(4);
}

/** UI label for one fund click at the current Space price. */
export function formatX402FundPriceLabel(
  priceUsd: number | null,
  usdCredit = SPACE_FUND_X402_CREDIT_USD
): string {
  if (!priceUsd || priceUsd <= 0) {
    return `$${usdCredit} worth of ${X402_PAYMENT_TOKEN_SYMBOL}`;
  }
  const tokens = spaceTokensForUsd(usdCredit, priceUsd);
  return `${formatTokenCount(tokens)} ${X402_PAYMENT_TOKEN_SYMBOL} (~$${usdCredit})`;
}
