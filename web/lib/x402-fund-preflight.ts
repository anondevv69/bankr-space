import { erc20Abi, type Address } from 'viem';
import {
  SPACE_FUND_X402_CREDIT_USD,
  X402_PAYMENT_TOKEN_ADDRESS,
  X402_PAYMENT_TOKEN_SYMBOL,
} from '@/lib/x402-config';
import { createEvmPaymentSigner } from '@/lib/x402-signer';
import {
  fetchSpacePriceUsd,
  formatX402FundPriceLabel,
  spaceAtomicForUsd,
  spaceTokensForUsd,
} from '@/lib/space-x402-price';

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Block signing when balance or x402 authorize cap cannot cover the USD credit. */
export async function assertSpaceFundPreflight(
  walletAddress: Address,
  amountUsd: number,
  authorizeAtomic: bigint
): Promise<void> {
  const priceUsd = await fetchSpacePriceUsd();
  if (!priceUsd || priceUsd <= 0) return;

  const neededAtomic = spaceAtomicForUsd(amountUsd, priceUsd);
  const neededTokens = spaceTokensForUsd(amountUsd, priceUsd);
  const capTokens = Number(authorizeAtomic) / 1e18;
  const priceLabel = formatX402FundPriceLabel(priceUsd, amountUsd);

  if (neededAtomic > authorizeAtomic) {
    throw new Error(
      `Space price is too low for $${amountUsd} per click — ${priceLabel} but the x402 authorize cap is ~${formatTokenCount(capTokens)} $${X402_PAYMENT_TOKEN_SYMBOL}. ` +
        `Raise price in bankr.x402.json and run bankr x402 deploy.`
    );
  }

  const { publicClient } = createEvmPaymentSigner(walletAddress);
  const raw = await publicClient.readContract({
    address: X402_PAYMENT_TOKEN_ADDRESS as Address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [walletAddress],
  });
  const balanceAtomic = BigInt(raw);

  if (balanceAtomic < neededAtomic) {
    const balanceTokens = Number(balanceAtomic) / 1e18;
    const balanceLabel =
      balanceTokens <= 0
        ? '0'
        : balanceTokens < 0.01
          ? balanceTokens.toExponential(2)
          : formatTokenCount(balanceTokens);
    throw new Error(
      `Insufficient $${X402_PAYMENT_TOKEN_SYMBOL} — need ${priceLabel} (~${formatTokenCount(neededTokens)} tokens) but your wallet has ${balanceLabel}. ` +
        `Buy $${X402_PAYMENT_TOKEN_SYMBOL} on Base, then try Contribute again.`
    );
  }
}

export { SPACE_FUND_X402_CREDIT_USD };
