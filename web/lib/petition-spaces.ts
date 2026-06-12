import { kvGet, kvSet } from './kv-store';
import { petitionUrl } from './site-url';
import type { PetitionSpace, Post } from './types';

const PETITIONS_KEY = 'petition_spaces';
const PETITION_POSTS_KEY = 'petition_posts';

export function normalizePetitionId(raw: string): string {
  return String(raw || '').trim();
}

export async function getPetitionSpaces(): Promise<PetitionSpace[]> {
  return (await kvGet<PetitionSpace[]>(PETITIONS_KEY)) || [];
}

export async function setPetitionSpaces(spaces: PetitionSpace[]): Promise<void> {
  await kvSet(PETITIONS_KEY, spaces);
}

export async function getPetitionSpace(id: string): Promise<PetitionSpace | null> {
  const pid = normalizePetitionId(id);
  const spaces = await getPetitionSpaces();
  return spaces.find((s) => s.tmpPetitionId === pid) || null;
}

export async function savePetitionSpace(space: PetitionSpace): Promise<PetitionSpace> {
  const spaces = await getPetitionSpaces();
  const index = spaces.findIndex((s) => s.tmpPetitionId === space.tmpPetitionId);
  if (index === -1) {
    spaces.unshift(space);
  } else {
    spaces[index] = space;
  }
  await setPetitionSpaces(spaces);
  return space;
}

export async function getPetitionSpaceByToken(
  tokenAddress: string
): Promise<PetitionSpace | null> {
  const token = tokenAddress.toLowerCase();
  const spaces = await getPetitionSpaces();
  return spaces.find((s) => s.tokenAddress?.toLowerCase() === token) || null;
}

export function createPetitionSpaceRecord(options: {
  tmpPetitionId: string;
  founderWallet: string;
  tokenName: string;
  tokenSymbol: string;
  description: string;
  maxUnitsPerWallet: number;
  supporterSlots?: number | null;
  tmkClaimOptIn?: boolean;
  imageUrl?: string | null;
}): PetitionSpace {
  const now = Date.now();
  return {
    tmpPetitionId: options.tmpPetitionId,
    phase: 'petition',
    founderWallet: options.founderWallet.toLowerCase(),
    tokenName: options.tokenName,
    tokenSymbol: options.tokenSymbol.replace(/^\$/, '').toUpperCase(),
    description: options.description,
    maxUnitsPerWallet: options.maxUnitsPerWallet,
    supporterSlots: options.supporterSlots ?? null,
    tmkClaimOptIn: options.tmkClaimOptIn ?? false,
    imageUrl: options.imageUrl ?? null,
    tokenAddress: null,
    createdAt: now,
    updatedAt: now,
    websiteUrl: petitionUrl(options.tmpPetitionId),
  };
}

export async function getAllPetitionPosts(): Promise<Record<string, Post[]>> {
  return (await kvGet<Record<string, Post[]>>(PETITION_POSTS_KEY)) || {};
}

export async function getPetitionPosts(petitionId: string): Promise<Post[]> {
  const all = await getAllPetitionPosts();
  return all[normalizePetitionId(petitionId)] || [];
}

export async function setPetitionPosts(petitionId: string, posts: Post[]): Promise<void> {
  const all = await getAllPetitionPosts();
  all[normalizePetitionId(petitionId)] = posts;
  await kvSet(PETITION_POSTS_KEY, all);
}

export function isPetitionFounder(space: PetitionSpace, wallet: string): boolean {
  return space.founderWallet.toLowerCase() === wallet.toLowerCase();
}

export function isPetitionBacker(
  space: PetitionSpace,
  wallet: string,
  orderWallets: string[]
): boolean {
  const w = wallet.toLowerCase();
  if (isPetitionFounder(space, w)) return true;
  return orderWallets.some((o) => o.toLowerCase() === w);
}
