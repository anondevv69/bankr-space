import { NextResponse } from 'next/server';
import { applyRaffleCredit, RAFFLE_X402_CREDIT_USD } from '@/lib/apply-raffle-credit';
import {
  isRaffleX402CampaignId,
  parseRaffleX402CampaignId,
  raffleX402CampaignId,
} from '@/lib/community-raffles';
import { canActAsFeeRecipient, getTokenBeneficiaryWallet } from '@/lib/community-owner';
import { fetchFundraisingX402Upstream } from '@/lib/fundraising-x402-fetch';
import { isBeneficiaryCampaignId } from '@/lib/fundraising';
import { attachX402FundMeta } from '@/lib/x402-quote-response';
import { decodeX402PaymentDiagnostics } from '@/lib/x402-facilitator-verify';
import { parseX402UpstreamError } from '@/lib/x402-upstream-error';
import { getCommunity } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

async function assertFeeRecipientPayer(
  tokenAddress: string,
  wallet: string | null,
  xPayment?: string
): Promise<{ ok: true; payer: string } | { ok: false; error: string; status: number }> {
  let payer = wallet?.toLowerCase() || null;
  if (xPayment) {
    const decoded = decodeX402PaymentDiagnostics(xPayment);
    if (decoded?.payer) payer = decoded.payer.toLowerCase();
  }
  if (!payer) {
    return {
      ok: false,
      error: 'Connect as the fee recipient wallet to fund this raffle.',
      status: 401,
    };
  }
  if (!(await canActAsFeeRecipient(payer, tokenAddress))) {
    return {
      ok: false,
      error: 'Only the fee recipient can fund raffle prize pools.',
      status: 403,
    };
  }
  return { ok: true, payer };
}

/**
 * Fee recipient funds a raffle prize pool via x402 ($Space).
 * Campaign id: custom-rfl-{raffleId} (Bankr x402 custom campaign).
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const wallet = getWalletFromRequest(req);
  const [beneficiaryWallet, community] = await Promise.all([
    getTokenBeneficiaryWallet(tokenAddress),
    getCommunity(tokenAddress),
  ]);
  const x402Cfg = community ? mergeCommunityDefaults(community).x402Config : null;
  const spaceFundUrl = x402Cfg?.fundUrl?.trim() || null;
  const spaceCreditUsd = x402Cfg?.creditUsd || RAFFLE_X402_CREDIT_USD;

  let body: {
    raffleId?: string;
    campaignId?: string;
    amountUsd?: number;
    xPayment?: string;
    pinFundBase?: string;
    pinFundUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raffleId =
    body.raffleId?.trim() ||
    (body.campaignId ? parseRaffleX402CampaignId(body.campaignId) : null);
  const campaignId = raffleId ? raffleX402CampaignId(raffleId) : '';
  const amountUsd = Number(body.amountUsd);
  const xPayment = typeof body.xPayment === 'string' ? body.xPayment.trim() : '';
  const pinFundBase = typeof body.pinFundBase === 'string' ? body.pinFundBase.trim() : '';
  const pinFundUrl = typeof body.pinFundUrl === 'string' ? body.pinFundUrl.trim() : '';

  if (!raffleId || !isRaffleX402CampaignId(campaignId)) {
    return NextResponse.json({ error: 'raffleId or custom-rfl-* campaignId required' }, { status: 400 });
  }
  if (!isBeneficiaryCampaignId(campaignId)) {
    return NextResponse.json({ error: 'Invalid raffle x402 campaign id' }, { status: 400 });
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: 'amountUsd must be a positive number' }, { status: 400 });
  }

  const payerCheck = await assertFeeRecipientPayer(tokenAddress, wallet, xPayment || undefined);
  if (!payerCheck.ok) {
    return NextResponse.json({ error: payerCheck.error }, { status: payerCheck.status });
  }

  const fetched = await fetchFundraisingX402Upstream({
    beneficiaryWallet,
    tokenAddress,
    campaignId,
    amountUsd,
    xPayment: xPayment || undefined,
    pinBaseUrl: pinFundBase || spaceFundUrl || undefined,
    pinFundUrl: pinFundUrl || undefined,
  });

  if ('error' in fetched) {
    return NextResponse.json({ error: fetched.error }, { status: fetched.status });
  }

  const { upstream, data, usedFallback, fundUrl, fundBase, paymentRequiredHeader } = fetched;

  if (!xPayment && upstream.status === 402) {
    return NextResponse.json(
      {
        requiresPayment: true,
        ...attachX402FundMeta(data, { fundUrl, fundBase, paymentRequiredHeader }),
        raffleId,
        campaignId,
      },
      { status: 200 }
    );
  }

  if (!xPayment) {
    return NextResponse.json(data, { status: upstream.status });
  }

  if (upstream.status >= 400) {
    const err = parseX402UpstreamError(data, upstream.headers);
    return NextResponse.json({ error: err }, { status: 400 });
  }

  const credit = await applyRaffleCredit(tokenAddress, campaignId, spaceCreditUsd);
  if (!credit.success) {
    return NextResponse.json(
      {
        error:
          credit.error ||
          'Payment succeeded but crediting the raffle failed. Contact support.',
        paymentTaken: true,
      },
      { status: credit.status >= 500 ? 502 : credit.status }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Thank you — $${spaceCreditUsd} credited toward raffle prize pool`,
    token: tokenAddress,
    raffleId: credit.raffle.id,
    campaignId,
    raisedUsd: credit.raisedUsd,
    goalUsd: credit.goalUsd,
    funded: credit.funded,
    raffle: credit.raffle,
    x402UsedFallback: usedFallback,
    spaceUrl: `https://www.bankr.space/community/${tokenAddress}`,
  });
}
