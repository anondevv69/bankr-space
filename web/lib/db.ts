import { mergeLegacyLaunches } from './legacy-launches';
import { kvGet, kvSet } from './kv-store';
import type { Community, Post, TokenLaunch, UserProfile } from './types';

const KEYS = {
  communities: 'communities',
  posts: 'community_posts',
  launches: 'token_launches',
  profiles: 'user_profiles',
  syncAt: 'meta.syncUpdatedAt',
} as const;

export async function getCommunities(): Promise<Community[]> {
  return (await kvGet<Community[]>(KEYS.communities)) || [];
}

export async function setCommunities(communities: Community[]): Promise<void> {
  await kvSet(KEYS.communities, communities);
}

export async function getCommunity(tokenAddress: string): Promise<Community | null> {
  const communities = await getCommunities();
  return (
    communities.find((c) => c.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()) ||
    null
  );
}

export async function getAllPosts(): Promise<Record<string, Post[]>> {
  return (await kvGet<Record<string, Post[]>>(KEYS.posts)) || {};
}

export async function getPosts(tokenAddress: string): Promise<Post[]> {
  const all = await getAllPosts();
  return all[tokenAddress.toLowerCase()] || [];
}

export async function setPostsForToken(tokenAddress: string, posts: Post[]): Promise<void> {
  const all = await getAllPosts();
  all[tokenAddress.toLowerCase()] = posts;
  await kvSet(KEYS.posts, all);
}

export async function getLaunches(): Promise<TokenLaunch[]> {
  const stored = (await kvGet<TokenLaunch[]>(KEYS.launches)) || [];
  return mergeLegacyLaunches(stored);
}

export async function setLaunches(launches: TokenLaunch[]): Promise<void> {
  await kvSet(KEYS.launches, mergeLegacyLaunches(launches));
}

export async function getProfiles(): Promise<Record<string, UserProfile>> {
  return (await kvGet<Record<string, UserProfile>>(KEYS.profiles)) || {};
}

export async function setProfiles(profiles: Record<string, UserProfile>): Promise<void> {
  await kvSet(KEYS.profiles, profiles);
}

export async function getSyncUpdatedAt(): Promise<number | null> {
  return kvGet<number>(KEYS.syncAt);
}

export async function setSyncUpdatedAt(ts: number): Promise<void> {
  await kvSet(KEYS.syncAt, ts);
}

export async function updateCommunityCounts(
  tokenAddress: string,
  posts: Post[]
): Promise<void> {
  const communities = await getCommunities();
  const comm = communities.find(
    (c) => c.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()
  );
  if (!comm) return;
  comm.postCount = posts.length;
  comm.memberCount = new Set(posts.map((p) => p.wallet.toLowerCase())).size;
  await setCommunities(communities);
}
