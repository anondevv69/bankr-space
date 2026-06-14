import { NextResponse } from 'next/server';
import { applyAgentPoolCredit } from '@/lib/apply-agent-pool-credit';
import { agentPoolX402CampaignId, parseAgentPoolX402CampaignId } from '@/lib/agent-pool';
import { fetchAgentPoolX402Upstream } from '@/lib/agent-pool-x402-fetch';
import { attachX402FundMeta } from '@/lib/x402-quote-response';
import { parseX402UpstreamError } from '@/lib/x402-upstream-error';
import { getPlatformAgentWallet } from '@/lib/platform-agent';
import { SPACE_FUND_X402_CREDIT_USD } from '@/lib/x402-config';
import { normalizeAddr } from '@/lib/utils';
import type { AgentPoolSkillId } from '@/lib/types';
import { isActiveAgentPoolSkill } from '@/lib/agent-pool-legacy-poidh';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

/**
 * Lane B x402 — $Space settles via Bankr x402; credits agentPool on bankr.space.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const platformWallet = getPlatformAgentWallet();

  if (!platformWallet) {
    return NextResponse.json(
      { error: 'Community agent pool unavailable — PLATFORM_AGENT_WALLET not configured' },
      { status: 503 }
    );
  }

  let body: { skillId?: string; campaignId?: string; amountUsd?: number; xPayment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let skillId = (body.skillId?.trim().toLowerCase() || '') as AgentPoolSkillId;
  if (!skillId && body.campaignId) {
    skillId = parseAgentPoolX402CampaignId(body.campaignId) as AgentPoolSkillId;
  }
  const amountUsd = Number(body.amountUsd);
  const xPayment = typeof body.xPayment === 'string' ? body.xPayment.trim() : '';

  if (!skillId) {
    return NextResponse.json({ error: 'skillId or agent-* campaignId required' }, { status: 400 });
  }
  if (!isActiveAgentPoolSkill(skillId)) {
    return NextResponse.json(
      {
        error:
          'POIDH bounties are not funded via x402. Create one in the Bounties tab — funding is in ETH on poidh.xyz.',
      },
      { status: 400 }
    );
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: 'amountUsd must be a positive number' }, { status: 400 });
  }

  const campaignId = agentPoolX402CampaignId(skillId);
  const fetched = await fetchAgentPoolX402Upstream({
    platformAgentWallet: platformWallet,
    tokenAddress,
    campaignId,
    amountUsd,
    xPayment: xPayment || undefined,
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
      },
      { status: 200 }
    );
  }

  if (!xPayment) {
    return NextResponse.json(data, { status: upstream.status });
  }

  if (upstream.status >= 400) {
    const err = parseX402UpstreamError(data, upstream.headers);
    console.error('agent-pool x402 upstream error', upstream.status, data, err);
    return NextResponse.json({ error: err }, { status: 400 });
  }

  const credit = await applyAgentPoolCredit(
    tokenAddress,
    skillId,
    SPACE_FUND_X402_CREDIT_USD
  );

  if (!credit.success) {
    console.error('agent-pool credit after payment', credit.error);
    return NextResponse.json(
      {
        error:
          credit.error ||
          '$Space payment succeeded but crediting the agent pool failed. Contact support.',
        paymentTaken: true,
      },
      { status: credit.status >= 500 ? 502 : credit.status }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Thank you — $${SPACE_FUND_X402_CREDIT_USD} credited toward community agent ${skillId} ($Space via x402)`,
    token: tokenAddress,
    skillId,
    raisedUsd: credit.raisedUsd,
    goalUsd: credit.goalUsd,
    funded: credit.funded,
    payTo: platformWallet,
    x402UsedFallback: usedFallback,
    spaceUrl: `https://www.bankr.space/community/${tokenAddress}`,
  });
}
