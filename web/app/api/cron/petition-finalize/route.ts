import { NextResponse } from 'next/server';
import { finalizeAllPendingPetitions } from '@/lib/petition-finalize';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await finalizeAllPendingPetitions();
    return NextResponse.json({
      ok: true,
      ...result,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('cron petition-finalize', err);
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
