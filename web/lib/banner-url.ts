import { resolveTokenImageUrl } from './token-image';

/** Normalize beneficiary-provided banner (HTTPS or IPFS). */
export function normalizeBannerUrl(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^javascript:/i.test(raw) || /^data:/i.test(raw)) return null;
  const resolved = resolveTokenImageUrl(raw);
  if (resolved) return resolved;
  if (/^https?:\/\//i.test(raw)) return raw;
  return null;
}

export function resolveDisplayBannerUrl(
  community: {
    customBannerUrl?: string | null;
    useDexBanner?: boolean;
  },
  dexBannerUrl?: string | null
): string | null {
  const custom = normalizeBannerUrl(community.customBannerUrl);
  if (custom) return custom;
  if (community.useDexBanner && dexBannerUrl) return dexBannerUrl;
  return null;
}
