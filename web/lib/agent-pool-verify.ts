import { getCommunities, setCommunities } from '@/lib/db';
import { mergeCommunityDefaults } from '@/lib/community-posts';
import {
  isAgentPoolCampaignFunded,
  readStoredAgentPool,
} from '@/lib/agent-pool';
import { createPlatformAgentPost } from '@/lib/agent-pool-feed';
import { markAgentPoolExecuted } from '@/lib/mark-pool-executed';
import { fetchOxWorkTasksForSpace, type OxWorkTask } from '@/lib/oxwork-api';
import { oxWorkTaskUrl } from '@/lib/oxwork-api';
import { fetchPoidhBountiesForSpace, poidhBountyUrl, type PoidhBounty } from '@/lib/poidh-api';
import { getPlatformAgentWallet } from '@/lib/platform-agent';
import { communityUrl } from '@/lib/site-url';
import type { AgentPoolCampaign, Community } from '@/lib/types';
import { normalizeAddr } from '@/lib/utils';

export type AgentPoolVerifyResult = {
  spacesChecked: number;
  campaignsChecked: number;
  tasksLinked: number;
  statusesUpdated: number;
  fundedAtBackfilled: number;
  finalized: number;
};

function taskCreatedMs(task: OxWorkTask): number {
  const t = new Date(task.created_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Pick best 0xWork task for a funded campaign (newest matching task after fund time). */
export function pickOxWorkTaskForCampaign(
  tasks: OxWorkTask[],
  campaign: AgentPoolCampaign,
  symbol: string,
  tokenAddress: string
): OxWorkTask | null {
  if (campaign.skillId !== '0xwork' || !isAgentPoolCampaignFunded(campaign)) return null;

  const since =
    campaign.fundedAt ??
    campaign.proposedAt ??
    0;
  const sinceMs = Number(since) || 0;
  const sym = symbol.toLowerCase().replace(/^\$/, '');
  const token = tokenAddress.toLowerCase();

  const candidates = tasks
    .filter((task) => {
      const hay = `${task.title || ''} ${task.description}`.toLowerCase();
      const matchesSpace =
        hay.includes(sym) ||
        hay.includes(token) ||
        hay.includes(`$${sym}`) ||
        hay.includes(`bankr.space/community/${token}`);
      if (!matchesSpace) return false;
      if (sinceMs > 0 && taskCreatedMs(task) < sinceMs - 60_000) return false;
      return true;
    })
    .sort((a, b) => taskCreatedMs(b) - taskCreatedMs(a));

  return candidates[0] ?? null;
}

export function pickPoidhBountyForCampaign(
  bounties: PoidhBounty[],
  campaign: AgentPoolCampaign,
  symbol: string,
  tokenAddress: string
): PoidhBounty | null {
  if (campaign.skillId !== 'poidh' || !isAgentPoolCampaignFunded(campaign)) return null;

  const sinceSec =
    (campaign.fundedAt ?? campaign.proposedAt ?? 0) > 1e12
      ? Math.floor((campaign.fundedAt ?? campaign.proposedAt ?? 0) / 1000)
      : Math.floor((campaign.fundedAt ?? campaign.proposedAt ?? 0) / 1000);
  const sym = symbol.toLowerCase().replace(/^\$/, '');
  const token = tokenAddress.toLowerCase();

  const candidates = bounties
    .filter((bounty) => {
      const hay = `${bounty.name} ${bounty.description}`.toLowerCase();
      const matchesSpace =
        hay.includes(sym) ||
        hay.includes(token) ||
        hay.includes(`$${sym}`) ||
        hay.includes(`bankr.space/community/${token}`);
      if (!matchesSpace) return false;
      if (sinceSec > 0 && bounty.createdAt < sinceSec - 120) return false;
      return bounty.active;
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  return candidates[0] ?? null;
}

function patchCampaignFromPoidhBounty(
  campaign: AgentPoolCampaign,
  bounty: PoidhBounty
): AgentPoolCampaign {
  if (campaign.poidhBountyId === bounty.id) return campaign;
  return {
    ...campaign,
    poidhBountyId: bounty.id,
    jobLinkedAt: campaign.jobLinkedAt ?? Date.now(),
  };
}

function patchCampaignFromTask(
  campaign: AgentPoolCampaign,
  task: OxWorkTask
): AgentPoolCampaign {
  const linked = campaign.oxworkTaskId === task.id;
  const statusChanged = campaign.oxworkTaskStatus !== task.status;
  if (linked && !statusChanged) return campaign;

  return {
    ...campaign,
    oxworkTaskId: task.id,
    oxworkTaskStatus: task.status,
    jobLinkedAt: campaign.jobLinkedAt ?? Date.now(),
  };
}

export async function verifyAgentPoolForCommunity(
  community: Community,
  options?: { persist?: boolean }
): Promise<{
  community: Community;
  linked: number;
  statusUpdates: number;
  fundedAtBackfilled: number;
  finalized: number;
}> {
  const merged = mergeCommunityDefaults(community);
  if (!merged.usePlatformAgent || !merged.verified) {
    return { community: merged, linked: 0, statusUpdates: 0, fundedAtBackfilled: 0, finalized: 0 };
  }

  const pool = readStoredAgentPool(merged.agentPool);
  const platformWallet = getPlatformAgentWallet();
  const posters = [platformWallet, merged.ownerWallet].filter(
    (w): w is string => !!w && w.startsWith('0x')
  );

  let oxTasks: OxWorkTask[] = [];
  let poidhBounties: PoidhBounty[] = [];
  const needsOxWork = pool.campaigns.some(
    (c) =>
      c.skillId === '0xwork' &&
      c.enabled &&
      isAgentPoolCampaignFunded(c) &&
      (!c.oxworkTaskId || !c.executedAt)
  );

  if (needsOxWork && posters.length) {
    const fetched = await fetchOxWorkTasksForSpace({
      posterWallets: posters,
      symbol: merged.symbol,
      tokenAddress: merged.tokenAddress,
      includeAllStatuses: true,
    });
    oxTasks = fetched.tasks;
  }

  const needsPoidh = pool.campaigns.some(
    (c) =>
      c.skillId === 'poidh' &&
      c.enabled &&
      isAgentPoolCampaignFunded(c) &&
      (!c.poidhBountyId || !c.executedAt)
  );

  if (needsPoidh && posters.length) {
    const fetched = await fetchPoidhBountiesForSpace({
      issuerWallets: posters,
      symbol: merged.symbol,
      tokenAddress: merged.tokenAddress,
    });
    poidhBounties = fetched.bounties;
  }

  let linked = 0;
  let statusUpdates = 0;
  let fundedAtBackfilled = 0;
  const now = Date.now();

  const campaigns = pool.campaigns.map((campaign) => {
    let next = { ...campaign };

    if (
      isAgentPoolCampaignFunded(next) &&
      next.fundedAt == null
    ) {
      next = { ...next, fundedAt: next.proposedAt ?? now };
      fundedAtBackfilled += 1;
    }

    if (next.skillId === '0xwork' && isAgentPoolCampaignFunded(next) && !next.oxworkTaskId) {
      const task = pickOxWorkTaskForCampaign(
        oxTasks,
        next,
        merged.symbol,
        merged.tokenAddress
      );
      if (task) {
        next = patchCampaignFromTask(next, task);
        linked += 1;
      }
    } else if (next.skillId === 'poidh' && isAgentPoolCampaignFunded(next) && !next.poidhBountyId) {
      const bounty = pickPoidhBountyForCampaign(
        poidhBounties,
        next,
        merged.symbol,
        merged.tokenAddress
      );
      if (bounty) {
        next = patchCampaignFromPoidhBounty(next, bounty);
        linked += 1;
      }
    } else if (next.oxworkTaskId != null && next.skillId === '0xwork') {
      const task = oxTasks.find((t) => t.id === next.oxworkTaskId);
      if (task && task.status !== next.oxworkTaskStatus) {
        next = { ...next, oxworkTaskStatus: task.status };
        statusUpdates += 1;
      }
    }

    return next;
  });

  const changed =
    linked > 0 ||
    statusUpdates > 0 ||
    fundedAtBackfilled > 0 ||
    JSON.stringify(campaigns) !== JSON.stringify(pool.campaigns);

  let updated = mergeCommunityDefaults({
    ...merged,
    agentPool: { ...pool, campaigns },
  });

  if (options?.persist !== false && changed) {
    const communities = await getCommunities();
    const index = communities.findIndex(
      (c) => c.tokenAddress.toLowerCase() === normalizeAddr(merged.tokenAddress)
    );
    if (index !== -1) {
      communities[index] = updated;
      await setCommunities(communities);
    }
  }

  let finalized = 0;
  const afterPool = readStoredAgentPool(updated.agentPool);
  for (const campaign of afterPool.campaigns) {
    if (!isAgentPoolCampaignFunded(campaign) || campaign.executedAt) continue;

    if (campaign.skillId === '0xwork' && campaign.oxworkTaskId != null) {
      const taskUrl = oxWorkTaskUrl(campaign.oxworkTaskId);
      const note = `0xWork task posted — ${taskUrl}`;
      await createPlatformAgentPost(
        updated.tokenAddress,
        [
          `$${updated.symbol} — community agent pool: ${campaign.label}`,
          `Raised $${campaign.raisedUsd} / $${campaign.goalUsd} USDC — 0xJob live.`,
          `0xJob: ${taskUrl}`,
          communityUrl(updated.tokenAddress),
        ].join('\n')
      ).catch(() => undefined);

      await markAgentPoolExecuted({
        tokenAddress: updated.tokenAddress,
        skillId: '0xwork',
        executionNote: note,
        oxworkTaskId: campaign.oxworkTaskId,
      });
      finalized += 1;
      continue;
    }

    if (campaign.skillId === 'poidh' && campaign.poidhBountyId != null) {
      const bountyUrl = poidhBountyUrl(campaign.poidhBountyId);
      const note = `POIDH bounty posted — ${bountyUrl}`;
      await createPlatformAgentPost(
        updated.tokenAddress,
        [
          `$${updated.symbol} — community task: ${campaign.label}`,
          `Raised $${campaign.raisedUsd} / $${campaign.goalUsd} USDC — POIDH bounty live.`,
          `Claim on poidh.xyz — add funds, submit proof, vote 48h: ${bountyUrl}`,
          communityUrl(updated.tokenAddress),
        ].join('\n')
      ).catch(() => undefined);

      await markAgentPoolExecuted({
        tokenAddress: updated.tokenAddress,
        skillId: 'poidh',
        executionNote: note,
        poidhBountyId: campaign.poidhBountyId,
      });
      finalized += 1;
    }
  }

  if (finalized > 0) {
    const refreshed = await getCommunities();
    const idx = refreshed.findIndex(
      (c) => c.tokenAddress.toLowerCase() === normalizeAddr(updated.tokenAddress)
    );
    if (idx !== -1) {
      updated = mergeCommunityDefaults(refreshed[idx]);
    }
  }

  return { community: updated, linked, statusUpdates, fundedAtBackfilled, finalized };
}

export async function verifyAllAgentPools(): Promise<AgentPoolVerifyResult> {
  const communities = await getCommunities();
  let spacesChecked = 0;
  let campaignsChecked = 0;
  let tasksLinked = 0;
  let statusesUpdated = 0;
  let fundedAtBackfilled = 0;
  let finalized = 0;

  for (const raw of communities) {
    const merged = mergeCommunityDefaults(raw);
    if (!merged.usePlatformAgent || !merged.verified) continue;

    const pool = readStoredAgentPool(merged.agentPool);
    const toCheck = pool.campaigns.filter(
      (c) => c.enabled && isAgentPoolCampaignFunded(c)
    );
    if (!toCheck.length) continue;

    spacesChecked += 1;
    campaignsChecked += toCheck.length;

    const result = await verifyAgentPoolForCommunity(merged, { persist: true });
    tasksLinked += result.linked;
    statusesUpdated += result.statusUpdates;
    fundedAtBackfilled += result.fundedAtBackfilled;
    finalized += result.finalized ?? 0;
  }

  return {
    spacesChecked,
    campaignsChecked,
    tasksLinked,
    statusesUpdated,
    fundedAtBackfilled,
    finalized,
  };
}
