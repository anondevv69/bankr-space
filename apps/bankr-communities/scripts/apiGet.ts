const SITE = 'https://www.bankr.space';

const rawPath = String(args.path || '').trim();
if (!rawPath.startsWith('/api/')) {
  return { ok: false, error: 'path must start with /api/' };
}

const query = args.query ? String(args.query) : '';
const url = SITE + rawPath + (query ? (query.startsWith('?') ? query : '?' + query) : '');

try {
  const data = await http.fetch(url);
  const out = { ok: true, data };
  if (args.includeSession) {
    const caller = ctx.caller || {};
    let sessionWallet = caller.walletAddress
      ? String(caller.walletAddress).toLowerCase()
      : null;

    if (!sessionWallet) {
      try {
        const me = await bankr.wallet.me();
        if (me && me.evmAddress) {
          sessionWallet = String(me.evmAddress).toLowerCase();
        }
      } catch (err) {
        log('wallet/me unavailable', err);
      }
    }

    out.session = { wallet: sessionWallet };
  }
  return out;
} catch (err) {
  log('apiGet failed', url, err);
  return {
    ok: false,
    error: err && err.message ? String(err.message) : 'Request failed',
  };
}
