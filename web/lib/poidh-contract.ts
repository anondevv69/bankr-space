import {
  createPublicClient,
  decodeEventLog,
  formatEther,
  http,
  parseEther,
  type Address,
  type Hash,
  type TransactionReceipt,
  type WalletClient,
} from 'viem';
import { base } from 'wagmi/chains';
import { POIDH_V3_BASE } from './poidh-api';

export { POIDH_V3_BASE };

const transport = http(process.env.BASE_RPC_URL || 'https://mainnet.base.org');

export const poidhPublicClient = createPublicClient({
  chain: base,
  transport,
});

/** Minimal PoidhV3 ABI — matches prod contract (Base). */
export const poidhV3Abi = [
  {
    inputs: [],
    name: 'MIN_CONTRIBUTION',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MIN_BOUNTY_AMOUNT',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'bountyCounter',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'id', type: 'uint256' },
      { indexed: true, name: 'issuer', type: 'address' },
      { indexed: false, name: 'title', type: 'string' },
      { indexed: false, name: 'description', type: 'string' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'createdAt', type: 'uint256' },
      { indexed: false, name: 'isOpenBounty', type: 'bool' },
      { indexed: false, name: 'round', type: 'uint256' },
    ],
    name: 'BountyCreated',
    type: 'event',
  },
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
    ],
    name: 'createOpenBounty',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    name: 'joinOpenBounty',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'uri', type: 'string' },
    ],
    name: 'createClaim',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'claimId', type: 'uint256' },
    ],
    name: 'submitClaimForVote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'claimId', type: 'uint256' },
    ],
    name: 'acceptClaim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    name: 'everHadExternalContributor',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'vote', type: 'bool' },
    ],
    name: 'voteClaim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    name: 'resolveVote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    name: 'bountyCurrentVotingClaim',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'bountyId', type: 'uint256' }],
    name: 'bountyVotingTracker',
    outputs: [
      { name: 'yesWeight', type: 'uint256' },
      { name: 'noWeight', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'cursor', type: 'uint256' },
    ],
    name: 'getClaimsByBountyId',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'issuer', type: 'address' },
          { name: 'bountyId', type: 'uint256' },
          { name: 'bountyIssuer', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'accepted', type: 'bool' },
        ],
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'participants',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'bountyId', type: 'uint256' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'participantAmounts',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'pendingWithdrawals',
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

export type PoidhClaimView = {
  id: number;
  issuer: string;
  name: string;
  description: string;
  createdAt: number;
  accepted: boolean;
};

export type PoidhBountyDetail = {
  id: number;
  issuer: string;
  name: string;
  description: string;
  amountWei: bigint;
  amountEth: string;
  active: boolean;
  votingClaimId: number;
  voteYes: bigint;
  voteNo: bigint;
  voteDeadline: number;
  voteActive: boolean;
  voteEnded: boolean;
  participants: Array<{ address: string; amountWei: bigint; amountEth: string }>;
  claims: PoidhClaimView[];
  minContributionWei: bigint;
  minContributionEth: string;
  /** True when external funders joined — claim must go to 48h vote. */
  needsContributorVote: boolean;
};

const ZERO = '0x0000000000000000000000000000000000000000';

const BOUNTY_CREATED_TOPIC =
  '0xd265c5d6a9224c4853317e9e3262b0605b45f0e87c8bfd17d020e54a87c439af' as Hash;

let bountyCounterCache: { value: number; at: number } | null = null;
const BOUNTY_COUNTER_CACHE_MS = 45_000;

/** Short-lived cache — avoids hammering bountyCounter during spin-up + linking. */
export async function readBountyCounterCached(force = false): Promise<number> {
  const now = Date.now();
  if (
    !force &&
    bountyCounterCache &&
    now - bountyCounterCache.at < BOUNTY_COUNTER_CACHE_MS
  ) {
    return bountyCounterCache.value;
  }
  const value = Number(
    await poidhRead(() =>
      poidhPublicClient.readContract({
        address: POIDH_V3_BASE,
        abi: poidhV3Abi,
        functionName: 'bountyCounter',
      })
    )
  );
  bountyCounterCache = { value, at: now };
  return value;
}

export function invalidateBountyCounterCache(): void {
  bountyCounterCache = null;
}

/** Resolve new bounty id from tx receipt logs — no extra bountyCounter eth_call. */
export function parseBountyIdFromCreateReceipt(
  receipt: TransactionReceipt,
  issuer: Address
): number | null {
  const issuerLower = issuer.toLowerCase();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== POIDH_V3_BASE.toLowerCase()) continue;
    if (log.topics[0]?.toLowerCase() !== BOUNTY_CREATED_TOPIC.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: poidhV3Abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== 'BountyCreated') continue;
      const args = decoded.args as {
        id?: bigint;
        issuer?: Address;
      };
      if (args.issuer?.toLowerCase() !== issuerLower) continue;
      const id = Number(args.id);
      return Number.isFinite(id) && id > 0 ? id : null;
    } catch {
      continue;
    }
  }
  return null;
}

export async function poidhRead<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const transient =
        /rate limit|429|too many|rpc request failed|limit exceeded|timeout|503|502|overloaded/i.test(
          msg
        );
      if (attempt < retries - 1 && transient) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function readMinContribution(): Promise<bigint> {
  try {
    return await poidhPublicClient.readContract({
      address: POIDH_V3_BASE,
      abi: poidhV3Abi,
      functionName: 'MIN_CONTRIBUTION',
    });
  } catch {
    return parseEther('0.00001');
  }
}

async function readParticipants(bountyId: number): Promise<PoidhBountyDetail['participants']> {
  const out: PoidhBountyDetail['participants'] = [];
  for (let i = 0; i < 150; i++) {
    try {
      const addr = await poidhRead(() =>
        poidhPublicClient.readContract({
          address: POIDH_V3_BASE,
          abi: poidhV3Abi,
          functionName: 'participants',
          args: [BigInt(bountyId), BigInt(i)],
        })
      );
      const address = String(addr).toLowerCase();
      if (address === ZERO) continue;
      const amountWei = await poidhRead(() =>
        poidhPublicClient.readContract({
          address: POIDH_V3_BASE,
          abi: poidhV3Abi,
          functionName: 'participantAmounts',
          args: [BigInt(bountyId), BigInt(i)],
        })
      );
      if (amountWei > 0n) {
        out.push({
          address,
          amountWei,
          amountEth: formatEther(amountWei),
        });
      }
    } catch {
      break;
    }
  }
  return out;
}

async function readEverHadExternalContributor(bountyId: number): Promise<boolean> {
  try {
    return await poidhRead(() =>
      poidhPublicClient.readContract({
        address: POIDH_V3_BASE,
        abi: poidhV3Abi,
        functionName: 'everHadExternalContributor',
        args: [BigInt(bountyId)],
      })
    );
  } catch {
    return false;
  }
}

export function bountyNeedsContributorVote(
  detail: Pick<PoidhBountyDetail, 'participants' | 'needsContributorVote'>
): boolean {
  return detail.needsContributorVote || detail.participants.length > 1;
}

async function readClaims(bountyId: number): Promise<PoidhClaimView[]> {
  try {
    const rows = await poidhRead(() =>
      poidhPublicClient.readContract({
        address: POIDH_V3_BASE,
        abi: poidhV3Abi,
        functionName: 'getClaimsByBountyId',
        args: [BigInt(bountyId), 0n],
      })
    );
    return rows
      .map((row) => ({
        id: Number(row.id),
        issuer: String(row.issuer).toLowerCase(),
        name: String(row.name || ''),
        description: String(row.description || ''),
        createdAt: Number(row.createdAt),
        accepted: Boolean(row.accepted),
      }))
      .filter((c) => c.id > 0 && c.issuer !== ZERO);
  } catch {
    return [];
  }
}

export async function fetchPoidhBountyDetail(bountyId: number): Promise<PoidhBountyDetail | null> {
  if (!bountyId || bountyId <= 0) return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const row = await poidhRead(() =>
        poidhPublicClient.readContract({
          address: POIDH_V3_BASE,
          abi: poidhV3Abi,
          functionName: 'bounties',
          args: [BigInt(bountyId)],
        })
      );

      const issuer = String(row[1]).toLowerCase();
      if (issuer === ZERO) return null;

      let votingClaimId = 0n;
      let voteTracker: readonly [bigint, bigint, bigint] = [0n, 0n, 0n];
      let minContributionWei = parseEther('0.00001');
      let participants: PoidhBountyDetail['participants'] = [];
      let claims: PoidhClaimView[] = [];

      try {
        votingClaimId = await poidhRead(() =>
          poidhPublicClient.readContract({
            address: POIDH_V3_BASE,
            abi: poidhV3Abi,
            functionName: 'bountyCurrentVotingClaim',
            args: [BigInt(bountyId)],
          })
        );
      } catch {
        /* keep defaults */
      }
      try {
        voteTracker = await poidhRead(() =>
          poidhPublicClient.readContract({
            address: POIDH_V3_BASE,
            abi: poidhV3Abi,
            functionName: 'bountyVotingTracker',
            args: [BigInt(bountyId)],
          })
        );
      } catch {
        /* keep defaults */
      }
      try {
        minContributionWei = await readMinContribution();
      } catch {
        /* keep defaults */
      }
      try {
        participants = await readParticipants(bountyId);
      } catch {
        /* keep defaults */
      }
      try {
        claims = await readClaims(bountyId);
      } catch {
        /* keep defaults */
      }
      const everExternal = await readEverHadExternalContributor(bountyId);

      const claimer = String(row[5]).toLowerCase();
      const active = claimer === ZERO;
      const deadline = Number(voteTracker[2]);
      const nowSec = Math.floor(Date.now() / 1000);
      const vClaim = Number(votingClaimId);
      const voteActive = vClaim > 0 && deadline > nowSec;

      return {
        id: bountyId,
        issuer,
        name: String(row[2] || ''),
        description: String(row[3] || ''),
        amountWei: row[4],
        amountEth: formatEther(row[4]),
        active,
        votingClaimId: vClaim,
        voteYes: voteTracker[0],
        voteNo: voteTracker[1],
        voteDeadline: deadline,
        voteActive,
        voteEnded: vClaim > 0 && deadline > 0 && deadline <= nowSec,
        participants,
        claims,
        minContributionWei,
        minContributionEth: formatEther(minContributionWei),
        needsContributorVote: everExternal || participants.length > 1,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const transient = /rate limit|429|too many|rpc request failed|limit exceeded|timeout|503|502|overloaded/i.test(
        msg
      );
      if (attempt < 2 && transient) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

export function participantStake(
  detail: PoidhBountyDetail,
  wallet: string | null | undefined
): bigint {
  if (!wallet) return 0n;
  const w = wallet.toLowerCase();
  return detail.participants.find((p) => p.address === w)?.amountWei ?? 0n;
}

export async function readPendingWithdrawal(wallet: Address): Promise<bigint> {
  return poidhPublicClient.readContract({
    address: POIDH_V3_BASE,
    abi: poidhV3Abi,
    functionName: 'pendingWithdrawals',
    args: [wallet],
  });
}

async function waitTx(wallet: WalletClient, hash: `0x${string}`) {
  await poidhPublicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  return hash;
}

export async function poidhJoinBounty(
  wallet: WalletClient,
  account: Address,
  bountyId: number,
  ethAmount: string
) {
  const value = parseEther(ethAmount);
  const hash = await wallet.writeContract({
    account,
    chain: base,
    address: POIDH_V3_BASE,
    abi: poidhV3Abi,
    functionName: 'joinOpenBounty',
    args: [BigInt(bountyId)],
    value,
  });
  return waitTx(wallet, hash);
}

export async function poidhCreateClaim(
  wallet: WalletClient,
  account: Address,
  options: {
    bountyId: number;
    name: string;
    description: string;
    proofUri: string;
  }
) {
  const hash = await wallet.writeContract({
    account,
    chain: base,
    address: POIDH_V3_BASE,
    abi: poidhV3Abi,
    functionName: 'createClaim',
    args: [
      BigInt(options.bountyId),
      options.name,
      options.description,
      options.proofUri,
    ],
  });
  return waitTx(wallet, hash);
}

export async function poidhVoteClaim(
  wallet: WalletClient,
  account: Address,
  bountyId: number,
  yes: boolean
) {
  const hash = await wallet.writeContract({
    account,
    chain: base,
    address: POIDH_V3_BASE,
    abi: poidhV3Abi,
    functionName: 'voteClaim',
    args: [BigInt(bountyId), yes],
  });
  return waitTx(wallet, hash);
}

export async function poidhResolveVote(
  wallet: WalletClient,
  account: Address,
  bountyId: number
) {
  const hash = await wallet.writeContract({
    account,
    chain: base,
    address: POIDH_V3_BASE,
    abi: poidhV3Abi,
    functionName: 'resolveVote',
    args: [BigInt(bountyId)],
  });
  return waitTx(wallet, hash);
}

export async function poidhWithdraw(wallet: WalletClient, account: Address) {
  const hash = await wallet.writeContract({
    account,
    chain: base,
    address: POIDH_V3_BASE,
    abi: poidhV3Abi,
    functionName: 'withdraw',
  });
  return waitTx(wallet, hash);
}
