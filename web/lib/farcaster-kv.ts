/**
 * KV storage for Farcaster ↔ wallet linking.
 *
 * Keys:
 *   fc:link:wallet:{wallet}  → FarcasterLink
 *   fc:link:fid:{fid}        → FarcasterLink
 */
import { kvGet, kvSet } from '@/lib/kv-store';

export type FarcasterLink = {
  fid: number;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  wallet: string;
  linkedAt: number;
};

export async function getFarcasterLinkByWallet(
  wallet: string
): Promise<FarcasterLink | null> {
  return kvGet<FarcasterLink>(`fc:link:wallet:${wallet.toLowerCase()}`);
}

export async function getFarcasterLinkByFid(
  fid: number
): Promise<FarcasterLink | null> {
  return kvGet<FarcasterLink>(`fc:link:fid:${fid}`);
}

export async function setFarcasterLink(
  wallet: string,
  fid: number,
  username: string | null,
  displayName: string | null,
  pfpUrl: string | null
): Promise<void> {
  const normalizedWallet = wallet.toLowerCase();

  // Remove old link for this wallet if pointing to a different fid
  const existingByWallet = await getFarcasterLinkByWallet(normalizedWallet);
  if (existingByWallet && existingByWallet.fid !== fid) {
    await kvSet(`fc:link:fid:${existingByWallet.fid}`, null);
  }

  // Remove old link for this fid if pointing to a different wallet
  const existingByFid = await getFarcasterLinkByFid(fid);
  if (existingByFid && existingByFid.wallet !== normalizedWallet) {
    await kvSet(`fc:link:wallet:${existingByFid.wallet}`, null);
  }

  const link: FarcasterLink = {
    fid,
    username,
    displayName,
    pfpUrl,
    wallet: normalizedWallet,
    linkedAt: Date.now(),
  };

  await kvSet(`fc:link:wallet:${normalizedWallet}`, link);
  await kvSet(`fc:link:fid:${fid}`, link);
}

export async function removeFarcasterLinkByWallet(wallet: string): Promise<void> {
  const link = await getFarcasterLinkByWallet(wallet.toLowerCase());
  if (!link) return;
  await kvSet(`fc:link:wallet:${link.wallet}`, null);
  await kvSet(`fc:link:fid:${link.fid}`, null);
}
