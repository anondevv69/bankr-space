import {
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'wagmi/chains';
import { normalizeAddr } from './utils';
import {
  invalidateBountyCounterCache,
  parseBountyIdFromCreateReceipt,
  POIDH_V3_BASE,
  poidhPublicClient,
  poidhRead,
  poidhV3Abi,
  readBountyCounterCached,
} from './poidh-contract';

const DEFAULT_SEED_ETH = '0.001';

function normalizePrivateKey(raw: string): Hex | null {
  const trimmed = raw.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) return null;
  const hex = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) return null;
  return hex as Hex;
}

export function getPoidhIssuerPrivateKey(): Hex | null {
  const raw = process.env.POIDH_ISSUER_PRIVATE_KEY?.trim();
  if (!raw) return null;
  return normalizePrivateKey(raw);
}

export function getPoidhIssuerWallet(): Address | null {
  const configured = process.env.POIDH_ISSUER_WALLET?.trim();
  if (configured) {
    try {
      return normalizeAddr(configured) as Address;
    } catch {
      return null;
    }
  }
  const key = getPoidhIssuerPrivateKey();
  if (!key) return null;
  return privateKeyToAccount(key).address;
}

export function isPoidhIssuerConfigured(): boolean {
  const key = getPoidhIssuerPrivateKey();
  const wallet = getPoidhIssuerWallet();
  if (!key || !wallet) return false;
  return privateKeyToAccount(key).address.toLowerCase() === wallet.toLowerCase();
}

function issuerWalletClient() {
  const key = getPoidhIssuerPrivateKey();
  if (!key) {
    throw new Error('POIDH_ISSUER_PRIVATE_KEY not configured');
  }
  const account = privateKeyToAccount(key);
  const configured = process.env.POIDH_ISSUER_WALLET?.trim();
  if (configured) {
    const expected = normalizeAddr(configured).toLowerCase();
    if (account.address.toLowerCase() !== expected) {
      throw new Error('POIDH_ISSUER_WALLET does not match POIDH_ISSUER_PRIVATE_KEY');
    }
  }
  return createWalletClient({
    account,
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
  });
}

/** Serialize issuer writes within one serverless instance. */
let issuerWriteChain: Promise<unknown> = Promise.resolve();

function withIssuerWriteQueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = issuerWriteChain.then(fn, fn);
  issuerWriteChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function isTransientTxError(message: string): boolean {
  return /nonce|replacement transaction underpriced|already known|rate limit|429|rpc request failed|limit exceeded|timeout|503|502|overloaded/i.test(
    message
  );
}

async function readIssuerNonce(issuer: Address): Promise<number> {
  return poidhRead(() =>
    poidhPublicClient.getTransactionCount({ address: issuer, blockTag: 'pending' })
  );
}

async function issuerWriteContract(options: {
  functionName: 'createOpenBounty';
  args: readonly [string, string];
  value: bigint;
}): Promise<`0x${string}`>;
async function issuerWriteContract(options: {
  functionName: 'submitClaimForVote';
  args: readonly [bigint, bigint];
}): Promise<`0x${string}`>;
async function issuerWriteContract(options: {
  functionName: 'acceptClaim';
  args: readonly [bigint, bigint];
}): Promise<`0x${string}`>;
async function issuerWriteContract(options: {
  functionName: 'joinOpenBounty';
  args: readonly [bigint];
  value: bigint;
}): Promise<`0x${string}`>;
async function issuerWriteContract(options: {
  functionName: 'createOpenBounty' | 'submitClaimForVote' | 'acceptClaim' | 'joinOpenBounty';
  args: readonly unknown[];
  value?: bigint;
}): Promise<`0x${string}`> {
  return withIssuerWriteQueue(async () => {
    const wallet = issuerWalletClient();
    const issuer = wallet.account!.address;

    let lastErr: unknown;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const nonce = await readIssuerNonce(issuer);
        if (options.functionName === 'createOpenBounty') {
          return await wallet.writeContract({
            chain: base,
            address: POIDH_V3_BASE,
            abi: poidhV3Abi,
            functionName: 'createOpenBounty',
            args: options.args as [string, string],
            value: options.value!,
            nonce,
          });
        }
        if (options.functionName === 'acceptClaim') {
          return await wallet.writeContract({
            chain: base,
            address: POIDH_V3_BASE,
            abi: poidhV3Abi,
            functionName: 'acceptClaim',
            args: options.args as [bigint, bigint],
            nonce,
          });
        }
        if (options.functionName === 'joinOpenBounty') {
          return await wallet.writeContract({
            chain: base,
            address: POIDH_V3_BASE,
            abi: poidhV3Abi,
            functionName: 'joinOpenBounty',
            args: options.args as [bigint],
            value: options.value!,
            nonce,
          });
        }
        return await wallet.writeContract({
          chain: base,
          address: POIDH_V3_BASE,
          abi: poidhV3Abi,
          functionName: 'submitClaimForVote',
          args: options.args as [bigint, bigint],
          nonce,
        });
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt < 5 && isTransientTxError(msg)) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  });
}

async function readMinBountyAmount(): Promise<bigint> {
  try {
    return await poidhRead(() =>
      poidhPublicClient.readContract({
        address: POIDH_V3_BASE,
        abi: poidhV3Abi,
        functionName: 'MIN_BOUNTY_AMOUNT',
      })
    );
  } catch {
    return parseEther(DEFAULT_SEED_ETH);
  }
}

async function readBountyRow(id: number) {
  try {
    return await poidhRead(() =>
      poidhPublicClient.readContract({
        address: POIDH_V3_BASE,
        abi: poidhV3Abi,
        functionName: 'bounties',
        args: [BigInt(id)],
      })
    );
  } catch {
    return null;
  }
}

async function resolveBountyIdAfterCreate(
  txHash: `0x${string}`,
  issuer: Address
): Promise<number> {
  const receipt = await poidhRead(() =>
    poidhPublicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    })
  );

  if (receipt.status === 'reverted') {
    throw new Error('POIDH createOpenBounty transaction reverted on-chain');
  }

  const fromLog = parseBountyIdFromCreateReceipt(receipt, issuer);
  if (fromLog != null) {
    invalidateBountyCounterCache();
    return fromLog;
  }

  const counter = await readBountyCounterCached(true);

  for (let id = counter - 1; id >= Math.max(1, counter - 3); id -= 1) {
    const row = await readBountyRow(id);
    if (!row) continue;
    if (String(row[1]).toLowerCase() === issuer.toLowerCase()) {
      return id;
    }
  }

  throw new Error('Could not resolve POIDH bounty id from transaction');
}

export async function poidhIssuerCreateOpenBounty(options: {
  name: string;
  description: string;
  seedEth?: string;
}): Promise<{ bountyId: number; txHash: `0x${string}`; issuer: Address }> {
  const wallet = issuerWalletClient();
  const issuer = wallet.account!.address;
  const value = parseEther(options.seedEth?.trim() || DEFAULT_SEED_ETH);
  const min = await readMinBountyAmount();
  if (value < min) {
    throw new Error(`Seed amount below POIDH minimum (${min} wei)`);
  }

  const hash = await issuerWriteContract({
    functionName: 'createOpenBounty',
    args: [options.name.slice(0, 120), options.description.slice(0, 8000)],
    value,
  });

  const bountyId = await resolveBountyIdAfterCreate(hash, issuer);
  invalidateBountyCounterCache();
  return { bountyId, txHash: hash, issuer };
}

const MAX_ISSUER_SEED_ETH = 0.1;

export async function poidhIssuerJoinBounty(options: {
  bountyId: number;
  ethAmount: string;
}): Promise<{ txHash: `0x${string}` }> {
  const eth = Number(options.ethAmount);
  if (!Number.isFinite(eth) || eth <= 0) {
    throw new Error('ethAmount must be a positive number');
  }
  if (eth > MAX_ISSUER_SEED_ETH) {
    throw new Error(`Issuer seed capped at ${MAX_ISSUER_SEED_ETH} ETH per request`);
  }
  const value = parseEther(String(eth));
  const hash = await issuerWriteContract({
    functionName: 'joinOpenBounty',
    args: [BigInt(options.bountyId)],
    value,
  });
  await poidhRead(() =>
    poidhPublicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
  );
  return { txHash: hash };
}

export async function poidhIssuerSubmitClaimForVote(options: {
  bountyId: number;
  claimId: number;
}): Promise<{ txHash: `0x${string}` }> {
  const hash = await issuerWriteContract({
    functionName: 'submitClaimForVote',
    args: [BigInt(options.bountyId), BigInt(options.claimId)],
  });
  await poidhRead(() =>
    poidhPublicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
  );
  return { txHash: hash };
}

export async function poidhIssuerAcceptClaim(options: {
  bountyId: number;
  claimId: number;
}): Promise<{ txHash: `0x${string}` }> {
  const hash = await issuerWriteContract({
    functionName: 'acceptClaim',
    args: [BigInt(options.bountyId), BigInt(options.claimId)],
  });
  await poidhRead(() =>
    poidhPublicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
  );
  return { txHash: hash };
}

export async function readPoidhIssuerBalanceEth(): Promise<string | null> {
  const wallet = getPoidhIssuerWallet();
  if (!wallet) return null;
  const wei = await poidhRead(() => poidhPublicClient.getBalance({ address: wallet }));
  return `${Number(wei) / 1e18}`;
}
