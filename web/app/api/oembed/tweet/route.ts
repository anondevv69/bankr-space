import { NextResponse } from 'next/server';
import { fetchTweetPreview } from '@/lib/tweet-oembed';
import { isTweetUrl } from '@/lib/tweet-url';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = String(searchParams.get('url') || '').trim();

  if (!url || !isTweetUrl(url)) {
    return NextResponse.json({ error: 'Valid X/Twitter status URL required' }, { status: 400 });
  }

  try {
    const preview = await fetchTweetPreview(url);
    if (!preview) {
      return NextResponse.json({ error: 'Tweet preview unavailable' }, { status: 404 });
    }

    return NextResponse.json(
      { ok: true, preview },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (err) {
    console.error('GET /api/oembed/tweet', err);
    return NextResponse.json({ error: 'Tweet preview failed' }, { status: 500 });
  }
}
