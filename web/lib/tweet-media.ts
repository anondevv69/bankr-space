import { extractTweetStatusId } from './tweet-url';
import { BANNER_WIDTH, BANNER_HEIGHT } from './image-specs';

export type TweetMediaItem = {
  url: string;
  width: number;
  height: number;
  type: 'photo' | 'video' | 'animated_gif' | 'unknown';
};

export type TweetMediaResolution = {
  statusId: string;
  statusUrl: string;
  media: TweetMediaItem[];
  suggested: {
    banner: string | null;
    icon: string | null;
  };
  /** Store pbs.twimg.com URLs directly — no IPFS pin (saves Space storage). */
  storageNote: 'hotlink';
};

const BANNER_ASPECT = BANNER_WIDTH / BANNER_HEIGHT;

export function twitterSyndicationToken(statusId: string): string {
  return ((Number(statusId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

/** Prefer large/original Twitter CDN variant for display. */
export function upgradeTwitterCdnImageUrl(url: string, size: 'large' | 'orig' = 'large'): string {
  const raw = String(url || '').trim();
  if (!raw.includes('pbs.twimg.com')) return raw;
  const base = raw.split('?')[0];
  const format = base.endsWith('.png') ? 'png' : 'jpg';
  return `${base}?format=${format}&name=${size}`;
}

export function isTwitterCdnImageUrl(url: string): boolean {
  return /^https:\/\/pbs\.twimg\.com\/media\//i.test(String(url || '').trim());
}

function aspectRatio(width: number, height: number): number {
  if (!width || !height) return 1;
  return width / height;
}

function aspectDistance(ratio: number, target: number): number {
  return Math.abs(Math.log(ratio / target));
}

export function pickBannerMedia(media: TweetMediaItem[]): TweetMediaItem | null {
  const photos = media.filter((m) => m.type === 'photo' && m.url);
  if (!photos.length) return null;

  return photos.reduce((best, item) => {
    const ratio = aspectRatio(item.width, item.height);
    const bestRatio = aspectRatio(best.width, best.height);
    const itemScore = aspectDistance(ratio, BANNER_ASPECT) - item.width * 0.00001;
    const bestScore = aspectDistance(bestRatio, BANNER_ASPECT) - best.width * 0.00001;
    return itemScore < bestScore ? item : best;
  });
}

export function pickIconMedia(media: TweetMediaItem[]): TweetMediaItem | null {
  const photos = media.filter((m) => m.type === 'photo' && m.url);
  if (!photos.length) return null;

  return photos.reduce((best, item) => {
    const ratio = aspectRatio(item.width, item.height);
    const bestRatio = aspectRatio(best.width, best.height);
    const itemScore = aspectDistance(ratio, 1) + Math.abs(item.width - item.height) * 0.001;
    const bestScore = aspectDistance(bestRatio, 1) + Math.abs(best.width - best.height) * 0.001;
    return itemScore < bestScore ? item : best;
  });
}

function parseSyndicationMedia(data: Record<string, unknown>): TweetMediaItem[] {
  const items: TweetMediaItem[] = [];
  const seen = new Set<string>();

  const photos = Array.isArray(data.photos) ? data.photos : [];
  for (const raw of photos) {
    const photo = raw as { url?: string; width?: number; height?: number };
    const url = String(photo.url || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    items.push({
      url: upgradeTwitterCdnImageUrl(url, 'large'),
      width: Number(photo.width) || 0,
      height: Number(photo.height) || 0,
      type: 'photo',
    });
  }

  const details = Array.isArray(data.mediaDetails) ? data.mediaDetails : [];
  for (const raw of details) {
    const detail = raw as {
      media_url_https?: string;
      type?: string;
      original_info?: { width?: number; height?: number };
    };
    const url = String(detail.media_url_https || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const typeRaw = String(detail.type || 'photo').toLowerCase();
    const type =
      typeRaw === 'photo' || typeRaw === 'video' || typeRaw === 'animated_gif'
        ? typeRaw
        : 'unknown';
    items.push({
      url: upgradeTwitterCdnImageUrl(url, 'large'),
      width: Number(detail.original_info?.width) || 0,
      height: Number(detail.original_info?.height) || 0,
      type,
    });
  }

  return items;
}

async function fetchSyndicationTweet(statusId: string): Promise<Record<string, unknown> | null> {
  const token = twitterSyndicationToken(statusId);
  const res = await fetch(
    `https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(statusId)}&token=${encodeURIComponent(token)}`,
    {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    }
  );
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

export async function resolveTweetMediaFromStatusUrl(
  statusUrl: string,
  options?: { index?: number }
): Promise<TweetMediaResolution | null> {
  const statusId = extractTweetStatusId(statusUrl);
  if (!statusId) return null;

  const data = await fetchSyndicationTweet(statusId);
  if (!data) return null;

  let media = parseSyndicationMedia(data);
  if (!media.length) return null;

  if (options?.index !== undefined && options.index >= 0 && options.index < media.length) {
    media = [media[options.index]];
  }

  const bannerPick = pickBannerMedia(media);
  const iconPick = pickIconMedia(media);

  return {
    statusId,
    statusUrl: statusUrl.trim(),
    media,
    suggested: {
      banner: bannerPick ? upgradeTwitterCdnImageUrl(bannerPick.url, 'orig') : null,
      icon: iconPick ? upgradeTwitterCdnImageUrl(iconPick.url, 'large') : null,
    },
    storageNote: 'hotlink',
  };
}
