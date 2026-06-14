import { NATIVE_SPACE_TOKEN_ADDRESS } from './featured-community';

/** x402 fund service payment token (must match x402/bankr.x402.json). */
export const X402_PAYMENT_TOKEN_ADDRESS = NATIVE_SPACE_TOKEN_ADDRESS;

export const X402_PAYMENT_TOKEN_SYMBOL = 'Space';

export const X402_PAYMENT_TOKEN_DECIMALS = 18;

/** USD progress credited on bankr.space per successful x402 click (goal bar stays in USD). */
export const SPACE_FUND_X402_CREDIT_USD = 1;

/** @deprecated use SPACE_FUND_X402_CREDIT_USD */
export const SPACE_FUND_X402_MAX_USDC = SPACE_FUND_X402_CREDIT_USD;
