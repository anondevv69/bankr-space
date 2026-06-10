import { NextResponse } from 'next/server';
import { getCommunities, setCommunities } from '@/lib/db';
import { resolveAgentWallet } from '@/lib/bankr-agent-wallet';
import { getTokenBeneficiaryWallet, isTokenBeneficiary } from '@/lib/community-owner';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import {
  normalizeTrustedDelegates,
  trustedDelegateWallets,
} from '@/lib/space-delegates';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

/** Fee recipient: refresh agent tags for self + trusted delegate wallets. */
export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    if (!(await isTokenBeneficiary(wallet, tokenAddress))) {
      return NextResponse.json(
        { error: 'Only the fee recipient can resolve agent tags' },
        { status: 403 }
      );
    }

    const communities = await getCommunities();
    const index = communities.findIndex(
      (c) => c.tokenAddress.toLowerCase() === tokenAddress
    );
    if (index === -1) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const current = mergeCommunityDefaults(communities[index]);
    const beneficiaryWallet = (await getTokenBeneficiaryWallet(tokenAddress)) || wallet;

    const feeRecipientAgent = await resolveAgentWallet(beneficiaryWallet, {
      tokenAddress,
    });

    const delegates = normalizeTrustedDelegates(current.trustedDelegates);
    const trustedDelegates = await Promise.all(
      delegates.map(async (entry) => ({
        wallet: entry.wallet,
        agent: await resolveAgentWallet(entry.wallet, { tokenAddress }),
      }))
    );

    const updated = mergeCommunityDefaults({
      ...current,
      feeRecipientAgent,
      trustedDelegates,
    });

    communities[index] = updated;
    await setCommunities(communities);

    return NextResponse.json({
      success: true,
      feeRecipientAgent,
      trustedDelegates,
      trustedDelegateWallets: trustedDelegateWallets(trustedDelegates),
    });
  } catch (err) {
    console.error('POST team/resolve-agents', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
