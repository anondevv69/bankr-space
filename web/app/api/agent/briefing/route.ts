import { NextResponse } from 'next/server';
import {
  getCommunity,
  getCommunities,
  getPosts,
  getLaunches,
  getSyncUpdatedAt,
} from '@/lib/db';
import { fetchLaunchByAddress } from '@/lib/bankr-api';
import { communityUrl, getSiteUrl } from '@/lib/site-url';
import { buildBriefingReplyText } from '@/lib/agent-reply';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token')?.toLowerCase();
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const query = searchParams.get('q')?.trim();

  try {
    const [communities, syncAt, launches] = await Promise.all([
      getCommunities(),
      getSyncUpdatedAt(),
      getLaunches(),
    ]);

    let community = token
      ? communities.find((c) => c.tokenAddress.toLowerCase() === token)
      : symbol
        ? communities.find((c) => c.symbol.toUpperCase() === symbol)
        : query
          ? communities.find(
              (c) =>
                c.symbol.toLowerCase().includes(query.toLowerCase()) ||
                c.name.toLowerCase().includes(query.toLowerCase()) ||
                c.tokenAddress.toLowerCase().includes(query.toLowerCase())
            )
          : null;

    let launch = token
      ? launches.find((l) => l.tokenAddress?.toLowerCase() === token)
      : null;

    if (!launch && community) {
      launch =
        launches.find(
          (l) => l.tokenAddress?.toLowerCase() === community!.tokenAddress.toLowerCase()
        ) || null;
    }

    if (!community && token) {
      launch = launch || (await fetchLaunchByAddress(token));
    }

    const posts = community ? await getPosts(community.tokenAddress) : [];
    const recentPosts = posts.slice(-5).reverse();

    const opportunities: Array<{ type: string; message: string }> = [];

    if (!community && launch) {
      opportunities.push({
        type: 'create_community',
        message: `No community for ${launch.tokenSymbol} yet — anyone can start one at the site.`,
      });
    }

    if (community && !community.verified) {
      opportunities.push({
        type: 'verify_pending',
        message: `Community for $${community.symbol} is unverified — token owner can verify.`,
      });
    }

    if (community && community.postCount === 0) {
      opportunities.push({
        type: 'first_post',
        message: `No posts yet in $${community.symbol} community — holders can be first.`,
      });
    }

    const siteUrl = getSiteUrl();
    const pageLink = community ? communityUrl(community.tokenAddress) : null;

    return NextResponse.json({
      ok: true,
      siteUrl,
      communityLink: pageLink,
      replyText: community ? buildBriefingReplyText(community, recentPosts) : null,
      syncedAt: syncAt,
      totalCommunities: communities.length,
      community: community || null,
      launch: launch || null,
      stats: community
        ? {
            postCount: community.postCount,
            memberCount: community.memberCount,
            verified: community.verified,
            chain: community.chain,
          }
        : null,
      recentPosts: recentPosts.map((p) => ({
        id: p.id,
        content: p.content.slice(0, 280),
        wallet: p.wallet,
        author: p.author,
        timestamp: p.timestamp,
        reactions: p.reactions,
      })),
      opportunities,
      links: {
        communityPage: pageLink,
        allCommunities: siteUrl,
        agentGuide: `${siteUrl}/agent.md`,
      },
      agentActions: {
        briefing: 'GET /api/agent/briefing?token=0x… or ?symbol=TMP',
        searchTokens: 'GET /api/tokens/search?q=',
        listCommunities: 'GET /api/communities',
        createCommunity: 'POST /api/communities/{token} header x-wallet-address',
        post: 'POST /api/communities/{token}/posts header x-wallet-address',
        verify: 'POST /api/communities/{token}/verify header x-wallet-address',
        checkHolder: 'GET /api/holders/{token}?wallet=0x…',
        react: 'POST /api/posts/{postId}/react header x-wallet-address',
      },
    });
  } catch (err) {
    console.error('GET /api/agent/briefing', err);
    return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 503 });
  }
}
