import { NextResponse } from 'next/server';
import { getCommunities, setCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import { AGENT_POOL_SKILL_IDS, readStoredAgentPool } from '@/lib/agent-pool';
import { normalizeAddr } from '@/lib/utils';
import type { AgentPoolSkillId } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Platform worker marks a community agent pool skill as executed (CRON_SECRET).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: {
    tokenAddress?: string;
    skillId?: string;
    note?: string;
    executionNote?: string;
    txHash?: string;
    oxworkTaskId?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tokenAddress = normalizeAddr(String(body.tokenAddress || ''));
  const skillId = String(body.skillId || '').toLowerCase() as AgentPoolSkillId;
  const rawNote = body.executionNote ?? body.note;
  const note = rawNote ? String(rawNote).slice(0, 500) : null;
  const txHash = body.txHash ? String(body.txHash).slice(0, 66) : null;
  const oxworkTaskId =
    body.oxworkTaskId != null && Number.isFinite(Number(body.oxworkTaskId))
      ? Number(body.oxworkTaskId)
      : null;
  const executionNote = note;

  if (!AGENT_POOL_SKILL_IDS.includes(skillId)) {
    return NextResponse.json({ error: 'Invalid skillId' }, { status: 400 });
  }

  try {
    const communities = await getCommunities();
    const index = communities.findIndex(
      (c) => c.tokenAddress.toLowerCase() === tokenAddress
    );
    if (index === -1) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const current = mergeCommunityDefaults(communities[index]);
    const pool = readStoredAgentPool(current.agentPool);
    const updatedPool = {
      ...pool,
      campaigns: pool.campaigns.map((c) =>
        c.skillId === skillId
          ? {
              ...c,
              executedAt: Date.now(),
              executionNote,
              executionTxHash: txHash ?? c.executionTxHash ?? null,
              oxworkTaskId: oxworkTaskId ?? c.oxworkTaskId ?? null,
              jobLinkedAt: oxworkTaskId != null ? c.jobLinkedAt ?? Date.now() : c.jobLinkedAt,
            }
          : c
      ),
    };

    communities[index] = mergeCommunityDefaults({
      ...current,
      agentPool: updatedPool,
    });
    await setCommunities(communities);

    return NextResponse.json({ success: true, tokenAddress, skillId });
  } catch (err) {
    console.error('POST pool-executed', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
