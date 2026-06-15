'use client';

import { createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { createBaseHttpTransport } from '@/lib/base-rpc';

export const config = createConfig({
  chains: [base],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [base.id]: createBaseHttpTransport(),
  },
  ssr: true,
});

export async function apiFetch(
  url: string,
  options: RequestInit & {
    wallet?: string | null;
    client?: 'web' | 'bankr-app' | 'agent' | 'api';
  } = {}
) {
  const { wallet, client, ...init } = options;
  const headers = new Headers(init.headers);
  if (wallet) headers.set('x-wallet-address', wallet);
  if (client) headers.set('x-client', client);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
