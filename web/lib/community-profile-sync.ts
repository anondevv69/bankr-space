import { fetchLaunchByAddress } from './bankr-api';
import { normalizeBannerUrl } from './banner-url';
import { dexLinksToSocialHints, fetchDexTokenProfile } from './dex-profile';
import { pinRemoteUrlToIpfs } from './pinata';
import { normalizeSocialLinks, socialLinksForDisplay } from './social-links';
import { resolveTokenImageUrl } from './token-image';
import type { Community, SocialLinks } from './types';

const SYNC_STALE_MS = 60 * 60 * 1000;

export type ProfileSyncMeta = {
  bankrIconSrc?: string | null;
  dexIconSrc?: string | null;
  dexBannerSrc?: string | null;
  syncedAt?: number;
};

export type ResolvedCommunityProfile = {
  imageUri: string | null;
  imageUrl: string | null;
  bannerUrl: string | null;
  description: string;
  socialLinks: SocialLinks;
  displaySocialLinks: SocialLinks;
};

function defaultDescription(community: Community): string {
  return `${community.name} holder space`;
}

function isAutoDescription(community: Community): boolean {
  const desc = String(community.description || '').trim();
  if (!desc) return true;
  if (desc === defaultDescription(community)) return true;
  return desc === `${community.name} holder space`.trim();
}

function hasPinata(): boolean {
  return Boolean(process.env.PINATA_JWT?.trim());
}

async function maybePinRemote(
  sourceUrl: string | null | undefined,
  existingIpfsUri: string | null | undefined,
  existingSrc: string | null | undefined,
  filename: string,
  metadata: Record<string, string>
): Promise<{ ipfsUri: string | null; src: string | null }> {
  const src = String(sourceUrl || '').trim() || null;
  if (!src) return { ipfsUri: null, src: null };

  if (src.startsWith('ipfs://')) {
    return { ipfsUri: src, src };
  }

  if (existingIpfsUri && existingSrc === src) {
    return { ipfsUri: existingIpfsUri, src };
  }

  if (!hasPinata()) {
    return { ipfsUri: null, src };
  }

  try {
    const pinned = await pinRemoteUrlToIpfs(src, filename, metadata);
    return { ipfsUri: pinned.ipfsUri, src };
  } catch (err) {
    console.warn('Pin remote image failed', src, err);
    return { ipfsUri: null, src };
  }
}

function uriOrHttps(
  ipfsUri: string | null | undefined,
  httpsUrl: string | null | undefined
): string | null {
  if (ipfsUri) return resolveTokenImageUrl(ipfsUri);
  if (httpsUrl) return httpsUrl;
  return null;
}

export function resolveCommunityIconUri(community: Community): string | null {
  const custom = normalizeBannerUrl(community.customIconUrl);
  if (custom) return custom;

  if (community.useBankrImage !== false) {
    const bankr = community.pinnedBankrIconUri || community.imageUri;
    if (bankr) return resolveTokenImageUrl(bankr);
  }

  if (community.useDexIcon !== false) {
    const dex = community.pinnedDexIconUri;
    if (dex) return resolveTokenImageUrl(dex);
    if (community.dexIconSrc) return community.dexIconSrc;
  }

  return null;
}

export function resolveCommunityBannerUrl(community: Community): string | null {
  const custom = normalizeBannerUrl(community.customBannerUrl);
  if (custom) return custom;

  if (community.useDexBanner !== false) {
    const dex = community.pinnedDexBannerUri;
    if (dex) return resolveTokenImageUrl(dex);
    if (community.dexBannerSrc) return community.dexBannerSrc;
  }

  return null;
}

export function mergeDexLinksForDisplay(
  links: SocialLinks | undefined,
  dexLinks: SocialLinks | undefined,
  useDexLinks: boolean
): SocialLinks {
  const base = socialLinksForDisplay(links);
  if (!useDexLinks) {
    return normalizeSocialLinks({
      x: base.x || undefined,
      website: base.website || undefined,
      github: base.github || undefined,
      telegram: base.telegram || undefined,
      discord: base.discord || undefined,
      custom: base.custom,
    });
  }

  const dex = socialLinksForDisplay(dexLinks);
  const custom = [...base.custom];
  const seen = new Set(custom.map((item) => item.url.toLowerCase()));
  for (const key of ['x', 'website', 'github', 'telegram', 'discord'] as const) {
    if (base[key]) seen.add(base[key]!.toLowerCase());
  }

  for (const item of dex.custom) {
    if (seen.has(item.url.toLowerCase())) continue;
    custom.push(item);
    seen.add(item.url.toLowerCase());
  }

  return normalizeSocialLinks({
    x: base.x || dex.x || undefined,
    website: base.website || dex.website || undefined,
    github: base.github || dex.github || undefined,
    telegram: base.telegram || dex.telegram || undefined,
    discord: base.discord || dex.discord || undefined,
    custom,
  });
}

export function resolveCommunityProfile(community: Community): ResolvedCommunityProfile {
  const useDexLinks = community.useDexLinks !== false;
  const description =
    community.useDexDescription !== false && community.dexDescription && isAutoDescription(community)
      ? community.dexDescription
      : community.description;

  const displaySocialLinks = mergeDexLinksForDisplay(
    community.socialLinks,
    community.dexSocialLinks,
    useDexLinks
  );

  return {
    imageUri: community.customIconUrl || community.pinnedBankrIconUri || community.pinnedDexIconUri || community.imageUri || null,
    imageUrl: resolveCommunityIconUri(community),
    bannerUrl: resolveCommunityBannerUrl(community),
    description,
    socialLinks: community.socialLinks || {},
    displaySocialLinks,
  };
}

export function withResolvedProfile(community: Community): Community {
  const resolved = resolveCommunityProfile(community);
  return {
    ...community,
    description: resolved.description,
    imageUrl: resolved.imageUrl,
    bannerUrl: resolved.bannerUrl,
    displaySocialLinks: resolved.displaySocialLinks,
  };
}

export function shouldSyncProfile(community: Community): boolean {
  const syncedAt = community.profileSyncMeta?.syncedAt || 0;
  return Date.now() - syncedAt > SYNC_STALE_MS;
}

export async function syncCommunityProfile(
  community: Community,
  options?: { force?: boolean }
): Promise<Community> {
  if (!options?.force && !shouldSyncProfile(community)) {
    return community;
  }

  const tokenAddress = community.tokenAddress.toLowerCase();
  const chain = community.chain || 'base';
  const meta: ProfileSyncMeta = { ...(community.profileSyncMeta || {}) };

  const [launch, dexProfile] = await Promise.all([
    fetchLaunchByAddress(tokenAddress),
    fetchDexTokenProfile(tokenAddress, chain),
  ]);

  const bankrIconSrc = launch?.imageUri || community.imageUri || null;
  let pinnedBankrIconUri = community.pinnedBankrIconUri ?? null;
  if (community.useBankrImage !== false && bankrIconSrc && !community.customIconUrl) {
    const pinned = await maybePinRemote(
      bankrIconSrc.startsWith('ipfs://') ? resolveTokenImageUrl(bankrIconSrc) : bankrIconSrc,
      pinnedBankrIconUri,
      meta.bankrIconSrc,
      `${tokenAddress.slice(2, 10)}-bankr-icon`,
      { tokenAddress, kind: 'bankr-icon' }
    );
    pinnedBankrIconUri = pinned.ipfsUri || (bankrIconSrc.startsWith('ipfs://') ? bankrIconSrc : pinnedBankrIconUri);
    meta.bankrIconSrc = pinned.src || bankrIconSrc;
  }

  let pinnedDexIconUri = community.pinnedDexIconUri ?? null;
  let pinnedDexBannerUri = community.pinnedDexBannerUri ?? null;
  const dexIconSrc = dexProfile.icon;
  const dexBannerSrc = dexProfile.header;

  if (community.useDexIcon !== false && dexIconSrc && !community.customIconUrl) {
    const pinned = await maybePinRemote(
      dexIconSrc,
      pinnedDexIconUri,
      meta.dexIconSrc,
      `${tokenAddress.slice(2, 10)}-dex-icon`,
      { tokenAddress, kind: 'dex-icon' }
    );
    pinnedDexIconUri = pinned.ipfsUri;
    meta.dexIconSrc = pinned.src;
  }

  if (community.useDexBanner !== false && dexBannerSrc && !community.customBannerUrl) {
    const pinned = await maybePinRemote(
      dexBannerSrc,
      pinnedDexBannerUri,
      meta.dexBannerSrc,
      `${tokenAddress.slice(2, 10)}-dex-banner`,
      { tokenAddress, kind: 'dex-banner' }
    );
    pinnedDexBannerUri = pinned.ipfsUri;
    meta.dexBannerSrc = pinned.src;
  }

  const dexSocialHints = dexLinksToSocialHints(dexProfile.links);
  const dexSocialLinks = normalizeSocialLinks({
    custom: dexSocialHints,
  });

  let description = community.description;
  if (
    community.useDexDescription !== false &&
    dexProfile.description &&
    isAutoDescription(community)
  ) {
    description = dexProfile.description.slice(0, 2000);
  }

  meta.syncedAt = Date.now();

  return {
    ...community,
    imageUri: launch?.imageUri ?? community.imageUri ?? null,
    pinnedBankrIconUri,
    pinnedDexIconUri,
    pinnedDexBannerUri,
    dexIconSrc: dexIconSrc || community.dexIconSrc || null,
    dexBannerSrc: dexBannerSrc || community.dexBannerSrc || null,
    dexDescription: dexProfile.description || community.dexDescription || null,
    dexSocialLinks,
    description,
    profileSyncMeta: meta,
  };
}

export async function syncAndPersistCommunity(
  community: Community,
  save: (updated: Community) => Promise<void>,
  options?: { force?: boolean }
): Promise<Community> {
  const synced = await syncCommunityProfile(community, options);
  if (synced !== community || options?.force) {
    await save(synced);
  }
  return withResolvedProfile(synced);
}
