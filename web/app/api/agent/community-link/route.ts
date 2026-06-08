import { NextResponse } from 'next/server';
import { resolveCommunityLink } from '@/lib/resolve-community';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q =
    searchParams.get('symbol') ||
    searchParams.get('token') ||
    searchParams.get('q') ||
    '';

  try {
    const result = await resolveCommunityLink(q);

    if (!result.ok || !result.communityLink) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || 'Community not found',
          communityLink: null,
          hint: 'Try GET /api/agent/resolve-community?q=' + q,
        },
        { status: 404 }
      );
    }

    if (searchParams.get('format') === 'text') {
      return new NextResponse(result.communityLink, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      ok: true,
      symbol: result.symbol,
      tokenAddress: result.tokenAddress,
      communityExists: result.communityExists,
      communityLink: result.communityLink,
      linkReply: result.linkReply,
      replyText: result.replyText,
      tweetReply: result.tweetReply,
      source: result.source,
      hint: result.hint,
      matches: result.matches,
      communityUrlTemplate:
        'https://bankr-community.vercel.app/community/{tokenContractAddress}',
      forbiddenLinks: ['https://bankr.bot', 'bankr.bot', 't.co'],
      instruction:
        'Paste communityLink exactly as the tweet reply. Never use bankr.bot.',
    });
  } catch (err) {
    console.error('GET /api/agent/community-link', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
