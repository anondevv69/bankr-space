import { NextResponse } from 'next/server';
import { fetchTokenLaunches } from '@/lib/bankr-api';
import { getLaunches, setLaunches, setSyncUpdatedAt } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const launches = await fetchTokenLaunches();
    const existing = await getLaunches();
    const existingIds = new Set(existing.map((l) => l.activityId));

    let newCount = 0;
    const merged = [...existing];
    for (const launch of launches) {
      if (!existingIds.has(launch.activityId)) {
        merged.unshift(launch);
        existingIds.add(launch.activityId);
        newCount++;
      }
    }

    const sorted = merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    await setLaunches(sorted);
    await setSyncUpdatedAt(Date.now());

    return NextResponse.json({
      ok: true,
      totalLaunches: sorted.length,
      newLaunches: newCount,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('cron sync-tokens', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
