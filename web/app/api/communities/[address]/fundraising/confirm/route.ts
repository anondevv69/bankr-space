import { NextResponse } from 'next/server';
import { applyFundraisingCredit } from '@/lib/apply-fundraising-credit';
import { getTokenBeneficiaryWallet } from '@/lib/community-owner';
import { CAMPAIGN_IDS, type CampaignId } from '@/lib/fundraising';
import { kvGet, kvSet } from '@/lib/kv-store';
import { normalizeAddr } from '@/lib/utils';
import { verifyUsdcTransfer } from '@/lib/verify-usdc-transfer';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

const MAX_CONTRIBUTION_USD = 10_000;
const TX_KEY_PREFIX = 'fundraising-tx:';

function isTxHash(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

export async function POST(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  let body: {
    campaignId?: string;
    amountUsd?: number;
    txHash?: string;
    donorWallet?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const campaignId = String(body.campaignId || 'dex-profile').trim() as CampaignId;
  const amountUsd = Number(body.amountUsd);
  const txHash = String(body.txHash || '').trim();
  const donorWallet = normalizeAddr(String(body.donorWallet || '').trim());

  if (!CAMPAIGN_IDS.includes(campaignId)) {
    return NextResponse.json({ error: 'Invalid campaignId' }, { status: 400 });
  }
  if (!Number.isFinite(amountUsd) || amountUsd < 1 || amountUsd > MAX_CONTRIBUTION_USD) {
    return NextResponse.json(
      { error: `amountUsd must be between 1 and ${MAX_CONTRIBUTION_USD}` },
      { status: 400 }
    );
  }
  if (!isTxHash(txHash)) {
    return NextResponse.json({ error: 'Invalid txHash' }, { status: 400 });
  }
  if (!donorWallet) {
    return NextResponse.json({ error: 'donorWallet is required' }, { status: 400 });
  }

  const txKey = `${TX_KEY_PREFIX}${txHash.toLowerCase()}`;
  const existing = await kvGet<{ tokenAddress: string }>(txKey);
  if (existing) {
    return NextResponse.json({ error: 'This transaction was already credited' }, { status: 409 });
  }

  const beneficiaryWallet = await getTokenBeneficiaryWallet(tokenAddress);
  if (!beneficiaryWallet) {
    return NextResponse.json({ error: 'Space beneficiary wallet not found' }, { status: 404 });
  }

  const verified = await verifyUsdcTransfer({
    txHash,
    from: donorWallet as `0x${string}`,
    to: beneficiaryWallet as `0x${string}`,
    minAmountUsd: amountUsd,
  });

  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  const credit = await applyFundraisingCredit(tokenAddress, campaignId, verified.amountUsd);
  if (!credit.success) {
    console.error('confirm credit', credit.error);
    return NextResponse.json({ error: credit.error }, { status: credit.status });
  }

  await kvSet(txKey, {
    tokenAddress,
    campaignId,
    creditedUsd: verified.amountUsd,
    donorWallet,
    creditedAt: Date.now(),
  });

  return NextResponse.json({
    success: true,
    message: `Thank you — $${verified.amountUsd} USDC credited toward ${campaignId}`,
    tokenAddress,
    campaignId,
    creditedUsd: verified.amountUsd,
    raisedUsd: credit.raisedUsd,
    goalUsd: credit.goalUsd,
    funded: credit.funded,
    txHash,
  });
}
