import { NextResponse } from 'next/server';
import { getCommunity, getCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import {
  syncCommunityProfile,
  withResolvedProfile,
} from '@/lib/community-profile-sync';
import { buildBankrProfilePayload } from '@/lib/bankr-project-sync';
import {
  bankrAgentProfileUrl,
  fetchPublicBankrAgentProfile,
  getBankrAgentProfile,
} from '@/lib/bankr-agent-profile';
import { canActAsFeeRecipient } from '@/lib/community-owner';
import { communityUrl } from '@/lib/site-url';
import { getWalletFromRequest, normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const BANKR_PROFILE_API = 'https://api.bankr.bot/agent/profile';
const BANKR_PROFILE_UPDATE_API = 'https://api.bankr.bot/agent/profile/update';

async function resolveCommunityByQuery(
  token: string | null,
  symbol: string | null,
  query: string | null
) {
  const communities = await getCommunities();
  if (token) {
    const addr = normalizeAddr(token);
    return communities.find((c) => c.tokenAddress.toLowerCase() === addr) || null;
  }
  if (symbol) {
    return (
      communities.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase()) || null
    );
  }
  if (query) {
    const q = query.toLowerCase();
    return (
      communities.find(
        (c) =>
          c.symbol.toLowerCase() === q ||
          c.symbol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.tokenAddress.toLowerCase() === q
      ) || null
    );
  }
  return null;
}

/**
 * GET — mapped Bankr Agent Profile body from Space data (public read).
 * Optional header x-wallet-address → fee-recipient check for writes.
 *
 * POST — upsert Bankr project using caller's Bankr API key (X / agent path).
 * Headers: X-API-Key: bk_…, optional x-wallet-address for beneficiary check.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token')?.trim() || null;
  const symbol = searchParams.get('symbol')?.trim() || null;
  const query = searchParams.get('q')?.trim() || null;
  const wallet = getWalletFromRequest(req);

  try {
    let community = await resolveCommunityByQuery(token, symbol, query);
    if (!community) {
      return NextResponse.json(
        { ok: false, error: 'Space not found for that token or symbol' },
        { status: 404 }
      );
    }

    community = mergeCommunityDefaults(community);
    community = await syncCommunityProfile(community);
    const display = withResolvedProfile(community);
    const profilePayload = buildBankrProfilePayload(display);

    const [publicProfile, beneficiaryOk] = await Promise.all([
      fetchPublicBankrAgentProfile(display.tokenAddress),
      wallet
        ? canActAsFeeRecipient(wallet, display.tokenAddress)
        : Promise.resolve(false),
    ]);

    const profileUrl =
      bankrAgentProfileUrl(publicProfile || { tokenAddress: display.tokenAddress }) ||
      `https://bankr.bot/agents`;

    return NextResponse.json({
      ok: true,
      tokenAddress: display.tokenAddress,
      symbol: display.symbol,
      communityLink: communityUrl(display.tokenAddress),
      spaceProfile: {
        name: display.name,
        description: display.description,
        imageUrl: display.imageUrl,
        bannerUrl: display.bannerUrl,
        website: profilePayload.website,
        verified: display.verified,
      },
      bankrProfilePayload: profilePayload,
      existingBankrProfile: publicProfile
        ? {
            slug: publicProfile.slug,
            projectName: publicProfile.projectName,
            approved: publicProfile.approved,
            profileUrl,
          }
        : null,
      caller: wallet
        ? {
            wallet,
            canManageAsBeneficiary: beneficiaryOk,
          }
        : null,
      bankrApi: {
        createOrUpdate: {
          method: 'POST or PUT',
          url: BANKR_PROFILE_API,
          headers: { 'X-API-Key': 'bk_… (user Bankr API key — never from bankr.space)' },
          body: profilePayload,
        },
        addProjectUpdate: {
          method: 'POST',
          url: BANKR_PROFILE_UPDATE_API,
          headers: { 'X-API-Key': 'bk_…' },
          body: { title: 'string', content: 'string' },
        },
        publicProfile: `GET https://api.bankr.bot/agent-profiles/${display.tokenAddress}`,
      },
      instruction:
        'For @bankrbot on X: GET this payload → POST or PUT api.bankr.bot/agent/profile with the user linked wallet API key. Fee recipient only. No API key stored on bankr.space.',
    });
  } catch (err) {
    console.error('GET /api/agent/bankr-project-payload', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key')?.trim() || req.headers.get('X-API-Key')?.trim();
  if (!apiKey || !apiKey.startsWith('bk_')) {
    return NextResponse.json(
      { error: 'X-API-Key header required (bk_… from bankr.bot/api-keys)' },
      { status: 401 }
    );
  }

  const wallet = getWalletFromRequest(req);
  const { searchParams } = new URL(req.url);
  const body = await req.json().catch(() => ({}));

  const token =
    String(body.tokenAddress || searchParams.get('token') || '').trim() || null;
  const symbol = String(body.symbol || searchParams.get('symbol') || '').trim() || null;
  const query = String(body.q || searchParams.get('q') || '').trim() || null;

  try {
    let community = await resolveCommunityByQuery(token, symbol, query);
    if (!community) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (wallet) {
      const allowed = await canActAsFeeRecipient(wallet, community.tokenAddress);
      if (!allowed) {
        return NextResponse.json(
          { error: 'Only the fee recipient can create or update the Bankr project from this Space' },
          { status: 403 }
        );
      }
    }

    community = mergeCommunityDefaults(community);
    community = await syncCommunityProfile(community);
    const display = withResolvedProfile(community);
    const profilePayload = buildBankrProfilePayload(display);

    const existing = await getBankrAgentProfile(apiKey);
    const profileRes = await fetch(BANKR_PROFILE_API, {
      method: existing ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(profilePayload),
    });

    const profileData = (await profileRes.json().catch(() => ({}))) as {
      slug?: string;
      error?: string;
      message?: string;
    };

    if (!profileRes.ok) {
      return NextResponse.json(
        {
          error: profileData.error || profileData.message || `Bankr profile API failed (${profileRes.status})`,
        },
        { status: profileRes.status >= 400 && profileRes.status < 600 ? profileRes.status : 502 }
      );
    }

    let projectUpdate: { title: string; content: string } | null = null;
    const updateTitle = String(body.projectUpdateTitle || '').trim();
    const updateContent = String(body.projectUpdateContent || '').trim();
    if (updateTitle && updateContent) {
      projectUpdate = {
        title: updateTitle.slice(0, 100),
        content: updateContent.slice(0, 2000),
      };
      await fetch(BANKR_PROFILE_UPDATE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(projectUpdate),
      });
    }

    const profileUrl =
      bankrAgentProfileUrl(profileData) ||
      bankrAgentProfileUrl({ tokenAddress: display.tokenAddress }) ||
      'https://bankr.bot/agents';

    return NextResponse.json({
      ok: true,
      created: !existing,
      updated: Boolean(existing),
      symbol: display.symbol,
      tokenAddress: display.tokenAddress,
      communityLink: communityUrl(display.tokenAddress),
      bankrProfileUrl: profileUrl,
      slug: profileData.slug || null,
      projectUpdatePosted: Boolean(projectUpdate),
      tweetReply: `Bankr project ${existing ? 'updated' : 'created'} from $${display.symbol} Space ✓\n\n${profileUrl}\n${communityUrl(display.tokenAddress)}`,
    });
  } catch (err) {
    console.error('POST /api/agent/bankr-project-payload', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
