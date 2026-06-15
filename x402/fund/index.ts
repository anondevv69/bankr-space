/**
 * Platform-wide Bankr x402 fundraiser handler (single file — Bankr bundler rejects ./ imports).
 */
const DEXSCREENER_PAIRS =
  'https://api.dexscreener.com/token-pairs/v1/base/0xef703b860a6d422fa00cc67bbbb2662297cb6ba3';

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

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function spaceTokensForUsd(usd: number, priceUsd: number): number {
  if (!(usd > 0) || !(priceUsd > 0)) return 0;
  return usd / priceUsd;
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

    return jsonResponse({
      success: true,
      token,
      campaignId,
      raisedUsd: 0,
      goalUsd: 0,
      usdCredit: amountUsd,
      ...(priceUsd
        ? {
            spacePriceUsd: priceUsd,
            spaceTokensAtSpot: spaceTokensForUsd(amountUsd, priceUsd),
          }
        : {}),
    });
  } catch (err) {
    console.error('fund handler', err);
    return jsonResponse({ success: false, raisedUsd: 0, goalUsd: 0, error: 'handler error' });
  }
}
