const DEFAULT_SITE_URL = 'https://bankr.space';

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    const v = process.env.VERCEL_URL;
    return (v.startsWith('http') ? v : `https://${v}`).replace(/\/$/, '');
  }
  return DEFAULT_SITE_URL;
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
