/** Proof of Dev (GitHub vesting) public API — server-side only. */

const DEFAULT_API = 'https://api.proofofdev.xyz';
const DEFAULT_SITE = 'https://www.proofofdev.xyz';

export function getProofOfDevApiBase(): string {
  return (process.env.PROOFOFDEV_API_BASE || DEFAULT_API).replace(/\/$/, '');
}

export function getProofOfDevSiteUrl(): string {
  return (process.env.PROOFOFDEV_SITE_URL || DEFAULT_SITE).replace(/\/$/, '');
}

export type ProofOfDevGrantProgress = {
  verifiedPushCount: number;
  totalPushesRequired: number;
  progressPct?: number;
  pushesUntilNextRelease?: number;
  summary?: string;
};

export type ProofOfDevGrant = {
  repoFullName: string;
  githubOwner: string;
  platform?: string;
  recipient: string;
  token: string;
  chain: string;
  status: string;
  streaming?: boolean;
  totalLocked: string;
  totalLockedFormatted: string;
  progress: ProofOfDevGrantProgress;
  createdAt: string;
};

export type ProofOfDevByTokenResponse = {
  ok: boolean;
  token: string;
  count: number;
  grants: ProofOfDevGrant[];
  error?: string;
};

export function lockUrlFromRepo(repoFullName: string, site = getProofOfDevSiteUrl()): string {
  const [owner, ...rest] = repoFullName.split('/');
  const repoName = rest.join('/');
  if (!owner || !repoName) return site;
  return `${site}/lock/${owner}/${repoName}`;
}

export function devProfileUrl(githubLogin: string, site = getProofOfDevSiteUrl()): string {
  return `${site}/dev/${githubLogin}`;
}

export async function fetchVestingByToken(tokenAddress: string): Promise<ProofOfDevByTokenResponse> {
  const token = tokenAddress.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(token)) {
    return { ok: false, token, count: 0, grants: [], error: 'Invalid token address' };
  }

  const res = await fetch(`${getProofOfDevApiBase()}/api/vesting/by-token/${token}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    return {
      ok: false,
      token,
      count: 0,
      grants: [],
      error: `Proof of Dev API returned ${res.status}`,
    };
  }

  return (await res.json()) as ProofOfDevByTokenResponse;
}
