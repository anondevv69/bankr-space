import { NextResponse } from 'next/server';
import { getCommunities, getPosts, setCommunities, setPostsForToken, updateCommunityCounts } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import {
  syncCommunityProfile,
  withResolvedProfile,
} from '@/lib/community-profile-sync';
import {
  applyBankrProfilePatchToCommunity,
  buildSpacePatchFromBankrProfile,
  originalTweetPostContent,
} from '@/lib/bankr-project-sync';
import {
  bankrAgentProfileUrl,
  fetchBankrAgentProfileBundle,
  fetchPublicBankrAgentProfile,
  getBankrAgentProfile,
  type BankrAgentProfile,
} from '@/lib/bankr-agent-profile';
import {
  profileMatchesCommunity,
  resolveCommunityByAgentQuery,
} from '@/lib/agent-community-resolve';
import { canActAsFeeRecipient } from '@/lib/community-owner';
import { resolveAuthorProfile } from '@/lib/profiles';
import { communityUrl } from '@/lib/site-url';
import { getWalletFromRequest } from '@/lib/utils';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function loadBankrProfileForSpace(
  communityToken: string,
  apiKey?: string | null
): Promise<BankrAgentProfile | null> {
  if (apiKey) {
    const owned = await getBankrAgentProfile(apiKey);
    if (owned) return owned;
  }
  return fetchPublicBankrAgentProfile(communityToken);
}

/**
 * GET — preview Space PATCH body from Bankr Agent Profile (+ tweets).
 * POST — apply Bankr project → Space (Path C). Fee recipient only.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token')?.trim() || null;
  const symbol = searchParams.get('symbol')?.trim() || null;
  const query = searchParams.get('q')?.trim() || null;
  const wallet = getWalletFromRequest(req);
  const apiKey = req.headers.get('x-api-key')?.trim() || req.headers.get('X-API-Key')?.trim();

  try {
    let community = await resolveCommunityByAgentQuery(token, symbol, query);
    if (!community) {
      return NextResponse.json({ ok: false, error: 'Space not found' }, { status: 404 });
    }

    community = mergeCommunityDefaults(community);
    community = await syncCommunityProfile(community);

    const bundle = await fetchBankrAgentProfileBundle(community.tokenAddress);
    let profile = bundle.profile;
    if (!profile && apiKey) {
      profile = await loadBankrProfileForSpace(community.tokenAddress, apiKey);
    }
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: 'No Bankr Agent Profile found for this token' },
        { status: 404 }
      );
    }

    if (!profileMatchesCommunity(profile, community)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Bankr profile token does not match this Space',
          profileToken: profile.tokenAddress,
          spaceToken: community.tokenAddress,
        },
        { status: 400 }
      );
    }

    const spacePatch = buildSpacePatchFromBankrProfile(profile, community);
    const beneficiaryOk = wallet
      ? await canActAsFeeRecipient(wallet, community.tokenAddress)
      : false;

    return NextResponse.json({
      ok: true,
      tokenAddress: community.tokenAddress,
      symbol: community.symbol,
      communityLink: communityUrl(community.tokenAddress),
      bankrProfileUrl:
        bankrAgentProfileUrl(profile) || `https://bankr.bot/agents/${community.tokenAddress}`,
      bankrProfile: {
        projectName: profile.projectName,
        slug: profile.slug,
        approved: profile.approved,
      },
      spacePatch,
      tweets: bundle.tweets,
      originalTweet: bundle.originalTweet,
      caller: wallet ? { wallet, canManageAsBeneficiary: beneficiaryOk } : null,
      bankrApi: {
        tweets: `GET https://api.bankr.bot/agent-profiles/${community.tokenAddress}/tweets`,
        profile: `GET https://api.bankr.bot/agent-profiles/${community.tokenAddress}`,
      },
      instruction:
        'Path C: POST this endpoint with X-API-Key + x-wallet-address to apply bankrProfile → Space PATCH.',
    });
  } catch (err) {
    console.error('GET /api/agent/space-from-bankr-project', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key')?.trim() || req.headers.get('X-API-Key')?.trim();
  const wallet = getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ error: 'x-wallet-address required' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const token =
    String(body.tokenAddress || searchParams.get('token') || '').trim() || null;
  const symbol = String(body.symbol || searchParams.get('symbol') || '').trim() || null;
  const query = String(body.q || searchParams.get('q') || '').trim() || null;
  const importOriginalTweet = body.importOriginalTweetAsPost === true;

  try {
    let community = await resolveCommunityByAgentQuery(token, symbol, query);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const allowed = await canActAsFeeRecipient(wallet, community.tokenAddress);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Only the fee recipient can update Space from Bankr project' },
        { status: 403 }
      );
    }

    const profile = await loadBankrProfileForSpace(community.tokenAddress, apiKey);
    if (!profile) {
      return NextResponse.json({ error: 'No Bankr Agent Profile found for this token' }, { status: 404 });
    }

    if (!profileMatchesCommunity(profile, community)) {
      return NextResponse.json(
        { error: 'Bankr profile token does not match this Space' },
        { status: 400 }
      );
    }

    community = mergeCommunityDefaults(community);
    let updated = applyBankrProfilePatchToCommunity(community, profile);
    updated = await syncCommunityProfile(updated, { force: true });

    const communities = await getCommunities();
    const index = communities.findIndex(
      (c) => c.tokenAddress.toLowerCase() === updated.tokenAddress.toLowerCase()
    );
    if (index === -1) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }
    communities[index] = updated;
    await setCommunities(communities);

    const bundle = await fetchBankrAgentProfileBundle(updated.tokenAddress);
    const originalTweet = bundle.originalTweet;
    let importedPostId: string | null = null;

    if (importOriginalTweet && originalTweet) {
      const content = originalTweetPostContent(originalTweet);
      const posts = await getPosts(updated.tokenAddress);
      const exists = posts.some((p) => p.content.trim() === content.trim());
      if (!exists && content) {
        const author = await resolveAuthorProfile(wallet);
        const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const newPost: Post = {
          id: postId,
          wallet,
          author,
          content,
          reactions: { '👍': [], '❤️': [], '🔥': [] },
          timestamp: Date.now(),
          balance: 0,
          source: {
            client: 'agent',
            trigger: 'terminal',
            viaAgent: true,
            agentId: 'bankrbot',
            externalRef: originalTweet.id,
          },
        };
        posts.push(newPost);
        await setPostsForToken(updated.tokenAddress, posts);
        await updateCommunityCounts(updated.tokenAddress, posts);
        importedPostId = postId;
      }
    }

    const display = withResolvedProfile(updated);
    const profileUrl =
      bankrAgentProfileUrl(profile) || `https://bankr.bot/agents/${updated.tokenAddress}`;

    return NextResponse.json({
      ok: true,
      symbol: updated.symbol,
      tokenAddress: updated.tokenAddress,
      communityLink: communityUrl(updated.tokenAddress),
      bankrProfileUrl: profileUrl,
      community: display,
      originalTweet,
      importedPostId,
      tweetReply: `Updated $${updated.symbol} Space from Bankr project ✓\n\n${communityUrl(updated.tokenAddress)}\n${profileUrl}`,
    });
  } catch (err) {
    console.error('POST /api/agent/space-from-bankr-project', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
