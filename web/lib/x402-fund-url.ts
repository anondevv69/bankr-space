/** x402 USDC always settles to the token fee recipient — never the deployer. */
export function buildFundraisingX402BaseUrl(beneficiaryWallet: string | null): string | null {
  const w = beneficiaryWallet?.trim().toLowerCase();
  if (!w || !/^0x[a-f0-9]{40}$/.test(w)) return null;

  const configured = process.env.NEXT_PUBLIC_X402_FUND_URL?.trim();
  if (configured) {
    try {
      const u = new URL(configured);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && parts[0].startsWith('0x')) {
        u.pathname = `/${w}/${parts.slice(1).join('/')}`;
        return u.toString().replace(/\/$/, '');
      }
      return `${u.origin}/${w}/fund`;
    } catch {
      // fall through
    }
  }

  const host =
    process.env.NEXT_PUBLIC_X402_FUND_HOST?.trim().replace(/\/$/, '') ||
    'https://x402.bankr.bot';
  return `${host}/${w}/fund`;
}
