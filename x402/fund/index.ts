/**
 * Platform-wide Bankr x402 fundraiser handler.
 *
 * Runs on x402.bankr.bot, not on bankr.space:
 *   GET /{wallet}/fund?token=0x...&campaign=dex-profile&amount=1
 *
 * Bankr verifies the $Space payment before this handler runs. This handler only
 * validates routing metadata and returns 200 so x402 can settle. The
 * bankr.space proxy credits the correct community after the paid request
 * succeeds, using the token and campaign query params.
 */
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

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = parseRequestUrl(req);
    const token = String(url.searchParams.get('token') || '').trim().toLowerCase();
    const campaignId = String(url.searchParams.get('campaign') || 'dex-profile').trim();

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

    return jsonResponse({
      success: true,
      token,
      campaignId,
      raisedUsd: 0,
      goalUsd: 0,
    });
  } catch (err) {
    console.error('fund handler', err);
    return jsonResponse({ success: true, raisedUsd: 0, goalUsd: 0 });
  }
}
