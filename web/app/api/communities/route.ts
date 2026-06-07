import { NextResponse } from 'next/server';
import { getCommunities, getSyncUpdatedAt } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [communities, syncAt] = await Promise.all([
      getCommunities(),
      getSyncUpdatedAt(),
    ]);
    return NextResponse.json({ communities, syncUpdatedAt: syncAt });
  } catch (err) {
    console.error('GET /api/communities', err);
    return NextResponse.json(
      { error: 'Database not configured. Connect Vercel KV — see web/DEPLOY.md' },
      { status: 503 }
    );
  }
}
