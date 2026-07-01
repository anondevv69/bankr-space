import { createHash, randomBytes } from 'crypto';
import { kvGet, kvSet } from './kv-store';
import { getCommunity } from './db';
import { canActAsFeeRecipient, resolveSpacePermissions } from './community-owner';
import { createPlatformAgentPost } from './agent-pool-feed';
import { submitBankrAgentPrompt } from './bankr-agent-client';
import { communityUrl } from './site-url';
import { normalizeAddr } from './utils';
import type { CommunityRaffle, RaffleEntry, RaffleEntryRule } from './types';
import {
  isRaffleX402CampaignId,
  parseRaffleX402CampaignId,
  raffleX402CampaignId,
} from './raffle-x402-ids';

export type { CommunityRaffle, RaffleEntry, RaffleEntryRule };
export { isRaffleX402CampaignId, parseRaffleX402CampaignId, raffleX402CampaignId };

const RAFFLES_KEY = 'community_raffles';

export const MIN_RAFFLE_PRIZE_USD = 5;
export const MAX_RAFFLE_PRIZE_USD = 500;
export const RAFFLE_FUND_BUFFER = 1.05;
export const MIN_RAFFLE_DURATION_HOURS = 1;
export const MAX_RAFFLE_DURATION_HOURS = 24 * 28;

function normalizeRaffleId(id: string): string {
  return id.toLowerCase().replace(/_/g, '-');
}

function clampPrizeUsd(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return MIN_RAFFLE_PRIZE_USD;
  return Math.min(MAX_RAFFLE_PRIZE_USD, Math.max(MIN_RAFFLE_PRIZE_USD, Math.round(n * 100) / 100));
}

function clampDurationHours(value: unknown): number {
  const n = Number(value);
  const hours = Number.isFinite(n) ? Math.round(n) : 24;
  return Math.min(MAX_RAFFLE_DURATION_HOURS, Math.max(MIN_RAFFLE_DURATION_HOURS, hours));
}

function clampRaised(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function newRaffleId(): string {
  return `rfl-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
}

function drawSeedPair(): { drawSeed: string; drawSeedCommitment: string } {
  const drawSeed = randomBytes(32).toString('hex');
  const drawSeedCommitment = createHash('sha256').update(drawSeed).digest('hex');
  return { drawSeed, drawSeedCommitment };
}

export async function getAllRaffles(): Promise<Record<string, CommunityRaffle[]>> {
  return (await kvGet<Record<string, CommunityRaffle[]>>(RAFFLES_KEY)) || {};
}

export async function getRaffles(tokenAddress: string): Promise<CommunityRaffle[]> {
  const all = await getAllRaffles();
  return all[normalizeAddr(tokenAddress).toLowerCase()] || [];
}

export async function getRaffleById(
  tokenAddress: string,
  raffleId: string
): Promise<CommunityRaffle | null> {
  const raffles = await getRaffles(tokenAddress);
  const norm = normalizeRaffleId(raffleId);
  return raffles.find((r) => normalizeRaffleId(r.id) === norm) || null;
}

async function saveRaffles(tokenAddress: string, raffles: CommunityRaffle[]): Promise<void> {
  const all = await getAllRaffles();
  all[normalizeAddr(tokenAddress).toLowerCase()] = raffles;
  await kvSet(RAFFLES_KEY, all);
}

export function isRaffleOpen(raffle: CommunityRaffle): boolean {
  if (raffle.status !== 'open') return false;
  if (!raffle.endsAt) return false;
  return Date.now() < raffle.endsAt;
}

export function raffleGoalUsd(prizeUsd: number): number {
  return Math.round(prizeUsd * RAFFLE_FUND_BUFFER * 100) / 100;
}

export function isRaffleFunded(raffle: CommunityRaffle): boolean {
  return raffle.raisedUsd >= raffle.goalUsd;
}

function activateIfFunded(raffle: CommunityRaffle): CommunityRaffle {
  if (raffle.status !== 'pending' || !isRaffleFunded(raffle)) return raffle;
  const now = Date.now();
  const durationMs = raffle.durationHours * 60 * 60 * 1000;
  return {
    ...raffle,
    status: 'open',
    fundedAt: now,
    startsAt: now,
    endsAt: now + durationMs,
  };
}

export async function createCommunityRaffle(input: {
  tokenAddress: string;
  wallet: string;
  title: string;
  prizeLabel: string;
  productHint: string;
  country?: string;
  prizeUsd: number;
  entryRule?: RaffleEntryRule;
  minBalance?: number | null;
  durationHours?: number;
}): Promise<CommunityRaffle> {
  const token = normalizeAddr(input.tokenAddress);
  const wallet = input.wallet.toLowerCase();

  const community = await getCommunity(token);
  if (!community) throw new Error('Space not found');
  if (!community.verified) throw new Error('Space must be verified before creating a raffle');
  if (!(await canActAsFeeRecipient(wallet, token))) {
    throw new Error('Only the fee recipient can create raffles');
  }

  const prizeUsd = clampPrizeUsd(input.prizeUsd);
  const { drawSeed, drawSeedCommitment } = drawSeedPair();
  const now = Date.now();

  const raffle: CommunityRaffle = {
    id: newRaffleId(),
    tokenAddress: token,
    title: String(input.title || input.prizeLabel).trim().slice(0, 120),
    prizeLabel: String(input.prizeLabel).trim().slice(0, 120),
    productHint: String(input.productHint || input.prizeLabel).trim().slice(0, 200),
    country: String(input.country || 'US').trim().slice(0, 8).toUpperCase(),
    prizeUsd,
    goalUsd: raffleGoalUsd(prizeUsd),
    raisedUsd: 0,
    entryRule: input.entryRule === 'one_per_unit' ? 'one_per_unit' : 'one_per_wallet',
    minBalance:
      input.minBalance != null && Number.isFinite(Number(input.minBalance))
        ? Number(input.minBalance)
        : null,
    durationHours: clampDurationHours(input.durationHours),
    startsAt: null,
    endsAt: null,
    status: 'pending',
    entries: [],
    createdBy: wallet,
    createdAt: now,
    fundedAt: null,
    drawSeed,
    drawSeedCommitment,
    winnerWallet: null,
    drawnAt: null,
    totalTickets: 0,
    bankrAgentJobId: null,
    fulfillmentNote: null,
    bitrefillInvoiceId: null,
  };

  const raffles = await getRaffles(token);
  raffles.unshift(raffle);
  await saveRaffles(token, raffles);
  return raffle;
}

export async function creditRaffleUsd(
  tokenAddress: string,
  raffleId: string,
  amountUsd: number
): Promise<CommunityRaffle | null> {
  const token = normalizeAddr(tokenAddress);
  const amount = clampRaised(amountUsd);
  if (amount <= 0) return null;

  const raffles = await getRaffles(token);
  const norm = normalizeRaffleId(raffleId);
  const index = raffles.findIndex((r) => normalizeRaffleId(r.id) === norm);
  if (index === -1) return null;

  let raffle = {
    ...raffles[index],
    raisedUsd: clampRaised(raffles[index].raisedUsd + amount),
  };
  raffle = activateIfFunded(raffle);
  raffles[index] = raffle;
  await saveRaffles(token, raffles);
  return raffle;
}

export async function enterCommunityRaffle(
  tokenAddress: string,
  raffleId: string,
  wallet: string,
  chain = 'base'
): Promise<CommunityRaffle> {
  const token = normalizeAddr(tokenAddress);
  const w = wallet.toLowerCase();

  const raffles = await getRaffles(token);
  const norm = normalizeRaffleId(raffleId);
  const index = raffles.findIndex((r) => normalizeRaffleId(r.id) === norm);
  if (index === -1) throw new Error('Raffle not found');

  const raffle = raffles[index];
  if (!isRaffleOpen(raffle)) {
    throw new Error('This raffle is not accepting entries');
  }

  if (raffle.entries.some((e) => e.wallet === w)) {
    throw new Error('You already entered this raffle');
  }

  const permissions = await resolveSpacePermissions(w, token, chain);
  let tickets = 0;

  if (raffle.entryRule === 'one_per_unit') {
    if (permissions.voteUsesUnits) {
      tickets = Math.max(0, Math.floor(permissions.unitBalance));
    } else if (permissions.holds) {
      tickets = 1;
    }
  } else if (permissions.holds || permissions.isPrivilegedPoster) {
    tickets = 1;
    if (raffle.minBalance != null && permissions.balance < raffle.minBalance) {
      throw new Error(
        `Minimum balance ${raffle.minBalance} required to enter`
      );
    }
  }

  if (tickets < 1) {
    throw new Error('You must hold this token to enter the raffle');
  }

  const entry: RaffleEntry = {
    wallet: w,
    tickets,
    enteredAt: Date.now(),
  };

  const updated: CommunityRaffle = {
    ...raffle,
    entries: [...raffle.entries, entry],
    totalTickets: raffle.totalTickets + tickets,
  };

  raffles[index] = updated;
  await saveRaffles(token, raffles);
  return updated;
}

function buildTicketPool(raffle: CommunityRaffle): string[] {
  const pool: string[] = [];
  for (const entry of raffle.entries) {
    for (let i = 0; i < entry.tickets; i++) {
      pool.push(entry.wallet);
    }
  }
  return pool;
}

function pickWinnerWallet(raffle: CommunityRaffle, pool: string[]): string | null {
  if (pool.length === 0) return null;
  const entriesDigest = createHash('sha256')
    .update(
      raffle.entries
        .map((e) => `${e.wallet}:${e.tickets}`)
        .sort()
        .join('|')
    )
    .digest('hex');
  const hash = createHash('sha256')
    .update(`${raffle.drawSeed}:${raffle.id}:${entriesDigest}`)
    .digest();
  const index = hash.readUInt32BE(0) % pool.length;
  return pool[index] || null;
}

function buildBitrefillFulfillmentPrompt(raffle: CommunityRaffle, symbol: string): string {
  const winner = raffle.winnerWallet || '';
  const space = communityUrl(raffle.tokenAddress);
  return (
    `Community raffle fulfillment for ${symbol} on Bankr Space.\n\n` +
    `Install and use the Bitrefill agent skill from https://www.bitrefill.com/agents/SKILL.md\n\n` +
    `Purchase: ${raffle.prizeLabel}\n` +
    `Search hint: ${raffle.productHint}\n` +
    `Country: ${raffle.country}\n` +
    `Budget: up to $${raffle.prizeUsd} USD (USDC on Base)\n\n` +
    `Winner wallet: ${winner}\n` +
    `Raffle id: ${raffle.id}\n` +
    `Space: ${space}\n\n` +
    `Rules:\n` +
    `- Confirm product and price before buying unless autonomous mode is enabled for this space.\n` +
    `- NEVER post gift card codes on the public feed or in tweets.\n` +
    `- Log invoice_id in your response for the platform audit trail only.\n` +
    `- Tell the winner to check Bankr DM or contact the fee recipient for private delivery.\n` +
    `- If purchase fails, explain why and do not retry without confirmation.`
  );
}

export async function drawCommunityRaffle(
  tokenAddress: string,
  raffleId: string
): Promise<CommunityRaffle | null> {
  const token = normalizeAddr(tokenAddress);
  const raffles = await getRaffles(token);
  const norm = normalizeRaffleId(raffleId);
  const index = raffles.findIndex((r) => normalizeRaffleId(r.id) === norm);
  if (index === -1) return null;

  let raffle = raffles[index];
  if (raffle.status !== 'open' || !raffle.endsAt || Date.now() < raffle.endsAt) {
    return raffle;
  }

  const pool = buildTicketPool(raffle);
  const winnerWallet = pickWinnerWallet(raffle, pool);
  const drawnAt = Date.now();

  raffle = {
    ...raffle,
    status: winnerWallet ? 'completed' : 'failed',
    winnerWallet,
    drawnAt,
    fulfillmentNote: winnerWallet
      ? 'Winner drawn — Bitrefill fulfillment queued'
      : 'No entries — raffle ended without a winner',
  };

  raffles[index] = raffle;
  await saveRaffles(token, raffles);

  const community = await getCommunity(token);
  const symbol = community?.symbol || 'token';

  if (winnerWallet) {
    const short = `${winnerWallet.slice(0, 6)}…${winnerWallet.slice(-4)}`;
    await createPlatformAgentPost(
      token,
      `🎁 Raffle ended — ${raffle.prizeLabel}\n\nWinner: ${short}\nEntries: ${raffle.entries.length} wallets · ${raffle.totalTickets} tickets\n\nGift card fulfillment via Bitrefill is in progress. The winner will receive the code privately — never in this feed.`
    );

    try {
      const jobId = await submitBankrAgentPrompt(buildBitrefillFulfillmentPrompt(raffle, symbol));
      raffle = { ...raffle, bankrAgentJobId: jobId };
      raffles[index] = raffle;
      await saveRaffles(token, raffles);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Agent fulfillment failed';
      raffle = {
        ...raffle,
        status: 'failed',
        fulfillmentNote: msg.slice(0, 500),
      };
      raffles[index] = raffle;
      await saveRaffles(token, raffles);
    }
  } else {
    await createPlatformAgentPost(
      token,
      `🎁 Raffle ended — ${raffle.prizeLabel}\n\nNo entries were received. Prize pool remains credited on the raffle record for the fee recipient to review.`
    );
  }

  return raffle;
}

export async function processExpiredRaffles(): Promise<{
  checked: number;
  drawn: number;
  errors: string[];
}> {
  const all = await getAllRaffles();
  let checked = 0;
  let drawn = 0;
  const errors: string[] = [];

  for (const [tokenKey, raffles] of Object.entries(all)) {
    for (const raffle of raffles) {
      if (raffle.status !== 'open' || !raffle.endsAt || Date.now() < raffle.endsAt) continue;
      checked += 1;
      try {
        await drawCommunityRaffle(tokenKey, raffle.id);
        drawn += 1;
      } catch (err) {
        errors.push(
          `${raffle.id}: ${err instanceof Error ? err.message : 'draw failed'}`
        );
      }
    }
  }

  return { checked, drawn, errors };
}
