import { NextResponse } from 'next/server';
import {
  getCommunity,
  getPosts,
  setPostsForToken,
  updateCommunityCounts,
} from '@/lib/db';
import { holdsToken } from '@/lib/holder';
import { resolveAuthorProfile } from '@/lib/profiles';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const body = await req.json().catch(() => ({}));
  const content = String(body.content || '').trim();

  if (!content) {
    return NextResponse.json({ error: 'Post cannot be empty' }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: 'Post too long (max 2000 characters)' }, { status: 400 });
  }

  try {
    const community = await getCommunity(tokenAddress);
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const { holds, balance } = await holdsToken(
      wallet,
      tokenAddress,
      community.chain || 'base'
    );
    if (!holds) {
      return NextResponse.json(
        { error: 'You must hold at least 1 token to post' },
        { status: 403 }
      );
    }

    const author = await resolveAuthorProfile(wallet);
    const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newPost: Post = {
      id: postId,
      wallet,
      author,
      content,
      reactions: { '👍': [], '❤️': [], '🔥': [] },
      timestamp: Date.now(),
      balance,
    };

    const posts = await getPosts(tokenAddress);
    posts.push(newPost);
    await setPostsForToken(tokenAddress, posts);
    await updateCommunityCounts(tokenAddress, posts);

    return NextResponse.json({ success: true, postId, author, post: newPost });
  } catch (err) {
    console.error('POST /posts', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
