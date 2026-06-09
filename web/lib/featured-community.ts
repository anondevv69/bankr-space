/** Bankr Space native token — always pinned first on the home grid. */
export const NATIVE_SPACE_TOKEN_ADDRESS =
  '0xef703b860a6d422fa00cc67bbbb2662297cb6ba3';

export function isNativeSpaceCommunity(tokenAddress: string): boolean {
  return tokenAddress.toLowerCase() === NATIVE_SPACE_TOKEN_ADDRESS.toLowerCase();
}
