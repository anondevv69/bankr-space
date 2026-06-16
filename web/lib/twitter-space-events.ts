import { kvGet, kvSet } from '@/lib/kv-store';
import { communityUrl } from '@/lib/site-url';
import { isTwitterBotConfigured, postTweet } from '@/lib/twitter-api';
import type { Community } from '@/lib/types';

const DEDUPE_PREFIX = 'tw:event:';

async function claimEvent(event: 'created' | 'verified', tokenAddress: string): Promise<boolean> {
  const key = `${DEDUPE_PREFIX}${event}:${tokenAddress.toLowerCase()}`;
  const existing = await kvGet<{ at: number }>(key);
  if (existing) return false;
  await kvSet(key, { at: Date.now() });
  return true;
}

function formatCreatedTweet(community: Community): string {
  const symbol = community.symbol?.trim() || 'TOKEN';
  const name = community.name?.trim() || symbol;
  const url = communityUrl(community.tokenAddress);
  const lines = [
    '🚀 New space on bankr.space',
    '',
    `$${symbol} — ${name}`,
    url,
  ];
  if (community.verified) {
    lines.push('', '✅ Fee recipient verified on create');
  }
  lines.push('', 'Hold the token to post & discuss.');
  return clampTweet(lines.join('\n'));
}

function formatVerifiedTweet(community: Community): string {
  const symbol = community.symbol?.trim() || 'TOKEN';
  const name = community.name?.trim() || symbol;
  const url = communityUrl(community.tokenAddress);

  return clampTweet(
    [
      '✅ Verified on bankr.space',
      '',
      `$${symbol} — ${name}`,
      'Official space · fee recipient confirmed',
      url,
    ].join('\n')
  );
}

function clampTweet(text: string, max = 280): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/** Tweet when a new space is created (fire-and-forget safe). */
export async function notifySpaceCreated(community: Community): Promise<void> {
  if (!isTwitterBotConfigured()) return;

  const token = community.tokenAddress.toLowerCase();
  if (!(await claimEvent('created', token))) {
    console.info('[twitter] skip duplicate created tweet', token);
    return;
  }

  const text = formatCreatedTweet(community);
  const result = await postTweet(text);
  if (!result.ok) {
    console.error('[twitter] created tweet failed', { token, error: result.error });
    await kvSet(`${DEDUPE_PREFIX}created:${token}`, null);
    return;
  }
  console.info('[twitter] posted created tweet', { token, id: result.id });
}

/** Tweet when a space is verified (fire-and-forget safe). */
export async function notifySpaceVerified(community: Community): Promise<void> {
  if (!isTwitterBotConfigured()) return;

  const token = community.tokenAddress.toLowerCase();
  if (!(await claimEvent('verified', token))) {
    console.info('[twitter] skip duplicate verified tweet', token);
    return;
  }

  const text = formatVerifiedTweet(community);
  const result = await postTweet(text);
  if (!result.ok) {
    console.error('[twitter] verified tweet failed', { token, error: result.error });
    await kvSet(`${DEDUPE_PREFIX}verified:${token}`, null);
    return;
  }
  console.info('[twitter] posted verified tweet', { token, id: result.id });
}

/** Non-blocking wrappers for API routes. */
export function queueSpaceCreatedTweet(community: Community): void {
  void notifySpaceCreated(community).catch((err) => {
    console.error('[twitter] notifySpaceCreated', err);
  });
}

export function queueSpaceVerifiedTweet(community: Community): void {
  void notifySpaceVerified(community).catch((err) => {
    console.error('[twitter] notifySpaceVerified', err);
  });
}
