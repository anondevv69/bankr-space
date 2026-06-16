import { kvGet, kvSet } from '@/lib/kv-store';
import { communityUrl, petitionUrl } from '@/lib/site-url';
import { isTwitterBotConfigured, postTweet } from '@/lib/twitter-api';
import type { Community, PetitionSpace } from '@/lib/types';

const DEDUPE_PREFIX = 'tw:event:';

async function claimEventKey(key: string): Promise<boolean> {
  const existing = await kvGet<{ at: number }>(key);
  if (existing) return false;
  await kvSet(key, { at: Date.now() });
  return true;
}

async function claimEvent(event: 'created' | 'verified', tokenAddress: string): Promise<boolean> {
  return claimEventKey(`${DEDUPE_PREFIX}${event}:${tokenAddress.toLowerCase()}`);
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

function formatPetitionCreatedTweet(space: PetitionSpace): string {
  const symbol = space.tokenSymbol?.trim() || 'TOKEN';
  const name = space.tokenName?.trim() || symbol;
  const url = space.websiteUrl || petitionUrl(space.tmpPetitionId);

  return clampTweet(
    [
      '📋 New petition on bankr.space',
      '',
      `$${symbol} — ${name}`,
      'Back with ETH to launch on Base',
      url,
    ].join('\n')
  );
}

/** Tweet when a pre-launch petition space is created. */
export async function notifyPetitionCreated(space: PetitionSpace): Promise<void> {
  if (!isTwitterBotConfigured()) return;

  const id = space.tmpPetitionId;
  const key = `${DEDUPE_PREFIX}petition_created:${id}`;
  if (!(await claimEventKey(key))) {
    console.info('[twitter] skip duplicate petition tweet', id);
    return;
  }

  const text = formatPetitionCreatedTweet(space);
  const result = await postTweet(text);
  if (!result.ok) {
    console.error('[twitter] petition tweet failed', { id, error: result.error });
    await kvSet(key, null);
    return;
  }
  console.info('[twitter] posted petition tweet', { id, tweetId: result.id });
}

export function queuePetitionCreatedTweet(space: PetitionSpace): void {
  void notifyPetitionCreated(space).catch((err) => {
    console.error('[twitter] notifyPetitionCreated', err);
  });
}
