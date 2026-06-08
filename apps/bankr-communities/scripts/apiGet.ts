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
    out.session = {
      wallet: caller.walletAddress
        ? String(caller.walletAddress).toLowerCase()
        : null,
    };
  }
  return out;
} catch (err) {
  log('apiGet failed', url, err);
  return {
    ok: false,
    error: err && err.message ? String(err.message) : 'Request failed',
  };
}
