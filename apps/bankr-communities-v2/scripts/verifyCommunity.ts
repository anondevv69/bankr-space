const tokenAddress = String(args.tokenAddress || '').toLowerCase();

if (!tokenAddress) {
  return { success: false, error: 'tokenAddress required' };
}

const me = await bankr.wallet.me();
const wallet = me.evmAddress.toLowerCase();

let launch = null;
const cached = (await appKV.get('token_launches')) || [];
for (let i = 0; i < cached.length; i++) {
  const item = cached[i];
  if (item.tokenAddress && item.tokenAddress.toLowerCase() === tokenAddress) {
    launch = item;
    break;
  }
}

if (!launch) {
  try {
    const url = 'https://api.bankr.bot/token-launches/' + tokenAddress;
    const data = await http.fetch(url);
    launch = data && data.launch ? data.launch : null;
  } catch (err) {
    log('launch lookup failed', err);
  }
}

if (!launch) {
  return { success: false, error: 'Token not found in Bankr launches' };
}

const feeRecipientObj = launch.feeRecipient || {};
const deployerObj = launch.deployer || {};
const feeRecipient = feeRecipientObj.walletAddress
  ? feeRecipientObj.walletAddress.toLowerCase()
  : '';
const deployer = deployerObj.walletAddress
  ? deployerObj.walletAddress.toLowerCase()
  : '';

if (wallet !== feeRecipient && wallet !== deployer) {
  return {
    success: false,
    error: 'Only the token owner (fee recipient or deployer) can verify this community',
  };
}

const communities = (await appKV.get('communities')) || [];
let community = null;
for (let i = 0; i < communities.length; i++) {
  if (communities[i].tokenAddress.toLowerCase() === tokenAddress) {
    community = communities[i];
    break;
  }
}

if (!community) {
  return { success: false, error: 'Space not found' };
}

if (community.verified) {
  return { success: false, error: 'Space is already verified' };
}

community.verified = true;
community.verifiedAt = Date.now();
community.verifiedBy = wallet;

await appKV.set('communities', communities);

return { success: true, community: community };
