const tokenAddress = String(args.tokenAddress || '').toLowerCase();
const description = String(args.description || '').trim();

if (!tokenAddress) {
  return { success: false, error: 'tokenAddress required' };
}

const me = await bankr.wallet.me();
const wallet = me.evmAddress.toLowerCase();

let launch = null;
const cached = (await appKV.get('token_launches')) || [];
launch = cached.find((l) => l.tokenAddress?.toLowerCase() === tokenAddress);

if (!launch) {
  try {
    const data = await http.fetch(
      `https://api.bankr.bot/token-launches/${tokenAddress}`
    );
    launch = data?.launch || null;
    if (launch) {
      const merged = [launch, ...cached.filter((l) => l.activityId !== launch.activityId)];
      await appKV.set(
        'token_launches',
        merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      );
    }
  } catch (err) {
    log('launch lookup failed', err);
  }
}

if (!launch) {
  return {
    success: false,
    error: 'Token not found in Bankr launches. It must be deployed via Bankr.',
  };
}

const feeRecipient = launch.feeRecipient?.walletAddress?.toLowerCase();
const deployer = launch.deployer?.walletAddress?.toLowerCase();
const isOwner = wallet === feeRecipient || wallet === deployer;

const communities = (await appKV.get('communities')) || [];
const existing = communities.find((c) => c.tokenAddress.toLowerCase() === tokenAddress);
if (existing) {
  return { success: false, error: 'A community already exists for this token' };
}

const community = {
  tokenAddress: launch.tokenAddress,
  name: launch.tokenName,
  symbol: launch.tokenSymbol,
  chain: launch.chain,
  founderWallet: wallet,
  ownerWallet: feeRecipient || deployer,
  verified: isOwner,
  verifiedAt: isOwner ? Date.now() : null,
  verifiedBy: isOwner ? wallet : null,
  description: description || `${launch.tokenName} holder community`,
  postCount: 0,
  memberCount: 0,
  createdAt: Date.now(),
  launchTimestamp: launch.timestamp,
};

communities.unshift(community);
await appKV.set('communities', communities);

const allPosts = (await appKV.get('community_posts')) || {};
if (!allPosts[tokenAddress]) {
  allPosts[tokenAddress] = [];
  await appKV.set('community_posts', allPosts);
}

return { success: true, community, autoVerified: isOwner };
