import { kv } from '@vercel/kv';
import type { Community, Post, TokenLaunch, UserProfile } from './types';

const KEYS = {
  communities: 'communities',
  posts: 'community_posts',
  launches: 'token_launches',
  profiles: 'user_profiles',
  syncAt: 'meta.syncUpdatedAt',
} as const;

export async function getCommunities(): Promise<Community[]> {
  return (await kv.get<Community[]>(KEYS.communities)) || [];
}

export async function setCommunities(communities: Community[]): Promise<void> {
  await kv.set(KEYS.communities, communities);
}

export async function getCommunity(tokenAddress: string): Promise<Community | null> {
  const communities = await getCommunities();
  return (
    communities.find((c) => c.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()) ||
    null
  );
}

export async function getAllPosts(): Promise<Record<string, Post[]>> {
  return (await kv.get<Record<string, Post[]>>(KEYS.posts)) || {};
}

export async function getPosts(tokenAddress: string): Promise<Post[]> {
  const all = await getAllPosts();
  return all[tokenAddress.toLowerCase()] || [];
}

export async function setPostsForToken(tokenAddress: string, posts: Post[]): Promise<void> {
  const all = await getAllPosts();
  all[tokenAddress.toLowerCase()] = posts;
  await kv.set(KEYS.posts, all);
}

export async function getLaunches(): Promise<TokenLaunch[]> {
  return (await kv.get<TokenLaunch[]>(KEYS.launches)) || [];
}

export async function setLaunches(launches: TokenLaunch[]): Promise<void> {
  await kv.set(KEYS.launches, launches);
}

export async function getProfiles(): Promise<Record<string, UserProfile>> {
  return (await kv.get<Record<string, UserProfile>>(KEYS.profiles)) || {};
}

export async function setProfiles(profiles: Record<string, UserProfile>): Promise<void> {
  await kv.set(KEYS.profiles, profiles);
}

export async function getSyncUpdatedAt(): Promise<number | null> {
  return kv.get<number>(KEYS.syncAt);
}

export async function setSyncUpdatedAt(ts: number): Promise<void> {
  await kv.set(KEYS.syncAt, ts);
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
