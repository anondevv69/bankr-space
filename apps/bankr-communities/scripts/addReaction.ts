const tokenAddress = String(args.tokenAddress || '').toLowerCase();
const postId = String(args.postId || '');
const reaction = String(args.reaction || '');

const allowed = ['👍', '❤️', '🔥'];
if (!tokenAddress || !postId || allowed.indexOf(reaction) === -1) {
  return { success: false, error: 'Invalid arguments' };
}

const me = await bankr.wallet.me();
const wallet = me.evmAddress.toLowerCase();

const portfolio = await bankr.wallet.balances({ showLowValueTokens: true });
let balance = 0;

const balanceMap = portfolio.balances || {};
for (const chainKey of Object.keys(balanceMap)) {
  const chainData = balanceMap[chainKey];
  const tokens = chainData.tokenBalances || [];
  for (let i = 0; i < tokens.length; i++) {
    const entry = tokens[i];
    const tokenObj = entry.token || {};
    const baseToken = tokenObj.baseToken || {};
    const addr = baseToken.address;
    if (addr && addr.toLowerCase() === tokenAddress) {
      balance = Number(tokenObj.balance) || 0;
      break;
    }
  }
  if (balance > 0) break;
}

if (balance <= 0) {
  return { success: false, error: 'You must hold the token to react' };
}

const allPosts = (await appKV.get('community_posts')) || {};
const posts = allPosts[tokenAddress] || [];
let post = null;
for (let i = 0; i < posts.length; i++) {
  if (posts[i].id === postId) {
    post = posts[i];
    break;
  }
}

if (!post) {
  return { success: false, error: 'Post not found' };
}

if (!post.reactions) post.reactions = {};
for (let i = 0; i < allowed.length; i++) {
  const emoji = allowed[i];
  if (!post.reactions[emoji]) post.reactions[emoji] = [];
}

for (let i = 0; i < allowed.length; i++) {
  const emoji = allowed[i];
  post.reactions[emoji] = post.reactions[emoji].filter(function(w) {
    return w !== wallet;
  });
}

if (post.reactions[reaction].indexOf(wallet) === -1) {
  post.reactions[reaction].push(wallet);
}

allPosts[tokenAddress] = posts;
await appKV.set('community_posts', allPosts);

return { success: true, reactions: post.reactions };
