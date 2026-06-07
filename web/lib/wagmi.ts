'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Bankr Communities',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '00000000000000000000000000000000',
  chains: [base],
  ssr: true,
});

export async function apiFetch(
  url: string,
  options: RequestInit & { wallet?: string | null } = {}
) {
  const { wallet, ...init } = options;
  const headers = new Headers(init.headers);
  if (wallet) headers.set('x-wallet-address', wallet);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
