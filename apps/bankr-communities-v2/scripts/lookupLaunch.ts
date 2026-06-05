const tokenAddress = String(args.tokenAddress || '').toLowerCase();
if (!tokenAddress) {
  return { launch: null, error: 'tokenAddress required' };
}

const cached = (await appKV.get('token_launches')) || [];
let launch = cached.find((l) => l.tokenAddress?.toLowerCase() === tokenAddress);

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
    log('lookupLaunch failed', err);
  }
}

return { launch, found: !!launch };
