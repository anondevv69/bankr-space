function stripAt(username) {
  const u = String(username || '');
  if (u.charAt(0) === '@') return u.slice(1);
  return u;
}

const wallets = args.wallets || [];
const list = Array.isArray(wallets) ? wallets : [wallets];
const callerObj = ctx.caller || {};
const caller = callerObj.walletAddress
  ? callerObj.walletAddress.toLowerCase()
  : '';
const cached = (await appKV.get('user_profiles')) || {};
const profiles = {};

for (let i = 0; i < list.length; i++) {
  const wallet = String(list[i] || '').toLowerCase();
  if (!wallet) continue;

  const existing = cached[wallet];
  const isFresh = existing && existing.updatedAt && Date.now() - existing.updatedAt < 86400000;

  if (existing && isFresh && (existing.twitter || existing.farcaster || existing.profileImage)) {
    profiles[wallet] = existing;
    continue;
  }

  const profile = {
    wallet: wallet,
    twitter: null,
    farcaster: null,
    profileImage: null,
  };

  if (wallet === caller) {
    try {
      const me = await http.fetch('https://api.bankr.bot/wallet/me');
      const accounts = me && me.socialAccounts ? me.socialAccounts : [];
      for (let j = 0; j < accounts.length; j++) {
        const s = accounts[j];
        if (s.platform === 'twitter' && s.username) {
          profile.twitter = stripAt(s.username);
        }
        if (s.platform === 'farcaster' && s.username) {
          profile.farcaster = stripAt(s.username);
        }
      }
    } catch (err) {
      log('wallet/me lookup failed', err);
    }
  }

  const launches = (await appKV.get('token_launches')) || [];
  for (let j = 0; j < launches.length; j++) {
    const launch = launches[j];
    const parties = [launch.deployer, launch.feeRecipient];
    for (let k = 0; k < parties.length; k++) {
      const party = parties[k];
      if (!party || !party.walletAddress) continue;
      if (party.walletAddress.toLowerCase() !== wallet) continue;
      if (party.xUsername && !profile.twitter) {
        profile.twitter = stripAt(party.xUsername);
      }
      if (party.xProfileImageUrl && !profile.profileImage) {
        profile.profileImage = party.xProfileImageUrl;
      }
    }
  }

  cached[wallet] = { wallet: wallet, twitter: profile.twitter, farcaster: profile.farcaster, profileImage: profile.profileImage, updatedAt: Date.now() };
  profiles[wallet] = cached[wallet];
}

await appKV.set('user_profiles', cached);

return { profiles: profiles };
