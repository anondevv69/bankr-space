import type { Author, TokenLaunch, UserProfile } from './types';
import { getLaunches, getProfiles, setProfiles } from './db';
import { getFarcasterLinkByWallet } from './farcaster-kv';
import { stripAt } from './utils';

export async function resolveAuthorProfile(wallet: string): Promise<Author> {
  const w = wallet.toLowerCase();
  const profiles = await getProfiles();
  const cached = profiles[w];
  const isFresh =
    cached?.updatedAt && Date.now() - cached.updatedAt < 86400000;

  if (
    cached &&
    isFresh &&
    (cached.twitter || cached.farcaster || cached.profileImage)
  ) {
    return {
      wallet: w,
      twitter: cached.twitter,
      farcaster: cached.farcaster,
      profileImage: cached.profileImage,
    };
  }

  const profile: UserProfile = {
    wallet: w,
    twitter: null,
    farcaster: null,
    profileImage: null,
    updatedAt: Date.now(),
  };

  // Pull verified Farcaster link from KV
  const fcLink = await getFarcasterLinkByWallet(w).catch(() => null);
  if (fcLink) {
    profile.farcaster = fcLink.username;
    if (fcLink.pfpUrl && !profile.profileImage) profile.profileImage = fcLink.pfpUrl;
  }

  const launches = await getLaunches();
  for (const launch of launches) {
    for (const party of [launch.deployer, launch.feeRecipient]) {
      if (!party?.walletAddress) continue;
      if (party.walletAddress.toLowerCase() !== w) continue;
      if (party.xUsername && !profile.twitter) {
        profile.twitter = stripAt(party.xUsername);
      }
      if (party.xProfileImageUrl && !profile.profileImage) {
        profile.profileImage = party.xProfileImageUrl;
      }
    }
  }

  profiles[w] = profile;
  await setProfiles(profiles);

  return {
    wallet: w,
    twitter: profile.twitter,
    farcaster: profile.farcaster,
    profileImage: profile.profileImage,
  };
}

export function enrichFromLaunch(launch: TokenLaunch, wallet: string): Partial<Author> {
  const w = wallet.toLowerCase();
  const out: Partial<Author> = {};
  for (const party of [launch.deployer, launch.feeRecipient]) {
    if (!party?.walletAddress || party.walletAddress.toLowerCase() !== w) continue;
    if (party.xUsername) out.twitter = stripAt(party.xUsername);
    if (party.xProfileImageUrl) out.profileImage = party.xProfileImageUrl;
  }
  return out;
}
