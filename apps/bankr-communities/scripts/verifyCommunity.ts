const tokenAddress = String(args.tokenAddress || '').toLowerCase();

if (!tokenAddress) {
  return { success: false, error: 'tokenAddress required' };
}

const me = await bankr.wallet.me();
const wallet = me.evmAddress.toLowerCase();

const launches = (await appKV.get('token_launches')) || [];
const launch = launches.find((l) => l.tokenAddress?.toLowerCase() === tokenAddress);

if (!launch) {
  return { success: false, error: 'Token not found in Bankr launches' };
}

const feeRecipient = launch.feeRecipient?.walletAddress?.toLowerCase();
const deployer = launch.deployer?.walletAddress?.toLowerCase();

if (wallet !== feeRecipient && wallet !== deployer) {
  return {
    success: false,
    error: 'Only the token owner (fee recipient or deployer) can verify this community',
  };
}

const communities = (await appKV.get('communities')) || [];
const community = communities.find((c) => c.tokenAddress.toLowerCase() === tokenAddress);

if (!community) {
  return { success: false, error: 'Community not found' };
}

if (community.verified) {
  return { success: false, error: 'Community is already verified' };
}

community.verified = true;
community.verifiedAt = Date.now();
community.verifiedBy = wallet;

await appKV.set('communities', communities);

return { success: true, community };
