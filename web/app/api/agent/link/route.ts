import { NextResponse } from 'next/server';
import { resolveCommunityLink } from '@/lib/resolve-community';

export const dynamic = 'force-dynamic';

/** Plain-text link lookup — response body is the tweet reply (no JSON parsing). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q =
    searchParams.get('q') ||
    searchParams.get('symbol') ||
    searchParams.get('token') ||
    searchParams.get('name') ||
    '';

  try {
    const result = await resolveCommunityLink(q);
    const text = result.communityLink || result.tweetReply || result.error;

    if (!text) {
      return new NextResponse('Not found', { status: 404 });
    }

    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    console.error('GET /api/agent/link', err);
    return new NextResponse('Server error', { status: 500 });
  }
}
