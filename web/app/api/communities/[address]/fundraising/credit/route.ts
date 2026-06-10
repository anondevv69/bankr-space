import { NextResponse } from 'next/server';
import { CAMPAIGN_IDS, type CampaignId } from '@/lib/fundraising';
import { applyFundraisingCredit } from '@/lib/apply-fundraising-credit';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

function authorizeWebhook(req: Request): boolean {
  const secret = process.env.X402_FUND_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request, { params }: RouteParams) {
  if (!authorizeWebhook(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const body = await req.json().catch(() => ({}));
  const campaignId = String(body.campaignId || body.campaign || '').trim() as CampaignId;
  const amountUsd = Number(body.amountUsd ?? body.amount);

  if (!CAMPAIGN_IDS.includes(campaignId)) {
    return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 });
  }

  try {
    const result = await applyFundraisingCredit(tokenAddress, campaignId, amountUsd);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      tokenAddress: result.tokenAddress,
      campaignId: result.campaignId,
      creditedUsd: result.creditedUsd,
      raisedUsd: result.raisedUsd,
      goalUsd: result.goalUsd,
      funded: result.funded,
      txRef: body.txRef || null,
    });
  } catch (err) {
    console.error('POST fundraising credit', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
