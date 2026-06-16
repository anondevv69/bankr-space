const DEFAULT_SITE_URL = 'https://www.bankr.space';

/** Public site origin — must match the canonical host (no apex→www redirect for webhooks). */
export function getSiteUrl(): string {
  let url = DEFAULT_SITE_URL;
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    url = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  } else if (process.env.VERCEL_URL) {
    const v = process.env.VERCEL_URL;
    url = (v.startsWith('http') ? v : `https://${v}`).replace(/\/$/, '');
  }
  // bankr.space 308-redirects to www — Telegram webhooks fail on redirects
  if (url === 'https://bankr.space') {
    return 'https://www.bankr.space';
  }
  return url;
}

export function communityUrl(tokenAddress: string): string {
  return `${getSiteUrl()}/community/${tokenAddress}`;
}

export function communityUrlTemplate(): string {
  return `${getSiteUrl()}/community/{tokenContractAddress}`;
}

export function petitionUrl(petitionId: string): string {
  return `${getSiteUrl()}/community/petition/${encodeURIComponent(petitionId)}`;
}
