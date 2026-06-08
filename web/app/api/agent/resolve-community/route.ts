import { NextResponse } from 'next/server';
import { resolveCommunityLink } from '@/lib/resolve-community';

export const dynamic = 'force-dynamic';

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

    if (searchParams.get('format') === 'text') {
      const text = result.communityLink || result.tweetReply || result.error;
      if (!text) {
        return new NextResponse('Not found', { status: 404 });
      }
      return new NextResponse(text, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (!result.ok) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json({
      ...result,
      communityUrlTemplate:
        'https://bankr-community.vercel.app/community/{tokenContractAddress}',
      forbiddenLinks: ['https://bankr.bot', 'bankr.bot', 't.co'],
      instruction:
        'If communityExists paste communityLink. If suggestCreateCommunity paste tweetReply asking to create — on yes POST createCommunityAction then reply with new communityLink.',
    });
  } catch (err) {
    console.error('GET /api/agent/resolve-community', err);
    return NextResponse.json(
      { ok: false, error: 'Server error', communityLink: null },
      { status: 500 }
    );
  }
}
