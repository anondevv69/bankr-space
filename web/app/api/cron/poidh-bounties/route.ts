import { NextResponse } from 'next/server';
import { spinUpAllPoidhBounties } from '@/lib/poidh-bounty-spinup';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Creates pending POIDH open bounties via Bankr agent (no x402). */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await spinUpAllPoidhBounties();
    return NextResponse.json({
      ok: true,
      ...result,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('cron poidh-bounties', err);
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
