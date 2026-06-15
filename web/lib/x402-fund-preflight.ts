import { erc20Abi, type Address } from 'viem';
import {
  SPACE_FUND_X402_CREDIT_USD,
  X402_PAYMENT_TOKEN_ADDRESS,
  X402_PAYMENT_TOKEN_SYMBOL,
} from '@/lib/x402-config';
import { createEvmPaymentSigner } from '@/lib/x402-signer';
import { PERMIT2_ADDRESS } from '@/lib/x402-permit2-allowance';
import {
  fetchSpacePriceUsd,
  formatX402FundPriceLabel,
} from '@/lib/space-x402-price';

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Block signing when balance cannot cover the fixed exact x402 charge. */
export async function assertSpaceFundPreflight(
  walletAddress: Address,
  amountUsd: number,
  authorizeAtomic: bigint
): Promise<void> {
  const priceUsd = await fetchSpacePriceUsd();
  const priceLabel = formatX402FundPriceLabel(priceUsd, amountUsd);
  const chargeTokens = Number(authorizeAtomic) / 1e18;

  const { publicClient } = createEvmPaymentSigner(walletAddress);
  const raw = await publicClient.readContract({
    address: X402_PAYMENT_TOKEN_ADDRESS as Address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [walletAddress],
  });
  const balanceAtomic = BigInt(raw);

  if (balanceAtomic < authorizeAtomic) {
    const balanceTokens = Number(balanceAtomic) / 1e18;
    const balanceLabel =
      balanceTokens <= 0
        ? '0'
        : balanceTokens < 0.01
          ? balanceTokens.toExponential(2)
          : formatTokenCount(balanceTokens);
    throw new Error(
      `Insufficient $${X402_PAYMENT_TOKEN_SYMBOL} — need ${priceLabel} (${formatTokenCount(chargeTokens)} tokens) but your wallet has ${balanceLabel}. ` +
        `Buy $${X402_PAYMENT_TOKEN_SYMBOL} on Base, then try Contribute again.`
    );
  }

  const allowanceRaw = await publicClient.readContract({
    address: X402_PAYMENT_TOKEN_ADDRESS as Address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [walletAddress, PERMIT2_ADDRESS],
  });
  if (BigInt(allowanceRaw) < authorizeAtomic) {
    throw new Error(
      `Permit2 is not approved for $${X402_PAYMENT_TOKEN_SYMBOL} — when prompted, confirm the approval transaction in MetaMask first, then click Contribute again.`
    );
  }
}

export { SPACE_FUND_X402_CREDIT_USD };
