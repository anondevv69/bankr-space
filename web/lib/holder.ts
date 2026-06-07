import { createPublicClient, http, erc20Abi } from 'viem';
import { base } from 'viem/chains';

const baseClient = createPublicClient({
  chain: base,
  transport: http(),
});

function getClient(_chain: string) {
  return baseClient;
}

export async function getTokenBalance(
  wallet: string,
  tokenAddress: string,
  chain = 'base'
): Promise<number> {
  const client = getClient(chain);
  try {
    const raw = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [wallet as `0x${string}`],
    });
    const rawBalance = BigInt(raw);
    if (rawBalance === BigInt(0)) return 0;
    const asDecimal = Number(rawBalance) / 1e18;
    return asDecimal < 0.000001 ? Number(rawBalance) : asDecimal;
  } catch {
    return 0;
  }
}

export async function holdsToken(
  wallet: string,
  tokenAddress: string,
  chain = 'base'
): Promise<{ holds: boolean; balance: number }> {
  const balance = await getTokenBalance(wallet, tokenAddress, chain);
  return { holds: balance > 0, balance };
}
