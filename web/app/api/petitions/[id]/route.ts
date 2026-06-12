import { NextResponse } from 'next/server';
import { getCommunity } from '@/lib/db';
import {
  getPetitionSpace,
  isPetitionFounder,
} from '@/lib/petition-spaces';
import { syncPetitionFromTmp, upgradePetitionToCommunity } from '@/lib/petition-finalize';
import { tmpGetPetitionStatus, tmpPrepareDeposit } from '@/lib/tmp-petition';
import { getWalletFromRequest } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const space = await getPetitionSpace(id);
    if (!space) {
      return NextResponse.json({ error: 'Petition space not found' }, { status: 404 });
    }

    const { space: synced, tmpStatus } = await syncPetitionFromTmp(space);
    const status = await tmpGetPetitionStatus(id);
    const petition = status.petition;
    const orderWallets = (petition.orders || []).map((o) => o.wallet);

    const existingCommunity = synced.tokenAddress
      ? await getCommunity(synced.tokenAddress)
      : null;

    return NextResponse.json({
      space: synced,
      tmp: {
        status: tmpStatus,
        petition,
        petitionUrl: status.petitionUrl,
        agentParticipation: status.agentParticipation,
      },
      progress: {
        soldUnits: petition.soldUnits,
        goalUnits: petition.goalUnits,
        pct: petition.goalUnits
          ? Math.min(100, Math.round((petition.soldUnits / petition.goalUnits) * 100))
          : 0,
      },
      needsUpgrade: tmpStatus === 'finalized' && !!synced.tokenAddress && !existingCommunity,
      redirectTo:
        synced.tokenAddress && existingCommunity
          ? `/community/${synced.tokenAddress}`
          : null,
      backers: petition.orders || [],
      orderWallets,
    });
  } catch (err) {
    console.error('GET /api/petitions/[id]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load petition' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { id } = await params;
  const space = await getPetitionSpace(id);
  if (!space) {
    return NextResponse.json({ error: 'Petition space not found' }, { status: 404 });
  }
  if (!isPetitionFounder(space, wallet)) {
    return NextResponse.json({ error: 'Only the petition creator can edit' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const description =
    body.description !== undefined ? String(body.description).trim() : space.description;
  const imageUrl =
    body.imageUrl !== undefined
      ? body.imageUrl
        ? String(body.imageUrl).trim()
        : null
      : space.imageUrl;

  if (description.length < 4) {
    return NextResponse.json({ error: 'Description too short' }, { status: 400 });
  }

  const updated = {
    ...space,
    description,
    imageUrl,
    updatedAt: Date.now(),
  };
  const { savePetitionSpace } = await import('@/lib/petition-spaces');
  await savePetitionSpace(updated);

  return NextResponse.json({ success: true, space: updated });
}

export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'upgrade');

  if (action === 'upgrade') {
    try {
      const result = await upgradePetitionToCommunity({ petitionId: id, wallet });
      return NextResponse.json({
        success: true,
        ...result,
        redirectTo: result.communityPage,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Upgrade failed' },
        { status: 400 }
      );
    }
  }

  if (action === 'prepare-deposit') {
    const units = Math.max(1, Number(body.units) || 1);
    const launchBuyWei = String(body.launchBuyWei || '0');
    try {
      const space = await getPetitionSpace(id);
      if (!space) {
        return NextResponse.json({ error: 'Petition space not found' }, { status: 404 });
      }
      const prepare = await tmpPrepareDeposit({
        id,
        wallet,
        units,
        launchBuyWei,
      });
      return NextResponse.json({ success: true, prepare, space });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Prepare failed' },
        { status: 400 }
      );
    }
  }

  if (action === 'confirm') {
    const units = Math.max(1, Number(body.units) || 1);
    const signature = String(body.signature || '').trim();
    const launchBuyWei = String(body.launchBuyWei || '0');
    if (!/^0x[a-fA-F0-9]{64}$/.test(signature)) {
      return NextResponse.json({ error: 'Valid deposit tx hash required' }, { status: 400 });
    }
    try {
      const { tmpConfirmDeposit } = await import('@/lib/tmp-petition');
      const confirm = await tmpConfirmDeposit({
        id,
        wallet,
        units,
        signature,
        launchBuyWei,
      });
      const space = await getPetitionSpace(id);
      if (space) {
        await syncPetitionFromTmp(space);
      }
      return NextResponse.json({ success: true, confirm });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Confirm failed' },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
