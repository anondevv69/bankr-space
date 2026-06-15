import { NextResponse } from 'next/server';
import { applyFundraisingCredit } from '@/lib/apply-fundraising-credit';
import { getTokenBeneficiaryWallet } from '@/lib/community-owner';
import { isBeneficiaryCampaignId } from '@/lib/fundraising';
import { fetchFundraisingX402Upstream } from '@/lib/fundraising-x402-fetch';
import { attachX402FundMeta } from '@/lib/x402-quote-response';
import {
  getX402UpstreamErrorDetail,
  parseX402UpstreamErrorDetailed,
} from '@/lib/x402-upstream-error';
import { SPACE_FUND_X402_CREDIT_USD } from '@/lib/x402-config';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

/**
 * Same-origin proxy for the shared Bankr x402 fund endpoint. Browsers cannot send PAYMENT-SIGNATURE
 * cross-origin to x402.bankr.bot (CORS preflight fails on 402).
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const beneficiaryWallet = await getTokenBeneficiaryWallet(tokenAddress);

  let body: {
    campaignId?: string;
    amountUsd?: number;
    xPayment?: string;
    pinFundBase?: string;
    pinFundUrl?: string;
    pinPaymentRequiredHeader?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const campaignId = String(body.campaignId || 'dex-profile').trim();
  const amountUsd = Number(body.amountUsd);
  const xPayment = typeof body.xPayment === 'string' ? body.xPayment.trim() : '';
  const pinFundBase = typeof body.pinFundBase === 'string' ? body.pinFundBase.trim() : '';
  const pinFundUrl = typeof body.pinFundUrl === 'string' ? body.pinFundUrl.trim() : '';
  const pinPaymentRequiredHeader =
    typeof body.pinPaymentRequiredHeader === 'string'
      ? body.pinPaymentRequiredHeader.trim()
      : '';

  if (!isBeneficiaryCampaignId(campaignId)) {
    return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 });
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: 'amountUsd must be a positive number' }, { status: 400 });
  }

  try {
    const fetched = await fetchFundraisingX402Upstream({
      beneficiaryWallet,
      tokenAddress,
      campaignId,
      amountUsd,
      xPayment: xPayment || undefined,
      pinBaseUrl: pinFundBase || undefined,
      pinFundUrl: pinFundUrl || undefined,
    });

    if ('error' in fetched) {
      return NextResponse.json({ error: fetched.error }, { status: fetched.status });
    }

    const { upstream, data, usedFallback, fundBase, fundUrl, paymentRequiredHeader } = fetched;

    if (!xPayment && upstream.status === 402) {
      return NextResponse.json(
        {
          requiresPayment: true,
          ...attachX402FundMeta(data, { fundUrl, fundBase, paymentRequiredHeader }),
          x402UsedFallback: usedFallback,
          x402FundBase: fundBase,
        },
        { status: 200 }
      );
    }

    if (!xPayment) {
      return NextResponse.json(data, { status: upstream.status });
    }

    if (upstream.status >= 400) {
      const detail = await getX402UpstreamErrorDetail(
        xPayment,
        pinPaymentRequiredHeader || paymentRequiredHeader,
        upstream.headers
      );
      const err = await parseX402UpstreamErrorDetailed(
        data,
        upstream.headers,
        xPayment,
        pinPaymentRequiredHeader || paymentRequiredHeader
      );
      const upstreamReason =
        typeof data.reason === 'string'
          ? data.reason
          : detail?.invalidReason;
      console.error('x402 upstream error', upstream.status, data, err);
      return NextResponse.json(
        {
          error: detail?.message || err,
          ...(upstreamReason ? { x402InvalidReason: upstreamReason } : {}),
          ...(detail?.payer ? { x402Payer: detail.payer } : {}),
          ...(detail?.payment ? { x402Payment: detail.payment } : {}),
        },
        { status: xPayment ? 400 : upstream.status }
      );
    }

    const handlerCredited =
      data.success === true &&
      Number(data.raisedUsd) > 0 &&
      Number(data.goalUsd) > 0;
    if (handlerCredited) {
      return NextResponse.json(data, { status: 200 });
    }

    const credit = await applyFundraisingCredit(
      tokenAddress,
      campaignId,
      SPACE_FUND_X402_CREDIT_USD
    );

    if (!credit.success) {
      console.error('x402 credit after payment', credit.error);
      return NextResponse.json(
        {
          error:
            credit.error ||
            '$Space payment succeeded but crediting the goal failed. Contact the space operator.',
          paymentTaken: true,
        },
        { status: credit.status >= 500 ? 502 : credit.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Thank you — $${SPACE_FUND_X402_CREDIT_USD} credited toward ${campaignId} ($Space via x402)`,
      token: tokenAddress,
      campaignId,
      raisedUsd: credit.raisedUsd,
      goalUsd: credit.goalUsd,
      funded: credit.funded,
      x402UsedFallback: usedFallback,
      spaceUrl: `https://www.bankr.space/community/${tokenAddress}`,
    });
  } catch (err) {
    console.error('x402 proxy', err);
    return NextResponse.json({ error: 'Failed to complete x402 payment' }, { status: 502 });
  }
}
