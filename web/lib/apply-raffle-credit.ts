import { getCommunity } from '@/lib/db';
import { getTokenBeneficiaryWallet } from '@/lib/community-owner';
import {
  creditRaffleUsd,
  getRaffleById,
  isRaffleFunded,
  parseRaffleX402CampaignId,
} from '@/lib/community-raffles';
import { normalizeAddr } from '@/lib/utils';
import { SPACE_FUND_X402_CREDIT_USD } from '@/lib/x402-config';
import type { CommunityRaffle } from '@/lib/types';

export type ApplyRaffleCreditResult =
  | {
      success: true;
      tokenAddress: string;
      raffleId: string;
      creditedUsd: number;
      raisedUsd: number;
      goalUsd: number;
      funded: boolean;
      raffle: CommunityRaffle;
    }
  | { success: false; error: string; status: number };

export async function applyRaffleCredit(
  tokenAddress: string,
  campaignId: string,
  amountUsd: number
): Promise<ApplyRaffleCreditResult> {
  const normalized = normalizeAddr(tokenAddress);
  const raffleId = parseRaffleX402CampaignId(campaignId);
  if (!raffleId) {
    return { success: false, error: 'Invalid raffle campaignId', status: 400 };
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { success: false, error: 'amountUsd must be positive', status: 400 };
  }

  const community = await getCommunity(normalized);
  if (!community) {
    return { success: false, error: 'Space not found', status: 404 };
  }
  if (!community.verified) {
    return {
      success: false,
      error: 'Space must be verified before funding raffles.',
      status: 400,
    };
  }

  const raffle = await getRaffleById(normalized, raffleId);
  if (!raffle) {
    return { success: false, error: 'Raffle not found', status: 404 };
  }
  if (raffle.status !== 'pending') {
    return {
      success: false,
      error: 'This raffle is no longer accepting funding.',
      status: 400,
    };
  }
  if (isRaffleFunded(raffle)) {
    return {
      success: false,
      error: 'This raffle is already fully funded.',
      status: 400,
    };
  }

  const updated = await creditRaffleUsd(normalized, raffleId, amountUsd);
  if (!updated) {
    return { success: false, error: 'Failed to credit raffle', status: 500 };
  }

  return {
    success: true,
    tokenAddress: normalized,
    raffleId,
    creditedUsd: amountUsd,
    raisedUsd: updated.raisedUsd,
    goalUsd: updated.goalUsd,
    funded: isRaffleFunded(updated),
    raffle: updated,
  };
}

export async function assertRaffleFundingWallet(
  tokenAddress: string,
  payerWallet: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!payerWallet) return { ok: true };
  const beneficiary = await getTokenBeneficiaryWallet(tokenAddress);
  if (!beneficiary) return { ok: true };
  if (payerWallet.toLowerCase() !== beneficiary.toLowerCase()) {
    return {
      ok: false,
      error: 'Only the fee recipient wallet should fund community raffles.',
    };
  }
  return { ok: true };
}

export const RAFFLE_X402_CREDIT_USD = SPACE_FUND_X402_CREDIT_USD;
