import { NextResponse } from 'next/server';
import { verifyAllAgentPools } from '@/lib/agent-pool-verify';

export const dynamic = 'force-dynamic';

/**
 * Link funded 0xWork pool goals to 0xWork tasks + refresh task status.
 * Vercel cron — Bearer CRON_SECRET.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await verifyAllAgentPools();
    return NextResponse.json({
      ok: true,
      ...result,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('cron agent-pool-verify', err);
    return NextResponse.json({ error: 'Verify failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
