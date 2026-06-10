import { NextResponse } from 'next/server';
import {
  getCommunity,
  getCommunities,
  getAllPosts,
  getLaunches,
  setCommunities,
  setPostsForToken,
  getPosts,
} from '@/lib/db';
import {
  fetchLaunchByAddress,
  isLaunchOwner,
  getLaunchOwnerWallets,
} from '@/lib/bankr-api';
import { isTokenBeneficiary, canEditCommunityProfile } from '@/lib/community-owner';
import { getBeneficiaryInfo } from '@/lib/beneficiary';
import { mergeCommunityDefaults, sortPostsWithPinned } from '@/lib/community-posts';
import { enrichCommunityWithImage, withCommunityImageUrl } from '@/lib/community-image';
import { normalizeSocialLinks } from '@/lib/social-links';
import { normalizeBannerUrl, resolveDisplayBannerUrl } from '@/lib/banner-url';
import { fetchTokenMarketStats } from '@/lib/dexscreener';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';
import { communityUrl } from '@/lib/site-url';
import type { SocialLinks } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ address: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  try {
    const [community, posts] = await Promise.all([
      getCommunity(tokenAddress),
      getPosts(tokenAddress),
    ]);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }
    const normalized = mergeCommunityDefaults(community);
    const [beneficiary, enriched, market] = await Promise.all([
      getBeneficiaryInfo(tokenAddress, normalized.chain),
      enrichCommunityWithImage(normalized, await getLaunches()),
      fetchTokenMarketStats(tokenAddress, normalized.chain),
    ]);

    const withBanner = {
      ...enriched,
      bannerUrl: resolveDisplayBannerUrl(enriched, market.bannerUrl),
    };

    return NextResponse.json({
      community: withBanner,
      market,
      posts: sortPostsWithPinned(posts, normalized.pinnedPosts || []),
      beneficiary,
    });
  } catch (err) {
    console.error('GET community', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'Connect wallet required' }, { status: 401 });
  }

  const { address } = await params;
  const tokenAddress = normalizeAddr(address);
  const body = await req.json().catch(() => ({}));

  try {
    const communities = await getCommunities();
    const index = communities.findIndex(
      (item) => item.tokenAddress.toLowerCase() === tokenAddress
    );
    if (index === -1) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const owner = await canEditCommunityProfile(wallet, tokenAddress);
    if (!owner) {
      return NextResponse.json(
        { error: 'Only the token fee beneficiary can update community profile' },
        { status: 403 }
      );
    }

    const current = mergeCommunityDefaults(communities[index]);
    const nextDescription =
      body.description !== undefined
        ? String(body.description || '').trim().slice(0, 2000)
        : current.description;

    if (!nextDescription) {
      return NextResponse.json({ error: 'Description cannot be empty' }, { status: 400 });
    }

    let nextSocialLinks: SocialLinks = current.socialLinks || {};
    if (body.socialLinks !== undefined) {
      nextSocialLinks = normalizeSocialLinks(body.socialLinks || {});
    }

    const nextCustomBanner =
      body.customBannerUrl !== undefined
        ? normalizeBannerUrl(body.customBannerUrl)
        : current.customBannerUrl ?? null;

    const nextUseDexBanner =
      body.useDexBanner !== undefined
        ? Boolean(body.useDexBanner)
        : current.useDexBanner ?? false;

    const updated = mergeCommunityDefaults({
      ...current,
      description: nextDescription,
      socialLinks: nextSocialLinks,
      customBannerUrl: nextCustomBanner,
      useDexBanner: nextUseDexBanner,
    });

    communities[index] = updated;
    await setCommunities(communities);

    const market = await fetchTokenMarketStats(tokenAddress, updated.chain);
    const community = {
      ...updated,
      bannerUrl: resolveDisplayBannerUrl(updated, market.bannerUrl),
    };

    return NextResponse.json({
      success: true,
      community,
      links: {
        communityPage: communityUrl(tokenAddress),
      },
    });
  } catch (err) {
    console.error('PATCH community', err);
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
        {
          error:
            'Token not found in Bankr launches. It must be a Bankr-launched token (including legacy tokens like BNKR).',
        },
        { status: 400 }
      );
    }

    const communities = await getCommunities();
    if (communities.some((c) => c.tokenAddress.toLowerCase() === tokenAddress)) {
      return NextResponse.json(
        { error: 'A space already exists for this token' },
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
      description: description || `${launch.tokenName} holder space`,
      imageUri: launch.imageUri ?? null,
      socialLinks: {},
      pinnedPosts: [],
      pinnedPostId: null,
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

    const enriched = withCommunityImageUrl(community, launch.imageUri);

    return NextResponse.json({
      success: true,
      community: enriched,
      autoVerified: isOwner,
      links: {
        communityPage: communityUrl(launch.tokenAddress),
      },
    });
  } catch (err) {
    console.error('POST community', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
