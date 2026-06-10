import { getCommunity, getLaunches } from './db';
import { fetchLaunchByAddress, getLaunchOwnerWallets } from './bankr-api';
import { holdsToken } from './holder';
import {
  isTrustedDelegateWallet,
  normalizeTrustedDelegates,
  trustedDelegateWallets,
} from './space-delegates';
import type { TrustedDelegateEntry } from './types';
import { normalizeAddr } from './utils';

export type SpaceRoles = {
  feeRecipient: string;
  deployer: string;
};

export async function getLaunchRoles(tokenAddress: string): Promise<SpaceRoles> {
  const token = normalizeAddr(tokenAddress);
  let launch = (await getLaunches()).find((l) => l.tokenAddress?.toLowerCase() === token);
  if (!launch) {
    launch = (await fetchLaunchByAddress(token)) || undefined;
  }
  if (launch) {
    return getLaunchOwnerWallets(launch);
  }
  const community = await getCommunity(token);
  return {
    feeRecipient: community?.ownerWallet?.toLowerCase() || '',
    deployer: '',
  };
}

export async function getTokenBeneficiaryWallet(
  tokenAddress: string
): Promise<string | null> {
  const { feeRecipient } = await getLaunchRoles(tokenAddress);
  return feeRecipient || null;
}

export async function isTokenBeneficiary(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const beneficiary = await getTokenBeneficiaryWallet(tokenAddress);
  if (!beneficiary) return false;
  return wallet.toLowerCase() === beneficiary;
}

export async function isTokenDeployer(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const { deployer } = await getLaunchRoles(tokenAddress);
  if (!deployer) return false;
  return wallet.toLowerCase() === deployer;
}

export type SpacePermissions = {
  isBeneficiary: boolean;
  isDeployer: boolean;
  isTrustedDelegate: boolean;
  isFounder: boolean;
  verified: boolean;
  allowDeployerEdit: boolean;
  trustedDelegates: TrustedDelegateEntry[];
  trustedDelegateWallets: string[];
  canEditProfile: boolean;
  canEditFundraising: boolean;
  canPinPosts: boolean;
  holds: boolean;
  balance: number;
  canPost: boolean;
  canReact: boolean;
  /** Social/moderation access without holding tokens */
  isPrivilegedPoster: boolean;
};

export async function resolveSpacePermissions(
  wallet: string,
  tokenAddress: string,
  chain = 'base'
): Promise<SpacePermissions> {
  const w = wallet.toLowerCase();
  const token = normalizeAddr(tokenAddress);
  const community = await getCommunity(token);
  const verified = !!community?.verified;
  const allowDeployerEdit = !!community?.allowDeployerEdit;
  const trustedDelegates = normalizeTrustedDelegates(community?.trustedDelegates);
  const isFounder = community?.founderWallet?.toLowerCase() === w;
  const resolvedChain = community?.chain || chain;

  const [isBeneficiary, isDeployer, holdResult] = await Promise.all([
    isTokenBeneficiary(w, token),
    isTokenDeployer(w, token),
    holdsToken(w, token, resolvedChain),
  ]);

  const isTrustedDelegate =
    verified && isTrustedDelegateWallet(w, trustedDelegates);

  const deployerHasSocialAccess =
    isDeployer && (!verified || allowDeployerEdit);
  const hasSocialAccess =
    isBeneficiary || deployerHasSocialAccess || isTrustedDelegate;

  const canEditProfile = hasSocialAccess;
  const canEditFundraising = isBeneficiary;
  const canPinPosts = verified && hasSocialAccess;
  const canPost = holdResult.holds || hasSocialAccess;
  const canReact = canPost;

  return {
    isBeneficiary,
    isDeployer,
    isTrustedDelegate,
    isFounder,
    verified,
    allowDeployerEdit,
    trustedDelegates,
    trustedDelegateWallets: trustedDelegateWallets(trustedDelegates),
    canEditProfile,
    canEditFundraising,
    canPinPosts,
    holds: holdResult.holds,
    balance: holdResult.balance,
    canPost,
    canReact,
    isPrivilegedPoster: hasSocialAccess,
  };
}

export async function canEditCommunityProfile(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const permissions = await resolveSpacePermissions(wallet, tokenAddress);
  return permissions.canEditProfile;
}

export async function canEditCommunityFundraising(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const permissions = await resolveSpacePermissions(wallet, tokenAddress);
  return permissions.canEditFundraising;
}

export async function canPinCommunityPosts(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const permissions = await resolveSpacePermissions(wallet, tokenAddress);
  return permissions.canPinPosts;
}
