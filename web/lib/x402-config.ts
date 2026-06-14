import { NATIVE_SPACE_TOKEN_ADDRESS } from './featured-community';

/** x402 fund service payment token (must match x402/bankr.x402.json). */
export const X402_PAYMENT_TOKEN_ADDRESS = NATIVE_SPACE_TOKEN_ADDRESS;

export const X402_PAYMENT_TOKEN_SYMBOL = 'Space';

export const X402_PAYMENT_TOKEN_DECIMALS = 18;

/** Human-readable tokens charged per fund click — must match bankr.x402.json `price`. */
export const X402_FUND_PRICE_TOKENS = '1';

export const X402_FUND_MAX_ATOMIC = BigInt(10) ** BigInt(X402_PAYMENT_TOKEN_DECIMALS);

/** USD progress credited on bankr.space per successful x402 click (goal bar stays in USD). */
export const SPACE_FUND_X402_CREDIT_USD = 1;

/** @deprecated use SPACE_FUND_X402_CREDIT_USD */
export const SPACE_FUND_X402_MAX_USDC = SPACE_FUND_X402_CREDIT_USD;

export function formatX402FundPriceLabel(): string {
  const n = Number(X402_FUND_PRICE_TOKENS);
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m}M ${X402_PAYMENT_TOKEN_SYMBOL}`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${k % 1 === 0 ? k.toFixed(0) : k}K ${X402_PAYMENT_TOKEN_SYMBOL}`;
  }
  return `${X402_FUND_PRICE_TOKENS} ${X402_PAYMENT_TOKEN_SYMBOL}`;
}
