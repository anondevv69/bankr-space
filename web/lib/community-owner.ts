import { getCommunity, getLaunches } from './db';
import { fetchLaunchByAddress, getLaunchOwnerWallets } from './bankr-api';
import { holdsToken } from './holder';
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
  isFounder: boolean;
  verified: boolean;
  allowDeployerEdit: boolean;
  canEditProfile: boolean;
  canPinPosts: boolean;
  holds: boolean;
  balance: number;
  canPost: boolean;
  canReact: boolean;
  /** Fee recipient or deployer with active manage/post privileges (no hold required). */
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
  const isFounder = community?.founderWallet?.toLowerCase() === w;
  const resolvedChain = community?.chain || chain;

  const [isBeneficiary, isDeployer, holdResult] = await Promise.all([
    isTokenBeneficiary(w, token),
    isTokenDeployer(w, token),
    holdsToken(w, token, resolvedChain),
  ]);

  const deployerMayAct = isDeployer && (!verified || allowDeployerEdit);
  const canEditProfile = isBeneficiary || deployerMayAct;
  const canPinPosts = canEditProfile && verified;
  const canPost = holdResult.holds || isBeneficiary || deployerMayAct;
  const canReact = canPost;

  return {
    isBeneficiary,
    isDeployer,
    isFounder,
    verified,
    allowDeployerEdit,
    canEditProfile,
    canPinPosts,
    holds: holdResult.holds,
    balance: holdResult.balance,
    canPost,
    canReact,
    isPrivilegedPoster: isBeneficiary || deployerMayAct,
  };
}

export async function canEditCommunityProfile(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const permissions = await resolveSpacePermissions(wallet, tokenAddress);
  return permissions.canEditProfile;
}

export async function canPinCommunityPosts(
  wallet: string,
  tokenAddress: string
): Promise<boolean> {
  const permissions = await resolveSpacePermissions(wallet, tokenAddress);
  return permissions.canPinPosts;
}
