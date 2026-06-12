import { NextResponse } from 'next/server';
import {
  getPetitionPosts,
  getPetitionSpace,
  isPetitionBacker,
  isPetitionFounder,
  setPetitionPosts,
} from '@/lib/petition-spaces';
import { tmpGetPetitionStatus } from '@/lib/tmp-petition';
import { resolveAuthorProfile } from '@/lib/profiles';
import { getWalletFromRequest } from '@/lib/utils';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

async function canPostOnPetition(petitionId: string, wallet: string): Promise<boolean> {
  const space = await getPetitionSpace(petitionId);
  if (!space) return false;
  if (isPetitionFounder(space, wallet)) return true;
  try {
    const status = await tmpGetPetitionStatus(petitionId);
    const wallets = (status.petition.orders || []).map((o) => o.wallet);
    return isPetitionBacker(space, wallet, wallets);
  } catch {
    return isPetitionFounder(space, wallet);
  }
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const space = await getPetitionSpace(id);
  if (!space) {
    return NextResponse.json({ error: 'Petition space not found' }, { status: 404 });
  }
  const posts = await getPetitionPosts(id);
  return NextResponse.json({ posts });
}

export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { id } = await params;
  const space = await getPetitionSpace(id);
  if (!space) {
    return NextResponse.json({ error: 'Petition space not found' }, { status: 404 });
  }

  const allowed = await canPostOnPetition(id, wallet);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Back the petition or be the creator to post' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body.content || '').trim();
  if (!content) {
    return NextResponse.json({ error: 'Post cannot be empty' }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: 'Post too long (max 2000 characters)' }, { status: 400 });
  }

  const author = await resolveAuthorProfile(wallet);
  const post: Post = {
    id: `petition-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    wallet: wallet.toLowerCase(),
    author,
    content,
    reactions: {},
    timestamp: Date.now(),
    source: { client: 'web', trigger: 'manual' },
  };

  const posts = await getPetitionPosts(id);
  posts.unshift(post);
  await setPetitionPosts(id, posts);

  return NextResponse.json({ success: true, post });
}
