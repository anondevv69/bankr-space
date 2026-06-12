/** Token Marketplace petition + holders API */

const DEFAULT_TMP_PETITION_API =
  'https://www.tokenmarketplace.shop/api/petition';
const DEFAULT_TMP_SITE = 'https://www.tokenmarketplace.shop';

export function tmpPetitionApiBase(): string {
  const raw = process.env.TMP_PETITION_API_BASE || DEFAULT_TMP_PETITION_API;
  return raw.replace(/\/$/, '');
}

export function tmpSiteBase(): string {
  return (process.env.TMP_SITE_URL || DEFAULT_TMP_SITE).replace(/\/$/, '');
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
    tmkClaimService?: boolean;
    tmkClaimReserveUnits?: number;
    tmkClaimWallet?: string;
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
  supporterSlots?: number;
  supportersJoined?: number;
  supportersRemaining?: number;
  unitsPerSupporter?: number;
  starterWallet: string;
  escrowWallet: string;
  expiresAt?: string;
  createdAt?: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  tmkClaimOptIn?: boolean;
  tmkClaimWallet?: string;
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

export type TmpCapTableHolder = {
  wallet: string;
  units: string;
  sharePct: number;
};

async function tmpFetch<T>(url: string, init?: RequestInit): Promise<T> {
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
    throw new Error(text.slice(0, 200) || `TMP API error (${res.status})`);
  }
  if (!res.ok) {
    const err = data.error || data.message || text.slice(0, 200);
    throw new Error(String(err));
  }
  return data as T;
}

export async function tmpFetchPetitionConfig(): Promise<TmpPetitionConfig> {
  const data = await tmpFetch<{ ok?: boolean; config: TmpPetitionConfig }>(
    `${tmpPetitionApiBase()}/config`
  );
  return data.config;
}

export async function tmpCreatePetition(body: {
  chain: 'base';
  tokenName: string;
  tokenSymbol: string;
  maxUnitsPerWallet?: number;
  supporterSlots?: number;
  starterWallet: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  tweetUrl?: string;
  tmkClaimOptIn?: boolean;
}): Promise<TmpPetitionRecord> {
  const data = await tmpFetch<{ ok?: boolean; petition: TmpPetitionRecord }>(
    `${tmpPetitionApiBase()}/create`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  if (!data.petition?.id) {
    throw new Error('TMP create did not return a petition id');
  }
  return data.petition;
}

export async function tmpGetPetitionStatus(id: string): Promise<{
  petition: TmpPetitionRecord;
  petitionUrl?: string;
  agentParticipation?: {
    remainingUnits?: number;
    maxUnitsPerWallet?: number;
    supportersRemaining?: number;
  };
}> {
  return tmpFetch(`${tmpPetitionApiBase()}/status?id=${encodeURIComponent(id)}`);
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
  return tmpFetch(`${tmpPetitionApiBase()}/prepare-deposit?${qs.toString()}`);
}

export async function tmpConfirmDeposit(body: {
  id: string;
  wallet: string;
  units: number;
  signature: string;
  launchBuyWei?: string;
}): Promise<Record<string, unknown>> {
  return tmpFetch(`${tmpPetitionApiBase()}/confirm`, {
    method: 'POST',
    body: JSON.stringify({
      ...body,
      launchBuyWei: body.launchBuyWei || '0',
    }),
  });
}

export async function tmpRefundPetition(body: {
  id: string;
  wallet: string;
  scope?: 'units' | 'all';
}): Promise<Record<string, unknown>> {
  return tmpFetch(`${tmpPetitionApiBase()}/refund`, {
    method: 'POST',
    body: JSON.stringify({
      id: body.id,
      wallet: body.wallet,
      scope: body.scope || 'units',
    }),
  });
}

export async function tmpFetchHoldersByToken(tokenAddress: string): Promise<{
  ok?: boolean;
  tokenAddress: string;
  symbol?: string;
  capTable?: {
    holderCount: number;
    totalUnits: string;
    holders: TmpCapTableHolder[];
  };
} | null> {
  try {
    return await tmpFetch(
      `${tmpSiteBase()}/api/holders/by-token?token=${encodeURIComponent(tokenAddress)}`
    );
  } catch {
    return null;
  }
}

export function tmpPetitionPublicUrl(id: string): string {
  return `${tmpSiteBase()}/petition?id=${encodeURIComponent(id)}`;
}

export function petitionSlotSummary(petition: TmpPetitionRecord, config?: TmpPetitionConfig | null): {
  goalUnits: number;
  publicCap: number;
  unitsPerBacker: number;
  maxBackers: number;
  backersJoined: number;
  backersRemaining: number;
  usesSlots: boolean;
} {
  const goalUnits = petition.goalUnits || config?.base?.goalUnits || 1000;
  const publicCap =
    petition.tmkClaimOptIn && config?.base?.publicSaleUnitsWithTmkClaim
      ? config.base.publicSaleUnitsWithTmkClaim
      : goalUnits;
  const usesSlots = !!(petition.supporterSlots && petition.supporterSlots > 0);
  const unitsPerBacker = usesSlots
    ? petition.unitsPerSupporter ||
      Math.floor(publicCap / (petition.supporterSlots || 1))
    : petition.maxUnitsPerWallet || 10;
  const maxBackers = usesSlots
    ? petition.supporterSlots || Math.floor(publicCap / unitsPerBacker)
    : Math.floor(publicCap / unitsPerBacker);
  return {
    goalUnits,
    publicCap,
    unitsPerBacker,
    maxBackers,
    backersJoined: petition.supportersJoined ?? (petition.orders?.length || 0),
    backersRemaining:
      petition.supportersRemaining ??
      Math.max(0, maxBackers - (petition.supportersJoined ?? petition.orders?.length ?? 0)),
    usesSlots,
  };
}
