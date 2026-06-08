import { fetchLaunchByAddress } from './bankr-api';
import type { Community, TokenLaunch } from './types';
import { resolveTokenImageUrl } from './token-image';

function launchMap(launches: TokenLaunch[]): Map<string, TokenLaunch> {
  return new Map(
    launches
      .filter((l) => l.tokenAddress)
      .map((l) => [l.tokenAddress.toLowerCase(), l])
  );
}

function imageUriForCommunity(
  community: Community,
  launches: Map<string, TokenLaunch>
): string | null {
  const cached = launches.get(community.tokenAddress.toLowerCase());
  return community.imageUri ?? cached?.imageUri ?? null;
}

export function withCommunityImageUrl(
  community: Community,
  imageUri: string | null | undefined
): Community {
  const uri = imageUri ?? null;
  return {
    ...community,
    imageUri: uri ?? community.imageUri,
    imageUrl: resolveTokenImageUrl(uri),
  };
}

export async function enrichCommunityWithImage(
  community: Community,
  launches: TokenLaunch[]
): Promise<Community> {
  const map = launchMap(launches);
  let imageUri = imageUriForCommunity(community, map);
  if (!imageUri) {
    const fresh = await fetchLaunchByAddress(community.tokenAddress);
    imageUri = fresh?.imageUri ?? null;
  }
  return withCommunityImageUrl(community, imageUri);
}

export async function enrichCommunitiesWithImages(
  communities: Community[],
  launches: TokenLaunch[]
): Promise<Community[]> {
  const map = launchMap(launches);
  const needsFetch = communities.filter((c) => !imageUriForCommunity(c, map));

  const fetched = new Map<string, string | null>();
  if (needsFetch.length) {
    const results = await Promise.all(
      needsFetch.map(async (c) => {
        const launch = await fetchLaunchByAddress(c.tokenAddress);
        return [c.tokenAddress.toLowerCase(), launch?.imageUri ?? null] as const;
      })
    );
    for (const [addr, uri] of results) {
      fetched.set(addr, uri);
    }
  }

  return communities.map((community) => {
    const addr = community.tokenAddress.toLowerCase();
    const imageUri =
      imageUriForCommunity(community, map) ?? fetched.get(addr) ?? null;
    return withCommunityImageUrl(community, imageUri);
  });
}

export function enrichLaunchWithImageUrl(launch: TokenLaunch): TokenLaunch & {
  imageUrl: string | null;
} {
  return {
    ...launch,
    imageUrl: resolveTokenImageUrl(launch.imageUri),
  };
}
