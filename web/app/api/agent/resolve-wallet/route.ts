import { NextResponse } from 'next/server';
import { resolveAgentWallet, resolveBankrTwitterHandle } from '@/lib/bankr-agent-wallet';
import { normalizeAddr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Resolve whether a wallet is a Bankr agent (bankrbot, hermes, etc.).
 * Optional token context improves fee-recipient / deployer handle lookup from launch data.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get('wallet')?.trim();
  const token = searchParams.get('token')?.trim();
  const handle = searchParams.get('handle')?.trim();

  try {
    if (handle && !wallet) {
      const resolved = await resolveBankrTwitterHandle(handle);
      if (!resolved) {
        return NextResponse.json(
          { error: 'Could not resolve handle via Bankr' },
          { status: 404 }
        );
      }
      const agent = await resolveAgentWallet(resolved.wallet, {
        tokenAddress: token || undefined,
        xUsername: handle,
      });
      return NextResponse.json({
        ...agent,
        resolvedAddress: resolved.wallet,
        displayName: resolved.displayName,
      });
    }

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json(
        { error: 'wallet or handle query param required' },
        { status: 400 }
      );
    }

    const agent = await resolveAgentWallet(normalizeAddr(wallet), {
      tokenAddress: token || undefined,
    });

    return NextResponse.json(agent);
  } catch (err) {
    console.error('GET /api/agent/resolve-wallet', err);
    return NextResponse.json({ error: 'Resolve failed' }, { status: 500 });
  }
}
