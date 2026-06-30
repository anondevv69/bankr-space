import { NextResponse } from 'next/server';
import { resolveTweetMediaFromStatusUrl } from '@/lib/tweet-media';
import { isTweetUrl } from '@/lib/tweet-url';

export const dynamic = 'force-dynamic';

/** Resolve pbs.twimg.com image URLs from a tweet — hotlink, no IPFS pin. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = String(searchParams.get('url') || '').trim();
  const indexRaw = searchParams.get('index');
  const index = indexRaw !== null && indexRaw !== '' ? Number(indexRaw) : undefined;

  if (!url || !isTweetUrl(url)) {
    return NextResponse.json({ error: 'Valid X/Twitter status URL required' }, { status: 400 });
  }

  try {
    const resolved = await resolveTweetMediaFromStatusUrl(url, {
      index: Number.isFinite(index) ? index : undefined,
    });
    if (!resolved) {
      return NextResponse.json({ error: 'No images found on this tweet' }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
        ...resolved,
        hint: 'PATCH customBannerUrl/customIconUrl with suggested URLs — stored as hotlinks (no Pinata).',
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    console.error('GET /api/oembed/tweet/media', err);
    return NextResponse.json({ error: 'Tweet media lookup failed' }, { status: 500 });
  }
}
