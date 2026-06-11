/** Human-readable ETH amounts — never scientific notation. */
export function formatEthFromWei(wei: string | null | undefined): string | null {
  if (wei == null || wei === '') return null;
  try {
    const eth = Number(BigInt(wei)) / 1e18;
    if (!Number.isFinite(eth) || eth < 0) return null;
    return formatEthAmount(eth);
  } catch {
    return null;
  }
}

export function formatEthAmount(eth: number): string {
  if (!Number.isFinite(eth) || eth < 0) return '0 ETH';
  if (eth === 0) return '0 ETH';
  if (eth < 0.000001) return `${eth.toFixed(8)} ETH`;
  if (eth < 0.0001) return `${eth.toFixed(6)} ETH`;
  if (eth < 0.001) return `${eth.toFixed(4)} ETH`;
  if (eth < 1) return `${eth.toFixed(3)} ETH`;
  return `${eth.toFixed(3)} ETH`;
}

export function formatEthPoolLabel(wei: string | null | undefined): string | null {
  const eth = formatEthFromWei(wei);
  if (!eth) return null;
  return `${eth} pool`;
}
