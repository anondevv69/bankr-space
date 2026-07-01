import {
  addBankrProjectUpdate,
  upsertBankrAgentProfile,
  type BankrAgentProfile,
  type BankrProfileProduct,
  type BankrProfileTweet,
  pickOriginalBankrProfileTweet,
} from './bankr-agent-profile';
import { resolveCommunityProfile } from './community-profile-sync';
import { AGENT_POOL_SKILL_META } from './agent-pool';
import { normalizeBannerUrl } from './banner-url';
import { normalizeSocialLinks } from './social-links';
import { communityUrl } from './site-url';
import type { Community, SocialLinks } from './types';

export function getCommunityBankrApiKey(community: Community): string | null {
  const key = community.bankrProjectApiKey?.trim();
  return key || null;
}

export function sanitizeCommunityForClient(community: Community): Community {
  const { bankrProjectApiKey: _key, ...rest } = community;
  const configured = Boolean(community.bankrProjectApiKey?.trim());
  return {
    ...rest,
    bankrProject: {
      ...(community.bankrProject || {}),
      apiKeyConfigured: configured,
    },
  };
}

function httpsImageUrl(community: Community): string | null {
  const resolved = resolveCommunityProfile(community);
  const url = String(resolved.imageUrl || '').trim();
  if (url.startsWith('https://')) return url.slice(0, 500);
  return null;
}

function websiteFromCommunity(community: Community): string {
  const resolved = resolveCommunityProfile(community);
  const website = String(resolved.displaySocialLinks?.website || resolved.socialLinks?.website || '').trim();
  if (website.startsWith('http')) return website.slice(0, 500);
  return communityUrl(community.tokenAddress);
}

export function buildProductsFromCommunity(community: Community): BankrProfileProduct[] {
  const page = communityUrl(community.tokenAddress);
  const products: BankrProfileProduct[] = [];

  for (const campaign of community.fundraising?.campaigns || []) {
    if (!campaign.enabled) continue;
    products.push({
      name: campaign.label,
      description: `Fundraiser on ${community.name} Space`,
      url: page,
    });
  }

  for (const campaign of community.agentPool?.campaigns || []) {
    if (!campaign.enabled) continue;
    const meta = AGENT_POOL_SKILL_META[campaign.skillId];
    products.push({
      name: campaign.label || meta?.label || campaign.skillId,
      description: meta?.description || 'Community agent goal',
      url: page,
    });
  }

  return products.slice(0, 20);
}

export type SpacePatchFromBankrProfile = {
  description?: string;
  socialLinks?: SocialLinks;
  customIconUrl?: string | null;
  useDexDescription?: boolean;
  useBankrImage?: boolean;
  useDexIcon?: boolean;
};

export function buildSpacePatchFromBankrProfile(
  profile: BankrAgentProfile,
  current?: Community
): SpacePatchFromBankrProfile {
  const patch: SpacePatchFromBankrProfile = {};
  const prevLinks = normalizeSocialLinks(current?.socialLinks || {});

  const description = String(profile.description || '').trim();
  if (description) {
    patch.description = description.slice(0, 2000);
    patch.useDexDescription = false;
  }

  const website = String(profile.website || '').trim();
  const twitter = String(profile.twitterUsername || '').trim().replace(/^@/, '');
  const nextLinks: SocialLinks = { ...prevLinks };

  if (website.startsWith('http')) {
    nextLinks.website = website.slice(0, 500);
  }
  if (twitter) {
    nextLinks.x = `https://x.com/${twitter}`;
  }
  if (website || twitter) {
    patch.socialLinks = normalizeSocialLinks(nextLinks);
  }

  const icon = String(profile.profileImageUrl || '').trim();
  if (icon.startsWith('https://')) {
    patch.customIconUrl = normalizeBannerUrl(icon);
    patch.useBankrImage = false;
    patch.useDexIcon = false;
  }

  return patch;
}

export function applyBankrProfilePatchToCommunity(
  community: Community,
  profile: BankrAgentProfile
): Community {
  const patch = buildSpacePatchFromBankrProfile(profile, community);
  return {
    ...community,
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.socialLinks !== undefined ? { socialLinks: patch.socialLinks } : {}),
    ...(patch.customIconUrl !== undefined ? { customIconUrl: patch.customIconUrl } : {}),
    ...(patch.useDexDescription !== undefined
      ? { useDexDescription: patch.useDexDescription }
      : {}),
    ...(patch.useBankrImage !== undefined ? { useBankrImage: patch.useBankrImage } : {}),
    ...(patch.useDexIcon !== undefined ? { useDexIcon: patch.useDexIcon } : {}),
    bankrProject: {
      ...(community.bankrProject || {}),
      slug: profile.slug || community.bankrProject?.slug || null,
      lastSyncedAt: Date.now(),
      lastSyncError: null,
    },
  };
}

export function originalTweetPostContent(tweet: BankrProfileTweet): string {
  const url = String(tweet.url || '').trim();
  if (url) return url;
  return tweet.text.trim().slice(0, 2000);
}

export { pickOriginalBankrProfileTweet };

export function buildBankrProfilePayload(community: Community): {
  projectName: string;
  description: string;
  tokenAddress: string;
  website: string;
  profileImageUrl: string | null;
  products: BankrProfileProduct[];
  revenueSources: { name: string; description: string }[];
} {
  const resolved = resolveCommunityProfile(community);
  return {
    projectName: community.name.slice(0, 100),
    description: resolved.description.slice(0, 2000),
    tokenAddress: community.tokenAddress.toLowerCase(),
    website: websiteFromCommunity(community),
    profileImageUrl: httpsImageUrl(community),
    products: buildProductsFromCommunity(community),
    revenueSources: [
      {
        name: `${community.symbol} trading fees`,
        description: `Holder space and project updates at ${communityUrl(community.tokenAddress)}`,
      },
    ],
  };
}

export function projectUpdateTitleFromContent(content: string): string {
  const firstLine = content.split('\n').map((line) => line.trim()).find(Boolean) || 'Space update';
  return firstLine.slice(0, 100);
}

export function isBankrProjectSyncEnabled(community: Community): boolean {
  return Boolean(
    community.bankrProject?.enabled &&
      getCommunityBankrApiKey(community) &&
      (community.bankrProject.syncProfile || community.bankrProject.syncPosts)
  );
}

export async function syncCommunityToBankrProfile(
  community: Community
): Promise<{ community: Community; profile?: BankrAgentProfile; error?: string }> {
  const apiKey = getCommunityBankrApiKey(community);
  if (!apiKey || !community.bankrProject?.enabled || !community.bankrProject.syncProfile) {
    return { community };
  }

  try {
    const payload = buildBankrProfilePayload(community);
    const profile = await upsertBankrAgentProfile(apiKey, payload);
    return {
      community: {
        ...community,
        bankrProject: {
          ...(community.bankrProject || {}),
          lastSyncedAt: Date.now(),
          lastSyncError: null,
          slug: profile.slug || community.bankrProject?.slug || null,
        },
      },
      profile,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bankr profile sync failed';
    console.error('syncCommunityToBankrProfile', community.tokenAddress, message);
    return {
      community: {
        ...community,
        bankrProject: {
          ...(community.bankrProject || {}),
          lastSyncError: message.slice(0, 500),
        },
      },
      error: message,
    };
  }
}

export async function syncPostToBankrProject(
  community: Community,
  content: string
): Promise<{ synced: boolean; error?: string }> {
  const apiKey = getCommunityBankrApiKey(community);
  if (!apiKey || !community.bankrProject?.enabled || !community.bankrProject.syncPosts) {
    return { synced: false };
  }

  try {
    await addBankrProjectUpdate(
      apiKey,
      projectUpdateTitleFromContent(content),
      content
    );
    return { synced: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bankr project update failed';
    console.error('syncPostToBankrProject', community.tokenAddress, message);
    return { synced: false, error: message };
  }
}

export function normalizeBankrProjectSettings(
  current: Community['bankrProject'],
  body: Record<string, unknown>,
  apiKeyFromBody?: string | null
): { bankrProject: NonNullable<Community['bankrProject']>; apiKey?: string } {
  const prev = current || {};
  const raw = (body.bankrProject as Record<string, unknown> | undefined) || {};

  const bankrProject: NonNullable<Community['bankrProject']> = {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : prev.enabled ?? false,
    syncProfile: raw.syncProfile !== undefined ? Boolean(raw.syncProfile) : prev.syncProfile ?? true,
    syncPosts: raw.syncPosts !== undefined ? Boolean(raw.syncPosts) : prev.syncPosts ?? true,
    lastSyncedAt: prev.lastSyncedAt ?? null,
    lastSyncError: prev.lastSyncError ?? null,
    slug: prev.slug ?? null,
  };

  const result: { bankrProject: NonNullable<Community['bankrProject']>; apiKey?: string } = {
    bankrProject,
  };

  const key =
    apiKeyFromBody !== undefined
      ? String(apiKeyFromBody || '').trim()
      : body.bankrProjectApiKey !== undefined
        ? String(body.bankrProjectApiKey || '').trim()
        : undefined;

  if (key !== undefined && key.length > 0) {
    if (!key.startsWith('bk_')) {
      throw new Error('Bankr API key must start with bk_');
    }
    result.apiKey = key;
  }

  return result;
}
