import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import { getPetitionSpaceByToken } from '@/lib/petition-spaces';
import { tmpFetchHoldersByToken, tmpGetPetitionStatus } from '@/lib/tmp-petition';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);

  try {
    const community = await getCommunity(tokenAddress);
    const petitionSpace = await getPetitionSpaceByToken(tokenAddress);

    let holders: Array<{ wallet: string; units: string; sharePct: number }> = [];
    let source: 'cap_table' | 'petition_orders' | null = null;

    const cap = await tmpFetchHoldersByToken(tokenAddress);
    if (cap?.capTable?.holders?.length) {
      holders = cap.capTable.holders;
      source = 'cap_table';
    } else if (petitionSpace?.tmpPetitionId) {
      try {
        const status = await tmpGetPetitionStatus(petitionSpace.tmpPetitionId);
        holders = (status.petition.orders || []).map((o) => ({
          wallet: o.wallet,
          units: String(o.units),
          sharePct: 0,
        }));
        source = 'petition_orders';
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      tokenAddress,
      fromPetition: !!(community?.fromPetition || petitionSpace),
      tmpPetitionId: community?.tmpPetitionId || petitionSpace?.tmpPetitionId || null,
      holderCount: holders.length,
      holders,
      source,
    });
  } catch (err) {
    console.error('GET holders', err);
    return NextResponse.json({ error: 'Failed to load holders' }, { status: 500 });
  }
}
