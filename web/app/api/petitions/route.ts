import { NextResponse } from 'next/server';
import { getPetitionSpaces } from '@/lib/petition-spaces';
import { createPetitionSpaceForWallet } from '@/lib/create-petition-space';
import { tmpFetchPetitionConfig } from '@/lib/tmp-petition';
import { getWalletFromRequest } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [spaces, config] = await Promise.all([
      getPetitionSpaces(),
      tmpFetchPetitionConfig().catch(() => null),
    ]);
    const open = spaces.filter((s) => s.phase === 'petition' || s.phase === 'finalizing');
    return NextResponse.json({
      petitions: open,
      all: spaces,
      config: config
        ? {
            baseEnabled: config.base?.enabled,
            priceEth: config.base?.priceEth,
            goalUnits: config.base?.goalUnits,
            publicSaleUnitsWithTmkClaim: config.base?.publicSaleUnitsWithTmkClaim,
            tmkClaimService: config.base?.tmkClaimService,
            tmkClaimReserveUnits: config.base?.tmkClaimReserveUnits,
          }
        : null,
    });
  } catch (err) {
    console.error('GET /api/petitions', err);
    return NextResponse.json({ error: 'Failed to load petitions' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    const result = await createPetitionSpaceForWallet({
      founderWallet: wallet,
      tokenName: String(body.tokenName || ''),
      tokenSymbol: String(body.tokenSymbol || ''),
      description: String(body.description || ''),
      supporterSlots: body.supporterSlots ? Number(body.supporterSlots) : null,
      maxUnitsPerWallet: body.maxUnitsPerWallet ? Number(body.maxUnitsPerWallet) : undefined,
      tmkClaimOptIn: body.tmkClaimOptIn === true,
      imageUrl: body.imageUrl ? String(body.imageUrl) : undefined,
    });

    return NextResponse.json({
      success: true,
      petition: result.petition,
      petitionUrl: result.petitionUrl,
      message: result.message,
    });
  } catch (err) {
    console.error('POST /api/petitions', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create petition' },
      { status: 500 }
    );
  }
}
