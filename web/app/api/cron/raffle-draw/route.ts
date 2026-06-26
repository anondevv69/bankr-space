import { NextResponse } from 'next/server';
import { processExpiredRaffles } from '@/lib/community-raffles';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processExpiredRaffles();
    return NextResponse.json({
      ok: true,
      ...result,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('cron raffle-draw', err);
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
