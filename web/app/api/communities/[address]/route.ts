import { NextResponse } from 'next/server';
import {
  getCommunity,
  getCommunities,
  getAllPosts,
  getLaunches,
  setCommunities,
  setPostsForToken,
} from '@/lib/db';
import {
  fetchLaunchByAddress,
  isLaunchOwner,
  getLaunchOwnerWallets,
} from '@/lib/bankr-api';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  try {
    const [community, posts] = await Promise.all([
      getCommunity(tokenAddress),
      import('@/lib/db').then((m) => m.getPosts(tokenAddress)),
    ]);
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }
    return NextResponse.json({ community, posts });
  } catch (err) {
    console.error('GET community', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const body = await req.json().catch(() => ({}));
  const description = String(body.description || '').trim();

  try {
    let launch = (await getLaunches()).find(
      (l) => l.tokenAddress?.toLowerCase() === tokenAddress
    );
    if (!launch) {
      launch = (await fetchLaunchByAddress(tokenAddress)) || undefined;
    }
    if (!launch) {
      return NextResponse.json(
        { error: 'Token not found in Bankr launches. It must be deployed via Bankr.' },
        { status: 400 }
      );
    }

    const communities = await getCommunities();
    if (communities.some((c) => c.tokenAddress.toLowerCase() === tokenAddress)) {
      return NextResponse.json(
        { error: 'A community already exists for this token' },
        { status: 409 }
      );
    }

    const isOwner = isLaunchOwner(launch, wallet);
    const { feeRecipient, deployer } = getLaunchOwnerWallets(launch);

    const community = {
      tokenAddress: launch.tokenAddress,
      name: launch.tokenName,
      symbol: launch.tokenSymbol,
      chain: launch.chain || 'base',
      founderWallet: wallet,
      ownerWallet: feeRecipient || deployer,
      verified: isOwner,
      verifiedAt: isOwner ? Date.now() : null,
      verifiedBy: isOwner ? wallet : null,
      description: description || `${launch.tokenName} holder community`,
      postCount: 0,
      memberCount: 0,
      createdAt: Date.now(),
      launchTimestamp: launch.timestamp,
    };

    communities.unshift(community);
    await setCommunities(communities);

    const allPosts = await getAllPosts();
    if (!allPosts[tokenAddress]) {
      await setPostsForToken(tokenAddress, []);
    }

    return NextResponse.json({ success: true, community, autoVerified: isOwner });
  } catch (err) {
    console.error('POST community', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
