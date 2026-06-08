const SITE = 'https://bankr-community.vercel.app';

const caller = ctx.caller || {};
const wallet = caller.walletAddress ? String(caller.walletAddress).toLowerCase() : '';
if (!wallet) {
  return { ok: false, error: 'Sign in with Bankr required' };
}

const rawPath = String(args.path || '').trim();
if (!rawPath.startsWith('/api/')) {
  return { ok: false, error: 'path must start with /api/' };
}

const method = String(args.method || 'POST').toUpperCase();
const body = args.body;

try {
  const data = await http.fetch(SITE + rawPath, {
    method,
    headers: {
      'x-wallet-address': wallet,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { ok: true, data };
} catch (err) {
  log('apiWrite failed', rawPath, err);
  return {
    ok: false,
    error: err && err.message ? String(err.message) : 'Request failed',
  };
}
