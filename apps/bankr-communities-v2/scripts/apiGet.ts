const SITE = 'https://bankr.space';

const rawPath = String(args.path || '').trim();
if (!rawPath.startsWith('/api/')) {
  return { ok: false, error: 'path must start with /api/' };
}

const query = args.query ? String(args.query) : '';
const url = SITE + rawPath + (query ? (query.startsWith('?') ? query : '?' + query) : '');

try {
  const data = await http.fetch(url);
  return { ok: true, data };
} catch (err) {
  log('apiGet failed', url, err);
  return {
    ok: false,
    error: err && err.message ? String(err.message) : 'Request failed',
  };
}
