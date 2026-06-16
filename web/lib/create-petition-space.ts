import {
  createPetitionSpaceRecord,
  savePetitionSpace,
} from '@/lib/petition-spaces';
import { petitionUrl, getSiteUrl } from '@/lib/site-url';
import { tmpCreatePetition, tmpFetchPetitionConfig } from '@/lib/tmp-petition';
import { queuePetitionCreatedTweet } from '@/lib/twitter-space-events';
import type { PetitionSpace } from '@/lib/types';

export type CreatePetitionInput = {
  founderWallet: string;
  tokenName: string;
  tokenSymbol: string;
  description: string;
  supporterSlots?: number | null;
  maxUnitsPerWallet?: number;
  tmkClaimOptIn?: boolean;
  imageUrl?: string;
};

export type CreatePetitionResult = {
  petition: PetitionSpace;
  petitionUrl: string;
  publicCap: number;
  message: string;
};

function normalizeSymbol(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^\$/, '')
    .toUpperCase();
}

export function validatePetitionInput(input: CreatePetitionInput): string | null {
  const tokenName = String(input.tokenName || '').trim();
  const tokenSymbol = normalizeSymbol(input.tokenSymbol);
  const description = String(input.description || '').trim();

  if (tokenName.length < 2) return 'Token name required (min 2 chars)';
  if (!/^[A-Z0-9]{1,10}$/.test(tokenSymbol)) {
    return 'Symbol required — letters/numbers only, max 10 chars';
  }
  if (description.length < 4) return 'Description required (min 4 chars)';
  return null;
}

export async function createPetitionSpaceForWallet(
  input: CreatePetitionInput
): Promise<CreatePetitionResult> {
  const wallet = input.founderWallet.toLowerCase();
  const tokenName = String(input.tokenName || '').trim();
  const tokenSymbol = normalizeSymbol(input.tokenSymbol);
  const description = String(input.description || '').trim();
  const validationError = validatePetitionInput(input);
  if (validationError) throw new Error(validationError);

  const supporterSlots = input.supporterSlots ? Number(input.supporterSlots) : null;
  const maxUnitsPerWallet = Math.min(
    1000,
    Math.max(1, Number(input.maxUnitsPerWallet) || 10)
  );
  const tmkClaimOptIn = input.tmkClaimOptIn === true;
  const imageUrl = input.imageUrl ? String(input.imageUrl).trim() : undefined;

  const config = await tmpFetchPetitionConfig();
  if (!config.base?.enabled) {
    throw new Error('Base petitions are not enabled on TMP right now');
  }
  if (tmkClaimOptIn && !config.base.tmkClaimService) {
    throw new Error('TMK claim service is not available right now');
  }

  const siteBase = getSiteUrl().replace(/\/$/, '');
  const createBody: Parameters<typeof tmpCreatePetition>[0] = {
    chain: 'base',
    tokenName,
    tokenSymbol,
    starterWallet: wallet,
    description,
    imageUrl,
    websiteUrl: `${siteBase}/community/petition`,
    tmkClaimOptIn: tmkClaimOptIn || undefined,
  };
  if (supporterSlots && supporterSlots >= 1) {
    createBody.supporterSlots = Math.min(1000, Math.floor(supporterSlots));
  } else {
    createBody.maxUnitsPerWallet = maxUnitsPerWallet;
  }

  const tmpPetition = await tmpCreatePetition(createBody);

  const space = createPetitionSpaceRecord({
    tmpPetitionId: tmpPetition.id,
    founderWallet: wallet,
    tokenName,
    tokenSymbol,
    description,
    maxUnitsPerWallet: tmpPetition.maxUnitsPerWallet || maxUnitsPerWallet,
    supporterSlots: tmpPetition.supporterSlots ?? supporterSlots,
    tmkClaimOptIn: tmpPetition.tmkClaimOptIn ?? tmkClaimOptIn,
    imageUrl: imageUrl || tmpPetition.imageUrl || null,
  });
  space.websiteUrl = petitionUrl(tmpPetition.id);
  await savePetitionSpace(space);

  queuePetitionCreatedTweet(space);

  const publicCap = tmkClaimOptIn
    ? config.base.publicSaleUnitsWithTmkClaim || 999
    : config.base.goalUnits;

  return {
    petition: space,
    petitionUrl: space.websiteUrl,
    publicCap,
    message: `Petition space created for $${tokenSymbol}. Back with ETH to reach ${publicCap} units.`,
  };
}
