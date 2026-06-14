/**
 * Platform-wide Bankr x402 fundraiser handler (single file — Bankr bundler rejects ./ imports).
 */
const SPACE_X402_TOKEN = '0xef703b860a6d422fa00cc67bbbb2662297cb6ba3';
const DEXSCREENER_PAIRS = `https://api.dexscreener.com/token-pairs/v1/base/${SPACE_X402_TOKEN}`;
const X402_FUND_MAX_AUTHORIZE_ATOMIC = BigInt('250000') * 10n ** 18n;

type DexPair = {
  liquidity?: { usd?: number | null };
  priceUsd?: string | null;
};

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

function spaceTokensForUsd(usd: number, priceUsd: number): number {
  if (!(usd > 0) || !(priceUsd > 0)) return 0;
  return usd / priceUsd;
}

function spaceAtomicForUsd(usd: number, priceUsd: number): string {
  const tokens = spaceTokensForUsd(usd, priceUsd);
  if (!(tokens > 0)) return '0';
  const fixed = tokens.toFixed(18);
  const [whole, frac = ''] = fixed.split('.');
  const padded = frac.padEnd(18, '0').slice(0, 18);
  return (BigInt(whole) * 10n ** 18n + BigInt(padded)).toString();
}

async function fetchSpacePriceUsd(): Promise<number | null> {
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

function isValidFundCampaignId(campaignId: string): boolean {
  if (campaignId === 'dex-profile' || campaignId === 'dex-boost' || campaignId === 'custom') {
    return true;
  }
  if (/^custom-[a-z0-9-]+$/i.test(campaignId)) return true;
  return campaignId === 'agent-qrcoin' || campaignId === 'agent-0xwork';
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

    if (!isValidFundCampaignId(campaignId)) {
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
