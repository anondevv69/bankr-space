async function resolveProfile(targetWallet, isSelf) {
  const wallet = targetWallet.toLowerCase();
  const profile = {
    wallet,
    twitter: null,
    farcaster: null,
    profileImage: null,
  };

  if (isSelf) {
    try {
      const me = await http.fetch('https://api.bankr.bot/wallet/me');
      for (const s of me?.socialAccounts || []) {
        if (s.platform === 'twitter' && s.username) {
          profile.twitter = String(s.username).replace(/^@/, '');
        }
        if (s.platform === 'farcaster' && s.username) {
          profile.farcaster = String(s.username).replace(/^@/, '');
        }
      }
    } catch (err) {
      log('wallet/me lookup failed', err);
    }
  }

  const launches = (await appKV.get('token_launches')) || [];
  for (const launch of launches) {
    for (const party of [launch.deployer, launch.feeRecipient]) {
      if (party?.walletAddress?.toLowerCase() === wallet) {
        if (party.xUsername && !profile.twitter) {
          profile.twitter = String(party.xUsername).replace(/^@/, '');
        }
        if (party.xProfileImageUrl && !profile.profileImage) {
          profile.profileImage = party.xProfileImageUrl;
        }
      }
    }
  }

  const cached = (await appKV.get('user_profiles')) || {};
  cached[wallet] = { ...profile, updatedAt: Date.now() };
  await appKV.set('user_profiles', cached);

  return profile;
}

const wallets = args.wallets || [];
const list = Array.isArray(wallets) ? wallets : [wallets];
const caller = ctx.caller.walletAddress?.toLowerCase();
const cached = (await appKV.get('user_profiles')) || {};
const profiles = {};

for (const w of list) {
  const wallet = String(w || '').toLowerCase();
  if (!wallet) continue;

  const existing = cached[wallet];
  const isFresh = existing?.updatedAt && Date.now() - existing.updatedAt < 86400000;

  if (existing && isFresh && (existing.twitter || existing.farcaster || existing.profileImage)) {
    profiles[wallet] = existing;
    continue;
  }

  profiles[wallet] = await resolveProfile(wallet, wallet === caller);
}

return { profiles };
