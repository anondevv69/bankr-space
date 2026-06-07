import type { Community, Post } from './types';
import { communityUrl } from './site-url';
import { shortAddr } from './utils';

function authorLabel(post: Post): string {
  const twitter = post.author?.twitter;
  if (twitter) return twitter.startsWith('@') ? twitter : `@${twitter}`;
  const fc = post.author?.farcaster;
  if (fc) return fc.startsWith('@') ? fc : `@${fc}`;
  return shortAddr(post.wallet);
}

export function buildBriefingReplyText(
  community: Community,
  recentPosts: Post[]
): string {
  const link = communityUrl(community.tokenAddress);
  const status = community.verified ? 'verified' : 'unverified';
  const latest = recentPosts[0];
  const latestLine = latest
    ? `latest: "${latest.content}" by ${authorLabel(latest)}`
    : 'no posts yet';

  return [
    `$${community.symbol} community — ${status} · ${community.memberCount} member · ${community.postCount} post${community.postCount === 1 ? '' : 's'}`,
    '',
    latestLine,
    '',
    link,
  ].join('\n');
}

export function buildPostReplyText(symbol: string, content: string, tokenAddress: string): string {
  const link = communityUrl(tokenAddress);
  return [`posted to $${symbol} holder community: "${content}"`, '', link].join('\n');
}

export function buildLinkReplyText(symbol: string, tokenAddress: string): string {
  return [`$${symbol} community link:`, '', communityUrl(tokenAddress)].join('\n');
}
