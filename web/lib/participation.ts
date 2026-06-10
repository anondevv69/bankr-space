import { resolveSpacePermissions } from './community-owner';
import { normalizeAddr } from './utils';

export type ParticipationStatus = {
  holds: boolean;
  balance: number;
  isOwner: boolean;
  canPost: boolean;
  canReact: boolean;
};

export async function checkParticipation(
  wallet: string,
  tokenAddress: string,
  chain = 'base'
): Promise<ParticipationStatus> {
  const permissions = await resolveSpacePermissions(
    wallet.toLowerCase(),
    normalizeAddr(tokenAddress),
    chain
  );

  return {
    holds: permissions.holds,
    balance: permissions.balance,
    isOwner: permissions.isPrivilegedPoster,
    canPost: permissions.canPost,
    canReact: permissions.canReact,
  };
}
