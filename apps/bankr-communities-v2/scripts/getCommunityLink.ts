const q = String(args.q || args.symbol || args.token || '').trim().replace(/^\$/, '');
if (!q) {
  return { ok: false, error: 'q or symbol required' };
}

const known: Record<string, string> = {
  tmp: 'https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3',
  archive: 'https://bankr.space/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3',
};

const key = q.toLowerCase();
if (known[key]) {
  return { ok: true, query: q, communityLink: known[key], source: 'instant' };
}

try {
  const url = `https://bankr.space/api/agent/link?q=${encodeURIComponent(q)}`;
  const body = await http.fetch(url);
  const text = typeof body === 'string' ? body.trim() : String(body || '').trim();
  if (!text) {
    return { ok: false, query: q, error: 'Empty response from link API' };
  }
  return { ok: true, query: q, communityLink: text, source: 'api' };
} catch (err) {
  return { ok: false, query: q, error: String(err) };
}
