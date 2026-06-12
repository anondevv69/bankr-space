import { createPublicClient, http, type Address } from 'viem';
import { base } from 'viem/chains';
import { poidhRead, readBountyCounterCached } from './poidh-contract';

/** PoidhV3 on Base mainnet — https://docs.poidh.xyz/deployment.html */
export const POIDH_V3_BASE = '0x5555Fa783936C260f77385b4E153B9725feF1719' as Address;

/** poidh.xyz display id = on-chain id + offset (Base). */
export const POIDH_FRONTEND_OFFSET_BASE = 986;

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

const poidhAbi = [
  {
    inputs: [],
    name: 'bountyCounter',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'bounties',
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'issuer', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'amount', type: 'uint256' },
      { name: 'claimer', type: 'address' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'claimId', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export type PoidhBounty = {
  id: number;
  frontendId: number;
  issuer: string;
  name: string;
  description: string;
  amountWei: bigint;
  claimer: string;
  createdAt: number;
  claimId: number;
  /** Active if not finalized (claimer is zero address). */
  active: boolean;
};

export function poidhBountyUrl(onChainId: number): string {
  return `https://poidh.xyz/base/bounty/${onChainId + POIDH_FRONTEND_OFFSET_BASE}`;
}

export function normalizePoidhBountyId(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw > 500) {
    return Math.max(1, raw - POIDH_FRONTEND_OFFSET_BASE);
  }
  return Math.round(raw);
}

export function poidhDisplayBountyId(onChainId: number): number {
  return onChainId + POIDH_FRONTEND_OFFSET_BASE;
}

function matchesSpace(text: string, symbol: string, tokenAddress: string): boolean {
  const hay = text.toLowerCase();
  const sym = symbol.toLowerCase().replace(/^\$/, '');
  const token = tokenAddress.toLowerCase();
  return (
    hay.includes(sym) ||
    hay.includes(token) ||
    hay.includes(`$${sym}`) ||
    hay.includes(`bankr.space/community/${token}`)
  );
}

async function readBounty(id: number): Promise<PoidhBounty | null> {
  if (id <= 0) return null;
  try {
    const row = await poidhRead(() =>
      publicClient.readContract({
        address: POIDH_V3_BASE,
        abi: poidhAbi,
        functionName: 'bounties',
        args: [BigInt(id)],
      })
    );
    const issuer = String(row[1]).toLowerCase();
    if (issuer === '0x0000000000000000000000000000000000000000') return null;

    const claimer = String(row[5]).toLowerCase();
    const zero = '0x0000000000000000000000000000000000000000';

    return {
      id,
      frontendId: id + POIDH_FRONTEND_OFFSET_BASE,
      issuer,
      name: String(row[2] || ''),
      description: String(row[3] || ''),
      amountWei: row[4],
      claimer,
      createdAt: Number(row[6]),
      claimId: Number(row[7]),
      active: claimer === zero,
    };
  } catch {
    return null;
  }
}

/** Scan recent on-chain bounties posted by issuer wallets. */
export async function fetchPoidhBountiesForSpace(options: {
  issuerWallets: string[];
  symbol: string;
  tokenAddress: string;
  scanLimit?: number;
}): Promise<{
  bounties: PoidhBounty[];
  total: number;
  issuerWallet: string;
  symbol: string;
  spaceUrl: string;
}> {
  const issuers = new Set(
    options.issuerWallets
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.startsWith('0x') && w.length === 42)
  );
  const primaryIssuer = [...issuers][0] || '';
  const spaceUrl = `https://www.bankr.space/community/${options.tokenAddress.toLowerCase()}`;
  const scanLimit = Math.min(Math.max(options.scanLimit ?? 24, 8), 60);

  let counter = 0;
  try {
    counter = await readBountyCounterCached();
  } catch {
    return { bounties: [], total: 0, issuerWallet: primaryIssuer, symbol: options.symbol, spaceUrl };
  }

  const start = Math.max(1, counter - scanLimit);
  const matched: PoidhBounty[] = [];

  for (let id = counter; id >= start; id -= 1) {
    const bounty = await readBounty(id);
    if (!bounty) continue;
    if (!issuers.has(bounty.issuer)) continue;
    if (!matchesSpace(`${bounty.name} ${bounty.description}`, options.symbol, options.tokenAddress)) {
      continue;
    }
    matched.push(bounty);
    if (matched.length >= 12) break;
    if ((counter - id) % 4 === 3) {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  }

  matched.sort((a, b) => b.createdAt - a.createdAt);

  return {
    bounties: matched,
    total: matched.length,
    issuerWallet: primaryIssuer,
    symbol: options.symbol,
    spaceUrl,
  };
}

export async function fetchPoidhBountyById(onChainId: number): Promise<PoidhBounty | null> {
  return readBounty(normalizePoidhBountyId(onChainId));
}
