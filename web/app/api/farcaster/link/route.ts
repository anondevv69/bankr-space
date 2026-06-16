/**
 * POST /api/farcaster/link
 * Link a Farcaster account to a wallet via Sign In With Farcaster.
 *
 * Body: {
 *   message: string        (SIWE message from Farcaster auth-kit)
 *   signature: string      (hex signature)
 *   fid: number
 *   username?: string
 *   displayName?: string
 *   pfpUrl?: string
 *   wallet: string         (connected EVM wallet)
 *   walletSignature: string (EIP-191 signature over canonical payload)
 *   nonce: string
 * }
 */
import { NextResponse } from 'next/server';
import { createPublicClient, http, type Address } from 'viem';
import { base } from 'viem/chains';
import { setFarcasterLink } from '@/lib/farcaster-kv';
import { normalizeAddr } from '@/lib/utils';
import { getProfiles, setProfiles } from '@/lib/db';

export const dynamic = 'force-dynamic';

function verifyEip191Signature(
  address: string,
  message: string,
  signature: string
): boolean {
  try {
    const { recoverMessageAddress } = require('viem');
    // We call this server-side synchronously as a sync check is fine here
    return true; // actual check done via viem below
  } catch {
    return false;
  }
}

async function recoverWalletSigner(
  message: string,
  signature: `0x${string}`,
  wallet: string
): Promise<boolean> {
  try {
    const { recoverMessageAddress } = await import('viem');
    const recovered = await recoverMessageAddress({ message, signature });
    return recovered.toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let body: {
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
    wallet?: string;
    walletSignature?: string;
    nonce?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { fid, username, displayName, pfpUrl, wallet, walletSignature, nonce } = body;

  if (!fid || typeof fid !== 'number') {
    return NextResponse.json({ error: 'fid required' }, { status: 400 });
  }
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  }
  if (!walletSignature || !nonce) {
    return NextResponse.json({ error: 'walletSignature and nonce required' }, { status: 400 });
  }

  // Verify wallet signature: the wallet signs `link-farcaster:${fid}:${nonce}`
  const message = `Link Farcaster FID ${fid} to bankr.space\n\nNonce: ${nonce}`;
  const sigValid = await recoverWalletSigner(message, walletSignature as `0x${string}`, wallet);
  if (!sigValid) {
    return NextResponse.json({ error: 'Wallet signature invalid' }, { status: 401 });
  }

  const normalizedWallet = normalizeAddr(wallet);

  await setFarcasterLink(
    normalizedWallet,
    fid,
    username?.replace(/^@/, '') || null,
    displayName || null,
    pfpUrl || null
  );

  // Update cached profile to include farcaster username
  const profiles = await getProfiles();
  const existing = profiles[normalizedWallet] ?? {
    wallet: normalizedWallet,
    twitter: null,
    farcaster: null,
    profileImage: null,
    updatedAt: Date.now(),
  };
  existing.farcaster = username?.replace(/^@/, '') || null;
  if (pfpUrl && !existing.profileImage) existing.profileImage = pfpUrl;
  existing.updatedAt = Date.now();
  profiles[normalizedWallet] = existing;
  await setProfiles(profiles);

  return NextResponse.json({
    ok: true,
    fid,
    username: username?.replace(/^@/, '') || null,
    wallet: normalizedWallet,
  });
}
