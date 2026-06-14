function parseConfiguredFundUrl(configured: string): URL | null {
  try {
    return new URL(configured);
  } catch {
    return null;
  }
}

function walletPathFundUrl(base: URL, wallet: string): string {
  const w = wallet.trim().toLowerCase();
  const parts = base.pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0].startsWith('0x')) {
    base.pathname = `/${w}/${parts.slice(1).join('/')}`;
  } else {
    base.pathname = `/${w}/fund`;
  }
  return base.toString().replace(/\/$/, '');
}

/** x402 $Space always settles to the token fee recipient — never the deployer. */
export function buildFundraisingX402BaseUrl(beneficiaryWallet: string | null): string | null {
  const w = beneficiaryWallet?.trim().toLowerCase();
  if (!w || !/^0x[a-f0-9]{40}$/.test(w)) return null;

  const configured = process.env.NEXT_PUBLIC_X402_FUND_URL?.trim();
  if (configured) {
    const u = parseConfiguredFundUrl(configured);
    if (u) return walletPathFundUrl(u, w);
  }

  const host =
    process.env.NEXT_PUBLIC_X402_FUND_HOST?.trim().replace(/\/$/, '') ||
    'https://x402.bankr.bot';
  return `${host}/${w}/fund`;
}

/**
 * Lane B — community agent pool x402.
 * Prefer NEXT_PUBLIC_X402_AGENT_POOL_FUND_URL, then platform-agent wallet path,
 * then the shared deploy URL (no wallet swap) when the platform path is not deployed.
 */
export function buildAgentPoolX402BaseUrl(platformAgentWallet: string | null): string | null {
  const explicit = process.env.NEXT_PUBLIC_X402_AGENT_POOL_FUND_URL?.trim();
  if (explicit) {
    const u = parseConfiguredFundUrl(explicit);
    if (u) return u.toString().replace(/\/$/, '');
  }

  const configured = process.env.NEXT_PUBLIC_X402_FUND_URL?.trim();
  const u = configured ? parseConfiguredFundUrl(configured) : null;

  const w = platformAgentWallet?.trim().toLowerCase();
  if (w && /^0x[a-f0-9]{40}$/.test(w)) {
    if (u) return walletPathFundUrl(new URL(u.toString()), w);
    const host =
      process.env.NEXT_PUBLIC_X402_FUND_HOST?.trim().replace(/\/$/, '') ||
      'https://x402.bankr.bot';
    return `${host}/${w}/fund`;
  }

  if (u) return u.toString().replace(/\/$/, '');

  return null;
}

/** Shared Bankr x402 deploy URL without pay-to path swap (fallback when platform path 404s). */
export function buildAgentPoolX402FallbackBaseUrl(): string | null {
  if (process.env.NEXT_PUBLIC_X402_AGENT_POOL_FUND_URL?.trim()) {
    return null;
  }
  const configured = process.env.NEXT_PUBLIC_X402_FUND_URL?.trim();
  if (!configured) return null;
  const u = parseConfiguredFundUrl(configured);
  return u ? u.toString().replace(/\/$/, '') : null;
}

export function isX402EndpointNotFound(status: number, data: Record<string, unknown>): boolean {
  if (status !== 404) return false;
  const err = data.error;
  return typeof err === 'string' && err.toLowerCase().includes('endpoint not found');
}
