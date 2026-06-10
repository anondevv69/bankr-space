import { NextResponse } from 'next/server';
import { canEditCommunityProfile } from '@/lib/community-owner';
import { assertImageFile, pinFileToIpfs, pinRemoteUrlToIpfs } from '@/lib/pinata';
import { normalizeBannerUrl } from '@/lib/banner-url';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type ImageKind = 'banner' | 'icon';

function parseKind(value: unknown): ImageKind {
  return String(value || 'banner').toLowerCase() === 'icon' ? 'icon' : 'banner';
}

export async function POST(req: Request) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    const tokenAddress = normalizeAddr(String(form.get('tokenAddress') || ''));
    const kind = parseKind(form.get('kind'));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }

    assertImageFile(file, kind === 'icon' ? 'Icon' : 'Banner');

    const allowed = await canEditCommunityProfile(wallet, tokenAddress);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Only the token fee beneficiary can upload images' },
        { status: 403 }
      );
    }

    const pinned = await pinFileToIpfs(file, file.name || `${kind}.webp`, {
      tokenAddress,
      uploadedBy: wallet.toLowerCase(),
      kind: kind === 'icon' ? 'space-icon' : 'space-banner',
    });

    return NextResponse.json({
      success: true,
      kind,
      cid: pinned.cid,
      ipfsUri: pinned.ipfsUri,
      gatewayUrl: pinned.gatewayUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    const status = message.includes('not configured') ? 503 : 400;
    console.error('POST /api/upload/banner', err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** Pin a remote https URL through Pinata (beneficiary paste). */
export async function PUT(req: Request) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tokenAddress = normalizeAddr(String(body.tokenAddress || ''));
    const kind = parseKind(body.kind);
    const sourceUrl = String(body.url || '').trim();

    if (!sourceUrl) {
      return NextResponse.json({ error: 'url required' }, { status: 400 });
    }

    const allowed = await canEditCommunityProfile(wallet, tokenAddress);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Only the token fee beneficiary can upload images' },
        { status: 403 }
      );
    }

    const normalized = normalizeBannerUrl(sourceUrl);
    if (normalized && sourceUrl.startsWith('ipfs://')) {
      return NextResponse.json({
        success: true,
        kind,
        ipfsUri: sourceUrl,
        gatewayUrl: normalized,
      });
    }

    const pinned = await pinRemoteUrlToIpfs(sourceUrl, `${kind}-${tokenAddress.slice(2, 10)}`, {
      tokenAddress,
      uploadedBy: wallet.toLowerCase(),
      kind: kind === 'icon' ? 'space-icon' : 'space-banner',
    });

    return NextResponse.json({
      success: true,
      kind,
      cid: pinned.cid,
      ipfsUri: pinned.ipfsUri,
      gatewayUrl: pinned.gatewayUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    const status = message.includes('not configured') ? 503 : 400;
    console.error('PUT /api/upload/banner', err);
    return NextResponse.json({ error: message }, { status });
  }
}
