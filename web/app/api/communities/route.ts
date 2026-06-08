import { NextResponse } from 'next/server';
import { getCommunities, getLaunches, getSyncUpdatedAt } from '@/lib/db';
import { enrichCommunitiesWithImages } from '@/lib/community-image';
import { mergeCommunityDefaults } from '@/lib/community-posts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [communities, launches, syncAt] = await Promise.all([
      getCommunities(),
      getLaunches(),
      getSyncUpdatedAt(),
    ]);
    const normalized = communities.map(mergeCommunityDefaults);
    const enriched = await enrichCommunitiesWithImages(normalized, launches);
    return NextResponse.json({ communities: enriched, syncUpdatedAt: syncAt });
  } catch (err) {
    console.error('GET /api/communities', err);
    return NextResponse.json(
      { error: 'Database not configured. Connect Vercel KV — see web/DEPLOY.md' },
      { status: 503 }
    );
  }
}
