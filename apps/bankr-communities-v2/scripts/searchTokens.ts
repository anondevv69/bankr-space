const query = String(args.query || '').trim();
if (!query) {
  return { launches: [], query: '' };
}

const q = query.toLowerCase();
const isAddress = /^0x[a-fA-F0-9]{40}$/.test(query);
const results = [];
const seen = new Set();

function addLaunch(launch) {
  if (!launch?.tokenAddress) return;
  const key = launch.tokenAddress.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  results.push(launch);
}

function matchesLocal(launch) {
  return (
    launch.tokenName?.toLowerCase().includes(q) ||
    launch.tokenSymbol?.toLowerCase().includes(q) ||
    launch.tokenAddress?.toLowerCase().includes(q)
  );
}

async function fetchLaunchByAddress(address) {
  try {
    const data = await http.fetch(
      `https://api.bankr.bot/token-launches/${address}`
    );
    if (data?.launch) return data.launch;
  } catch (err) {
    log('launch lookup failed for', address, err);
  }
  return null;
}

if (isAddress) {
  const launch = await fetchLaunchByAddress(query);
  if (launch) addLaunch(launch);
}

try {
  const searchData = await http.fetch(
    `https://api.bankr.bot/tokens/search?query=${encodeURIComponent(query)}`
  );
  const tokens = searchData?.tokens || [];

  for (const token of tokens.slice(0, 12)) {
    const addr = token?.address;
    if (!addr || seen.has(addr.toLowerCase())) continue;

    const launch = await fetchLaunchByAddress(addr);
    if (launch) addLaunch(launch);
  }
} catch (err) {
  log('token search failed', err);
}

const cached = (await appKV.get('token_launches')) || [];
for (const launch of cached) {
  if (matchesLocal(launch)) addLaunch(launch);
}

if (results.length) {
  const merged = [...cached];
  const mergedIds = new Set(merged.map((l) => l.activityId));

  for (const launch of results) {
    if (!mergedIds.has(launch.activityId)) {
      merged.unshift(launch);
      mergedIds.add(launch.activityId);
    }
  }

  await appKV.set(
    'token_launches',
    merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  );
}

return {
  ok: true,
  query,
  launches: results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
  count: results.length,
};
