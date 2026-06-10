import type { Post } from './types';

export function isTopLevelPost(post: Post): boolean {
  return !post.parentPostId;
}

export function getTopLevelPosts(posts: Post[]): Post[] {
  return posts.filter(isTopLevelPost);
}

export function getRepliesForPost(posts: Post[], parentPostId: string): Post[] {
  return posts
    .filter((post) => post.parentPostId === parentPostId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function replyCountForPost(posts: Post[], parentPostId: string): number {
  return getRepliesForPost(posts, parentPostId).length;
}
