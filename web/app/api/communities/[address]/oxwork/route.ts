import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { getTokenBeneficiaryWallet } from '@/lib/community-owner';
import { fetchOxWorkTasksForSpace } from '@/lib/oxwork-api';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const posterWallet =
      (await getTokenBeneficiaryWallet(tokenAddress)) || community.ownerWallet;
    if (!posterWallet) {
      return NextResponse.json({ tasks: [], total: 0, symbol: community.symbol });
    }

    const data = await fetchOxWorkTasksForSpace({
      posterWallet,
      symbol: community.symbol,
      tokenAddress,
    });

    return NextResponse.json({
      ...data,
      platformAgentSkills: !!community.platformAgentSkills,
      usePlatformAgent: !!community.usePlatformAgent,
      links: {
        oxwork: 'https://0xwork.org',
        manifest: 'https://api.0xwork.org/manifest.json',
      },
    });
  } catch (err) {
    console.error('GET oxwork', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
