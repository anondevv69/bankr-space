/** Token Marketplace petition API — https://www.tokenmarketplace.shop/agent.md */

const DEFAULT_TMP_PETITION_API =
  'https://www.tokenmarketplace.shop/api/petition';

export function tmpPetitionApiBase(): string {
  const raw = process.env.TMP_PETITION_API_BASE || DEFAULT_TMP_PETITION_API;
  return raw.replace(/\/$/, '');
}

export type TmpPetitionConfig = {
  enabled: boolean;
  openDurationHours: number;
  base: {
    enabled: boolean;
    goalUnits: number;
    priceEth: string;
    priceWei: string;
    escrowWallet: string;
    maxLaunchBuyEth: string;
    publicSaleUnitsWithTmkClaim?: number;
  };
};

export type TmpPetitionOrder = {
  wallet: string;
  units: number;
  launchBuyWei?: string;
  txHash?: string;
  createdAt?: string | number;
};

export type TmpPetitionRecord = {
  id: string;
  status: string;
  chain: string;
  tokenName: string;
  tokenSymbol: string;
  soldUnits: number;
  goalUnits: number;
  maxUnitsPerWallet: number;
  starterWallet: string;
  escrowWallet: string;
  expiresAt?: string;
  createdAt?: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  orders?: TmpPetitionOrder[];
  finalResult?: {
    tokenAddress?: string;
    links?: { token?: string; receipt?: string };
  };
};

export type TmpPrepareDeposit = {
  deposit: {
    totalEth: string;
    totalWei: string;
    units: number;
    unitPriceEth: string;
    launchBuyEth?: string;
  };
  nextStep: {
    to: string;
    value: string;
    data: string;
    chainId: string;
  };
  afterDeposit: {
    id: string;
    wallet: string;
    units: number;
    launchBuyWei: string;
  };
};

async function tmpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${tmpPetitionApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(text.slice(0, 200) || `TMP petition API error (${res.status})`);
  }
  if (!res.ok) {
    const err = data.error || data.message || text.slice(0, 200);
    throw new Error(String(err));
  }
  return data as T;
}

export async function tmpFetchPetitionConfig(): Promise<TmpPetitionConfig> {
  const data = await tmpFetch<{ ok?: boolean; config: TmpPetitionConfig }>('/config');
  return data.config;
}

export async function tmpCreatePetition(body: {
  chain: 'base';
  tokenName: string;
  tokenSymbol: string;
  maxUnitsPerWallet?: number;
  starterWallet: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  tweetUrl?: string;
}): Promise<TmpPetitionRecord> {
  const data = await tmpFetch<{ ok?: boolean; petition: TmpPetitionRecord }>('/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!data.petition?.id) {
    throw new Error('TMP create did not return a petition id');
  }
  return data.petition;
}

export async function tmpGetPetitionStatus(id: string): Promise<{
  petition: TmpPetitionRecord;
  petitionUrl?: string;
  agentParticipation?: { remainingUnits?: number; maxUnitsPerWallet?: number };
}> {
  return tmpFetch(`/status?id=${encodeURIComponent(id)}`);
}

export async function tmpPrepareDeposit(options: {
  id: string;
  wallet: string;
  units: number;
  launchBuyWei?: string;
}): Promise<TmpPrepareDeposit> {
  const qs = new URLSearchParams({
    id: options.id,
    wallet: options.wallet,
    units: String(options.units),
    launchBuyWei: options.launchBuyWei || '0',
  });
  return tmpFetch(`/prepare-deposit?${qs.toString()}`);
}

export async function tmpConfirmDeposit(body: {
  id: string;
  wallet: string;
  units: number;
  signature: string;
  launchBuyWei?: string;
}): Promise<Record<string, unknown>> {
  return tmpFetch('/confirm', {
    method: 'POST',
    body: JSON.stringify({
      ...body,
      launchBuyWei: body.launchBuyWei || '0',
    }),
  });
}

export function tmpPetitionPublicUrl(id: string): string {
  return `https://www.tokenmarketplace.shop/petition?id=${encodeURIComponent(id)}`;
}
