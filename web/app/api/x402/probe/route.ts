/**
 * POST /api/x402/probe
 * Hit a Bankr x402 fund URL, parse the 402 Payment Required response,
 * and return the accepted token address + amount so the UI can auto-fill.
 *
 * Body: { fundUrl: string }
 * Response: { tokenAddress, amountAtomic, decimals, symbol, priceLabel }
 */
import { NextResponse } from 'next/server';
import { createPublicClient, http, erc20Abi, type Address } from 'viem';
import { base } from 'viem/chains';

export const dynamic = 'force-dynamic';

const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

function extractTokenFromAccepts(data: unknown): { asset: string; amount: string } | null {
  if (!data || typeof data !== 'object') return null;
  const body = data as Record<string, unknown>;

  // Direct accepts array
  const accepts = Array.isArray(body.accepts) ? body.accepts : null;
  if (accepts) {
    const first = accepts.find(
      (item: unknown) =>
        item &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).asset === 'string'
    ) as Record<string, unknown> | undefined;
    if (first) return { asset: first.asset as string, amount: String(first.amount || '0') };
  }

  // Wrapped in paymentRequiredHeader (base64 JSON)
  if (typeof body.paymentRequiredHeader === 'string') {
    try {
      const decoded = JSON.parse(atob(body.paymentRequiredHeader)) as Record<string, unknown>;
      const inner = Array.isArray(decoded.accepts) ? decoded.accepts : null;
      if (inner) {
        const first = inner.find(
          (item: unknown) =>
            item &&
            typeof item === 'object' &&
            typeof (item as Record<string, unknown>).asset === 'string'
        ) as Record<string, unknown> | undefined;
        if (first) return { asset: first.asset as string, amount: String(first.amount || '0') };
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export async function POST(req: Request) {
  let body: { fundUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const raw = typeof body.fundUrl === 'string' ? body.fundUrl.trim() : '';
  if (!raw.startsWith('http')) {
    return NextResponse.json({ error: 'fundUrl must be a valid URL' }, { status: 400 });
  }

  // Strip query params — we want the bare fund base
  let fundUrl: string;
  try {
    const u = new URL(raw);
    fundUrl = `${u.origin}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Hit the endpoint — expect 402 (no payment header)
  let upstream: Response;
  let responseData: unknown;
  try {
    upstream = await fetch(fundUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const text = await upstream.text();
    try {
      responseData = text ? JSON.parse(text) : {};
    } catch {
      responseData = {};
    }
  } catch {
    return NextResponse.json(
      { error: 'Could not reach fund URL — check it is correct and publicly accessible' },
      { status: 502 }
    );
  }

  if (upstream.status !== 402 && upstream.status !== 200) {
    return NextResponse.json(
      { error: `Fund URL returned ${upstream.status} — expected 402 Payment Required` },
      { status: 400 }
    );
  }

  const tokenInfo = extractTokenFromAccepts(responseData);
  if (!tokenInfo) {
    return NextResponse.json(
      { error: 'Could not parse token info from x402 response — is this a valid Bankr x402 fund URL?' },
      { status: 400 }
    );
  }

  const tokenAddress = tokenInfo.asset.toLowerCase();
  const amountAtomic = tokenInfo.amount;

  // Fetch symbol + decimals from the ERC-20 contract on Base
  let symbol = '';
  let decimals = 18;
  try {
    const client = createPublicClient({ chain: base, transport: http(BASE_RPC) });
    const [sym, dec] = await Promise.all([
      client.readContract({
        address: tokenAddress as Address,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
      client.readContract({
        address: tokenAddress as Address,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
    ]);
    symbol = String(sym);
    decimals = Number(dec);
  } catch {
    // Non-critical — UI can let user fill in manually
  }

  // Compute human-readable token amount for price label
  let priceLabel = '';
  try {
    const atomicBig = BigInt(amountAtomic);
    const divisor = BigInt(10 ** decimals);
    const whole = atomicBig / divisor;
    const fraction = atomicBig % divisor;
    const humanAmount =
      fraction === 0n
        ? whole.toLocaleString()
        : Number(atomicBig) / 10 ** decimals < 1
          ? (Number(atomicBig) / 10 ** decimals).toPrecision(4)
          : Number(atomicBig / (divisor / 1000n)) / 1000 < 1000
            ? (Number(atomicBig) / 10 ** decimals).toFixed(2)
            : whole.toLocaleString();
    if (symbol) priceLabel = `${humanAmount} $${symbol} (~$1)`;
  } catch {
    // ignore
  }

  return NextResponse.json({
    tokenAddress,
    amountAtomic,
    decimals,
    symbol,
    priceLabel,
    fundUrl,
  });
}
