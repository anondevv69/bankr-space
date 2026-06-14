/**
 * Platform-wide Bankr x402 fundraiser handler.
 *
 * Runs on x402.bankr.bot, not on bankr.space:
 *   GET /{wallet}/fund?token=0x...&campaign=dex-profile&amount=1
 *
 * Uses paymentScheme "upto": callers authorize up to the configured cap;
 * this handler settles ~$amount USD worth of $Space via X-402-Settle-Amount.
 */
import {
  fetchSpacePriceUsd,
  spaceAtomicForUsd,
  spaceTokensForUsd,
  X402_FUND_MAX_AUTHORIZE_ATOMIC,
} from '../lib/space-x402-price';

function parseRequestUrl(req: Request): URL {
  try {
    return new URL(req.url);
  } catch {
    return new URL(req.url, 'https://x402.bankr.bot');
  }
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = parseRequestUrl(req);
    const token = String(url.searchParams.get('token') || '').trim().toLowerCase();
    const campaignId = String(url.searchParams.get('campaign') || 'dex-profile').trim();
    const amountUsd = Number(url.searchParams.get('amount') || '1');

    if (!/^0x[a-f0-9]{40}$/.test(token)) {
      return jsonResponse({
        success: false,
        token,
        campaignId,
        raisedUsd: 0,
        goalUsd: 0,
        error: 'token query param required (0x contract address)',
      });
    }

    if (!['dex-profile', 'dex-boost', 'custom', 'agent-qrcoin', 'agent-0xwork'].includes(campaignId)) {
      return jsonResponse({
        success: false,
        token,
        campaignId,
        raisedUsd: 0,
        goalUsd: 0,
        error: 'invalid campaign query param',
      });
    }

    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return jsonResponse({
        success: false,
        token,
        campaignId,
        raisedUsd: 0,
        goalUsd: 0,
        error: 'amount query param must be a positive USD credit value',
      });
    }

    const priceUsd = await fetchSpacePriceUsd();
    if (!priceUsd) {
      return jsonResponse({
        success: false,
        token,
        campaignId,
        raisedUsd: 0,
        goalUsd: 0,
        error: 'Space token price unavailable — try again shortly',
      });
    }

    const settleAtomic = BigInt(spaceAtomicForUsd(amountUsd, priceUsd));
    if (settleAtomic <= 0n) {
      return jsonResponse({
        success: false,
        token,
        campaignId,
        raisedUsd: 0,
        goalUsd: 0,
        error: 'Could not compute Space payment amount',
      });
    }

    if (settleAtomic > X402_FUND_MAX_AUTHORIZE_ATOMIC) {
      const needed = spaceTokensForUsd(amountUsd, priceUsd);
      return jsonResponse({
        success: false,
        token,
        campaignId,
        raisedUsd: 0,
        goalUsd: 0,
        error: `Space price too low for $${amountUsd} credit (~${Math.ceil(needed).toLocaleString()} Space needed). Raise x402 upto cap and redeploy.`,
      });
    }

    return jsonResponse(
      {
        success: true,
        token,
        campaignId,
        raisedUsd: 0,
        goalUsd: 0,
        spacePriceUsd: priceUsd,
        spaceTokensSettled: spaceTokensForUsd(amountUsd, priceUsd),
        usdCredit: amountUsd,
      },
      200,
      {
        'X-402-Settle-Amount': settleAtomic.toString(),
      }
    );
  } catch (err) {
    console.error('fund handler', err);
    return jsonResponse({ success: true, raisedUsd: 0, goalUsd: 0 });
  }
}
