import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  parseEventLogs,
  type Address,
  type Hash,
} from 'viem';
import { base } from 'viem/chains';
import { USDC_BASE_ADDRESS } from './usdc-base';

const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL?.trim() || undefined),
});

export type VerifyUsdcTransferInput = {
  txHash: Hash;
  from: Address;
  to: Address;
  minAmountUsd: number;
};

export type VerifyUsdcTransferResult =
  | { ok: true; amountUsd: number }
  | { ok: false; error: string };

export async function verifyUsdcTransfer(
  input: VerifyUsdcTransferInput
): Promise<VerifyUsdcTransferResult> {
  if (!Number.isFinite(input.minAmountUsd) || input.minAmountUsd <= 0) {
    return { ok: false, error: 'Invalid amount' };
  }

  let receipt;
  try {
    receipt = await baseClient.getTransactionReceipt({ hash: input.txHash });
  } catch {
    return { ok: false, error: 'Transaction not found on Base' };
  }

  if (receipt.status !== 'success') {
    return { ok: false, error: 'Transaction failed on-chain' };
  }

  const transfers = parseEventLogs({
    abi: erc20Abi,
    eventName: 'Transfer',
    logs: receipt.logs,
  }).filter(
    (log) => log.address.toLowerCase() === USDC_BASE_ADDRESS.toLowerCase()
  );

  const expectedFrom = input.from.toLowerCase();
  const expectedTo = input.to.toLowerCase();
  const minUnits = BigInt(Math.round(input.minAmountUsd * 1_000_000));

  for (const log of transfers) {
    const from = String(log.args.from || '').toLowerCase();
    const to = String(log.args.to || '').toLowerCase();
    const value = log.args.value as bigint | undefined;
    if (!value || from !== expectedFrom || to !== expectedTo) continue;
    if (value < minUnits) continue;

    const amountUsd = Number(formatUnits(value, 6));
    return { ok: true, amountUsd };
  }

  return { ok: false, error: 'No matching USDC transfer to the space beneficiary' };
}
