import { NextResponse } from 'next/server';
import {
  createPetitionSpaceRecord,
  getPetitionSpaces,
  savePetitionSpace,
} from '@/lib/petition-spaces';
import { petitionUrl } from '@/lib/site-url';
import { tmpCreatePetition, tmpFetchPetitionConfig } from '@/lib/tmp-petition';
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
  const tokenName = String(body.tokenName || '').trim();
  const tokenSymbol = String(body.tokenSymbol || '')
    .trim()
    .replace(/^\$/, '')
    .toUpperCase();
  const description = String(body.description || '').trim();
  const supporterSlots = body.supporterSlots ? Number(body.supporterSlots) : null;
  const maxUnitsPerWallet = Math.min(
    1000,
    Math.max(1, Number(body.maxUnitsPerWallet) || 10)
  );
  const tmkClaimOptIn = body.tmkClaimOptIn === true;
  const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : undefined;

  if (tokenName.length < 2) {
    return NextResponse.json({ error: 'Token name required (min 2 chars)' }, { status: 400 });
  }
  if (!/^[A-Z0-9]{1,10}$/.test(tokenSymbol)) {
    return NextResponse.json(
      { error: 'Symbol required — letters/numbers only, max 10 chars' },
      { status: 400 }
    );
  }
  if (description.length < 4) {
    return NextResponse.json({ error: 'Description required (min 4 chars)' }, { status: 400 });
  }

  try {
    const config = await tmpFetchPetitionConfig();
    if (!config.base?.enabled) {
      return NextResponse.json(
        { error: 'Base petitions are not enabled on TMP right now' },
        { status: 503 }
      );
    }
    if (tmkClaimOptIn && !config.base.tmkClaimService) {
      return NextResponse.json(
        { error: 'TMK claim service is not available right now' },
        { status: 503 }
      );
    }

    const createBody: Parameters<typeof tmpCreatePetition>[0] = {
      chain: 'base',
      tokenName,
      tokenSymbol,
      starterWallet: wallet,
      description,
      imageUrl,
      websiteUrl: `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://bankr.space'}/community/petition`,
      tmkClaimOptIn: tmkClaimOptIn || undefined,
    };
    if (supporterSlots && supporterSlots >= 1) {
      createBody.supporterSlots = Math.min(1000, Math.floor(supporterSlots));
    } else {
      createBody.maxUnitsPerWallet = maxUnitsPerWallet;
    }

    const tmpPetition = await tmpCreatePetition(createBody);

    const space = createPetitionSpaceRecord({
      tmpPetitionId: tmpPetition.id,
      founderWallet: wallet,
      tokenName,
      tokenSymbol,
      description,
      maxUnitsPerWallet: tmpPetition.maxUnitsPerWallet || maxUnitsPerWallet,
      supporterSlots: tmpPetition.supporterSlots ?? supporterSlots,
      tmkClaimOptIn: tmpPetition.tmkClaimOptIn ?? tmkClaimOptIn,
      imageUrl: imageUrl || tmpPetition.imageUrl || null,
    });
    space.websiteUrl = petitionUrl(tmpPetition.id);
    await savePetitionSpace(space);

    const publicCap = tmkClaimOptIn
      ? config.base.publicSaleUnitsWithTmkClaim || 999
      : config.base.goalUnits;

    return NextResponse.json({
      success: true,
      petition: space,
      tmp: tmpPetition,
      petitionUrl: space.websiteUrl,
      message: `Petition space created for $${tokenSymbol}. Back with ETH to reach ${publicCap} units.`,
    });
  } catch (err) {
    console.error('POST /api/petitions', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create petition' },
      { status: 500 }
    );
  }
}
