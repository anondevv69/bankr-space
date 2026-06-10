import type { PinnedPost, Post } from './types';
import { isPostPinned, sortPostsWithPinned } from './community-posts';
import { getTopLevelPosts } from './post-threads';

export type PostFilter = 'all' | 'beneficiary' | 'pinned' | 'community';
export type PostSort = 'newest' | 'oldest';

export function isBeneficiaryWallet(
  wallet: string,
  beneficiaryWallet?: string | null,
  ownerWallet?: string | null
): boolean {
  const w = wallet.toLowerCase();
  if (beneficiaryWallet && w === beneficiaryWallet.toLowerCase()) return true;
  if (ownerWallet && w === ownerWallet.toLowerCase()) return true;
  return false;
}

export function filterPosts(
  posts: Post[],
  filter: PostFilter,
  pinnedPosts: PinnedPost[],
  beneficiaryWallet?: string | null,
  ownerWallet?: string | null
): Post[] {
  const topLevel = getTopLevelPosts(posts);
  switch (filter) {
    case 'beneficiary':
      return topLevel.filter((post) =>
        isBeneficiaryWallet(post.wallet, beneficiaryWallet, ownerWallet)
      );
    case 'pinned':
      return topLevel.filter((post) => isPostPinned(pinnedPosts, post.id));
    case 'community':
      return topLevel.filter(
        (post) => !isBeneficiaryWallet(post.wallet, beneficiaryWallet, ownerWallet)
      );
    case 'all':
    default:
      return topLevel;
  }
}

export function sortFilteredPosts(
  posts: Post[],
  filter: PostFilter,
  sort: PostSort,
  pinnedPosts: PinnedPost[]
): Post[] {
  if (filter === 'all') {
    return sortPostsWithPinned(posts, pinnedPosts);
  }

  const sorted = [...posts].sort((a, b) =>
    sort === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
  );
  return sorted;
}
