import { NextResponse } from 'next/server';
import { getCommunities } from '@/lib/db';
import { communityUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token')?.toLowerCase();
  const symbol = searchParams.get('symbol')?.toUpperCase();

  try {
    const communities = await getCommunities();
    const community = token
      ? communities.find((c) => c.tokenAddress.toLowerCase() === token)
      : symbol
        ? communities.find((c) => c.symbol.toUpperCase() === symbol)
        : null;

    if (!community) {
      return NextResponse.json(
        { ok: false, error: 'Community not found', communityLink: null },
        { status: 404 }
      );
    }

    const link = communityUrl(community.tokenAddress);
    const format = searchParams.get('format');

    if (format === 'text') {
      return new NextResponse(link, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return NextResponse.json({
      ok: true,
      symbol: community.symbol,
      tokenAddress: community.tokenAddress,
      communityLink: link,
      linkReply: link,
      replyText: link,
      tweetReply: link,
      communityUrlTemplate: 'https://bankr-community.vercel.app/community/{tokenContractAddress}',
      forbiddenLinks: ['https://bankr.bot', 'bankr.bot', 't.co'],
      instruction:
        'Paste communityLink exactly as the tweet reply. Never use bankr.bot — communities live on bankr-community.vercel.app/community/0x{contract}.',
    });
  } catch (err) {
    console.error('GET /api/agent/community-link', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
