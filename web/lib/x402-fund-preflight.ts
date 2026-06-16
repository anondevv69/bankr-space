import { erc20Abi, type Address } from 'viem';
import { formatRpcRateLimitError, isRpcRateLimitError } from '@/lib/base-rpc';
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
  authorizeAtomic: bigint,
  overrideTokenAddress?: Address
): Promise<void> {
  const priceUsd = await fetchSpacePriceUsd();
  const priceLabel = formatX402FundPriceLabel(priceUsd, amountUsd);
  const chargeTokens = Number(authorizeAtomic) / 1e18;

  const token = (overrideTokenAddress || X402_PAYMENT_TOKEN_ADDRESS) as Address;
  const { publicClient } = createEvmPaymentSigner(walletAddress);

  let balanceAtomic: bigint;
  let allowanceRaw: bigint;
  try {
    const [balanceResult, allowanceResult] = await publicClient.multicall({
      contracts: [
        {
          address: token,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [walletAddress],
        },
        {
          address: token,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [walletAddress, PERMIT2_ADDRESS],
        },
      ],
    });
    if (balanceResult.status !== 'success' || allowanceResult.status !== 'success') {
      throw new Error('Failed to read $Space balance on Base');
    }
    balanceAtomic = balanceResult.result;
    allowanceRaw = allowanceResult.result;
  } catch (err) {
    if (isRpcRateLimitError(err)) {
      throw new Error(formatRpcRateLimitError());
    }
    throw err;
  }

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

  if (allowanceRaw < authorizeAtomic) {
    throw new Error(
      `Permit2 is not approved for $${X402_PAYMENT_TOKEN_SYMBOL} yet. Click Contribute again — MetaMask will ask for a one-time approve transaction first (costs a little Base ETH for gas), then the payment signature.`
    );
  }
}

export { SPACE_FUND_X402_CREDIT_USD };
