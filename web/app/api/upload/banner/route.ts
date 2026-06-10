import { NextResponse } from 'next/server';
import { canEditCommunityProfile } from '@/lib/community-owner';
import { assertBannerFile, pinFileToIpfs } from '@/lib/pinata';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    const tokenAddress = normalizeAddr(String(form.get('tokenAddress') || ''));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }

    assertBannerFile(file);

    const allowed = await canEditCommunityProfile(wallet, tokenAddress);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Only the token fee beneficiary can upload a banner' },
        { status: 403 }
      );
    }

    const pinned = await pinFileToIpfs(file, file.name || 'banner.webp', {
      tokenAddress,
      uploadedBy: wallet.toLowerCase(),
      kind: 'space-banner',
    });

    return NextResponse.json({
      success: true,
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
