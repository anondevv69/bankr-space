import { NextResponse } from 'next/server';
import { getCommunities, setCommunities } from '@/lib/db';
import { syncCommunityProfile } from '@/lib/community-profile-sync';
import {
  isBankrProjectSyncEnabled,
  syncCommunityToBankrProfile,
} from '@/lib/bankr-project-sync';

export const dynamic = 'force-dynamic';

const MIN_SYNC_INTERVAL_MS = 30 * 60 * 1000;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const communities = await getCommunities();
    const now = Date.now();
    let attempted = 0;
    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < communities.length; i++) {
      const community = communities[i];
      if (!isBankrProjectSyncEnabled(community) || !community.bankrProject?.syncProfile) {
        skipped++;
        continue;
      }

      const last = community.bankrProject?.lastSyncedAt || 0;
      if (last > 0 && now - last < MIN_SYNC_INTERVAL_MS) {
        skipped++;
        continue;
      }

      attempted++;
      let working = await syncCommunityProfile(community, { force: false });
      const result = await syncCommunityToBankrProfile(working);
      communities[i] = result.community;
      if (result.profile) {
        synced++;
      } else if (result.error) {
        errors++;
      }
    }

    await setCommunities(communities);

    return NextResponse.json({
      ok: true,
      attempted,
      synced,
      skipped,
      errors,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('cron bankr-project-sync', err);
    return NextResponse.json({ error: 'Bankr project sync failed' }, { status: 500 });
  }
}
